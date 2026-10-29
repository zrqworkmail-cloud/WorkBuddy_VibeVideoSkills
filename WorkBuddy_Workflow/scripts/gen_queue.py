#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成队列执行器：GPU 空闲即提交，被占用则排队等待；断点续跑，失败自动重试。

与 gen_one.py 的分工：
  gen_one.py   = 单镜，跑完就退，适合手动试镜
  gen_queue.py = 队列，可常驻后台，适合无人值守（本脚本）

四条硬保证（无人值守必须做到）：
  1) **绝不抢占别人的算力**：每镜提交前过 gpu_gate.wait_gpu()，检查外部生成进程 /
     ComfyUI 队列 / 利用率 / 空闲显存。**从不调用 /interrupt、从不清空队列**——
     别的软件排的活必须原样跑完。
  2) **任务不挂死**：单镜有硬上限（MAX_SHOT_SEC），超时先查磁盘（可能只是慢），
     磁盘也没有就判失败、记日志、继续下一镜。不会卡在一个镜头上过夜。
  3) **断点续跑**：产物 >200KB 即跳过；中途被 kill / ComfyUI 重启 / 某镜失败，
     重跑同一条命令即可接着来。
  4) **实验可并存**：--tag 给产物加后缀（如 s1_e8.mp4），同一镜的多个实验版本
     互不覆盖，便于回来对比择优。

用法：
  FILM=motion-sickness python scripts/gen_queue.py                       # 全部未完成镜头
  FILM=motion-sickness python scripts/gen_queue.py --shots s1 --tag e8 --steps 8
  FILM=motion-sickness python scripts/gen_queue.py --after s3,s5,s6      # 等这些跑完再开始
  FILM=motion-sickness python scripts/gen_queue.py --force               # 全部重做
"""
import argparse
import glob
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film      # noqa: E402
import wan22      # noqa: E402
import gpu_gate   # noqa: E402
from gen_one import poll_history, disk_fallback  # noqa: E402

MIN_BYTES = 200 * 1024
# 本片素材的起始时刻：取 out/ai 下已有片段的最早修改时间。
# 用途：ComfyUI 输出目录是多片共享的，判断"某个 sN_*.mp4 是不是本片的"只能靠时间。
# 上一支片的输出最新到 10-23，本片从 10-24 18:21 起，用这个分界不会串片。
SINCE = 0
# 单镜硬上限。实测 4 步在显存吃紧时可达 60 分钟；8 步（三相位）约翻倍，故分开设。
# 超时后**不重试**：任务很可能还在 ComfyUI 里跑，重试等于把同一条 GPU 活干两遍。
MAX_SHOT_4 = 6000      # 4 步：100 分钟
MAX_SHOT_8 = 9600      # 8 步：160 分钟


def P(*a):
    print(*a, flush=True)


SERVER = "http://127.0.0.1:8188"


def _queue_items():
    """返回 ComfyUI 队列里 running + pending 的条目列表。"""
    try:
        with urllib.request.urlopen(SERVER + "/queue", timeout=8) as r:
            d = json.load(r)
        return list(d.get("queue_running", [])) + list(d.get("queue_pending", []))
    except Exception:
        return []


def find_queued_pid(prefix):
    """在 ComfyUI 队列里找 filename_prefix 等于 wan22/<prefix> 的任务。

    为什么需要：GPU 被别人占满时，我们的任务会在 ComfyUI 里排很久。
    上一轮超时判失败后如果直接重提交，同一条 GPU 活就干了两遍（还挤占别人）。
    这里先查队列：已有同镜任务就直接接管轮询，不再提交。
    """
    want = f"wan22/{prefix}"
    for item in _queue_items():
        if not isinstance(item, (list, tuple)) or len(item) < 3:
            continue
        pid, wf = item[1], item[2]
        if not isinstance(wf, dict):
            continue
        node = wf.get("20", {})
        if isinstance(node, dict) and node.get("inputs", {}).get("filename_prefix") == want:
            return str(pid)
    return None


def pid_in_queue(pid):
    """pid 是否还在 ComfyUI 队列（running 或 pending）。读不到时保守返回 True。"""
    items = _queue_items()
    if not items:
        return True          # 读不到队列就当作还在，宁可多等也不要重复提交
    for item in items:
        if isinstance(item, (list, tuple)) and len(item) > 1 and str(item[1]) == pid:
            return True
    return False


def wait_job(pid, limit):
    """等任务完成；**排队等待不计入执行超时**。

    只有「不在队列里、也没成功、也没落盘」才算真失败。
    这是 s8 被误判的根因：提交后排队 100 分钟，超时逻辑把它判死，
    而它其实一直是队列里的第 1 位正在跑。
    """
    t0 = time.time()
    deadline = t0 + limit
    while True:
        try:
            h = json.load(urllib.request.urlopen(SERVER + "/history/" + pid, timeout=10))
        except Exception:
            h = {}
        if pid in h:
            rec = h[pid]
            kinds = [m[0] for m in rec.get("status", {}).get("messages", [])]
            if "execution_success" in kinds:
                return rec
            if "execution_error" in kinds:
                raise RuntimeError("execution_error " + json.dumps(rec.get("status", {}))[:300])
        now = time.time()
        if now > deadline:
            if pid_in_queue(pid):
                deadline = now + limit
                P(f"  仍在 ComfyUI 队列中，执行超时续期 {limit // 60} 分（已等 {(now - t0) / 60:.0f} 分）")
            else:
                raise TimeoutError(f"不在队列且无产物（已等 {(now - t0) / 60:.0f} 分）")
        time.sleep(3)


def shot_ids():
    tl = _film.timeline()
    return [int(s["id"].lstrip("s")) for s in tl["scenes"]]


def sfx(tag):
    return f"_{tag}" if tag else ""


def out_path(sid, tag=""):
    return os.path.join(wan22.AI, f"s{sid}{sfx(tag)}.mp4")


def is_done(sid, tag=""):
    p = out_path(sid, tag)
    return os.path.exists(p) and os.path.getsize(p) > MIN_BYTES


def log(rec):
    try:
        with open(os.path.join(wan22.AI, "_gen_log.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass


def wait_for(shots, tag="", max_wait=10 * 3600, interval=300):
    """等另一批镜头全部完成再开工（保证整体顺序，不与另一个队列抢同一镜）。"""
    if not shots:
        return
    t0 = time.time()
    while True:
        pending = [s for s in shots if not is_done(s, tag)]
        if not pending:
            P(f"[wait] 前置镜头已全部完成：{', '.join('s' + str(s) for s in shots)}")
            return
        el = time.time() - t0
        if el > max_wait:
            P(f"[wait] 已等 {el / 3600:.1f}h，前置仍未完成 {pending}，不再等待直接开工"
              f"（已完成的会自动跳过，不会重复生成）")
            return
        P(f"[wait] 等前置镜头 {', '.join('s' + str(s) for s in pending)}"
          f"（已等 {el / 60:.0f} 分）")
        time.sleep(interval)


def gen_one(sid, seed, length, steps=4, tag="", tries=8):
    """生成单镜，成功返回 (True, 说明)，失败返回 (False, 原因)。"""
    src = os.path.join(wan22.AI, "concepts", f"c{sid}.png")
    if not os.path.exists(src):
        return False, f"概念帧缺失 {src}"
    prefix = f"s{sid}{sfx(tag)}"

    for attempt in range(tries):
        if attempt:
            P(f"[{prefix}] 第 {attempt + 1}/{tries} 次重试（先重新确认 GPU 空闲）…")
            gpu_gate.wait_gpu()          # 重试前重新让渡，避免在别人占卡时硬上
            time.sleep(10)
        try:
            name = wan22.upload_image(src)
        except Exception as e:
            P(f"[{prefix}] 上传失败（ComfyUI 可能未启动）：{str(e)[:160]}")
            time.sleep(30)
            continue

        dest = out_path(sid, tag)
        limit = MAX_SHOT_8 if steps > 4 else MAX_SHOT_4

        # 提交前先看磁盘：上一轮可能已经跑完、只是没来得及拷回来
        # （典型场景：任务在 ComfyUI 里排了很久，门控一直拦着我们，等轮到我们时
        #  它早已跑完并从队列消失——不查磁盘就会重复提交，同一条活干两遍）
        n = disk_fallback(sid, dest, min_mtime=SINCE, prefix=prefix)
        if n >= MIN_BYTES:
            P(f"[{prefix}] 磁盘已有本片产物（{n / 1048576:.1f}MB），直接取回，不重复提交")
            return True, f"{n / 1048576:.1f}MB / 磁盘取回（未重新生成）"

        # 再查队列：已有同镜任务就接管，不重复提交
        pid = find_queued_pid(prefix)
        if pid:
            P(f"[{prefix}] 队列里已有同镜任务 pid={pid[:12]}，接管轮询（不重复提交）")
        else:
            try:
                wf = wan22.build(wan22.SCENES[sid], name, seed + sid,
                                 length=length, steps=steps, neg=wan22.neg_for(sid))
                wf["prompt"]["20"]["inputs"]["filename_prefix"] = f"wan22/{prefix}"
                pid = wan22.submit(wf)
            except Exception as e:
                P(f"[{prefix}] 提交失败：{str(e)[:200]}")
                time.sleep(20)
                continue
            P(f"[{prefix}] 已提交 pid={pid[:12]}（steps={steps}），等待执行…")

        t_submit = time.time()
        try:
            rec = wait_job(pid, limit)
        except TimeoutError as e:
            # 排队等待不计入超时；走到这里说明它确实不在队列里了。
            P(f"[{prefix}] {e}，先查磁盘是否已落盘…")
            n = disk_fallback(sid, dest, min_mtime=t_submit - 5, prefix=prefix)
            if n >= MIN_BYTES:
                el = time.time() - t_submit
                return True, f"{el:.0f}s / {n / 1048576:.1f}MB / 超时后磁盘取回"
            P(f"[{prefix}] 磁盘无产物 → 记为失败并跳过（不中断 ComfyUI 队列）")
            return False, "任务从队列消失且磁盘无产物"
        except Exception as e:
            P(f"[{prefix}] 执行失败：{str(e)[:200]}")
            continue
        el = time.time() - t_submit

        try:
            outs = wan22.outputs(rec)
            if outs:
                fn, sub, typ = outs[0]
                n = wan22.download(fn, sub, typ, dest)
                how = "API"
            else:
                n = disk_fallback(sid, dest, min_mtime=t_submit - 5, prefix=prefix)
                how = "磁盘兜底"
        except Exception as e:
            P(f"[{prefix}] 下载失败：{str(e)[:200]}")
            continue

        if n < MIN_BYTES:
            P(f"[{prefix}] 落盘仅 {n / 1024:.0f}KB，视为失败，重试")
            continue

        return True, f"{el:.0f}s / {n / 1048576:.1f}MB / {how}"

    return False, f"超过 {tries} 次重试上限"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", default="", help="s1,s2,s3；留空=全部")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--length", type=int, default=None)
    ap.add_argument("--steps", type=int, default=None,
                    help="采样步数：4=两相位加速；8=三相位（多一段 CFG，压慢动作）")
    ap.add_argument("--tag", default="", help="产物后缀，用于并存实验版本，如 e8")
    ap.add_argument("--after", default="", help="先等这些镜头跑完再开工，如 s3,s5,s6")
    ap.add_argument("--force", action="store_true", help="已存在的也重做")
    a = ap.parse_args()

    seed = a.seed if a.seed is not None else wan22.DEFAULT_SEED
    length = a.length if a.length is not None else wan22.DEFAULT_LENGTH
    steps = a.steps if a.steps is not None else wan22.DEFAULT_STEPS
    tag = (a.tag or "").strip()
    ids = ([int(x.strip().lstrip("s")) for x in a.shots.split(",") if x.strip()]
           if a.shots else shot_ids())

    # 本片起始时刻：已有片段里最早的那个修改时间。用于在共享输出目录里区分本片/旧片产物。
    global SINCE
    existing = [f for f in glob.glob(os.path.join(wan22.AI, "s*.mp4")) if "_v" not in os.path.basename(f)]
    SINCE = (min(os.path.getmtime(f) for f in existing) - 60) if existing else 0

    P("=" * 68)
    P(f"生成队列  film={_film.FILM or 'reference'}  seed={seed}  length={length}  "
      f"steps={steps}  tag={tag or '-'}")
    P(f"总镜数 {len(ids)}")
    P(f"输出目录 {wan22.AI}")
    P("=" * 68)

    after = [int(x.strip().lstrip("s")) for x in a.after.split(",") if x.strip()]
    if after:
        wait_for(after)

    todo = [i for i in ids if a.force or not is_done(i, tag)]
    skip = [i for i in ids if i not in todo]
    P(f"待做 {len(todo)}  已完成跳过 {len(skip)}"
      + (f"（{', '.join('s' + str(i) for i in skip)}）" if skip else ""))
    if not todo:
        P("没有待做镜头，队列为空。")
        return

    t_all = time.time()
    ok, fail = [], []
    for n, sid in enumerate(todo, 1):
        P("")
        P(f"---- [{n}/{len(todo)}] s{sid}{sfx(tag)} ----")
        waited = gpu_gate.wait_gpu()          # 每一镜提交前都让渡
        if waited:
            P(f"[s{sid}] 等 GPU 让渡 {waited // 60} 分 {waited % 60} 秒")
        t0 = time.time()
        good, msg = gen_one(sid, seed, length, steps, tag)
        el = time.time() - t0
        log({"sid": sid, "tag": tag, "steps": steps, "ok": good, "msg": msg,
             "elapsed": round(el), "seed": seed + sid, "length": length,
             "ts": int(time.time())})
        if good:
            ok.append(sid)
            P(f"[s{sid}{sfx(tag)}] ✔ {msg}  总计 {el:.0f}s")
        else:
            fail.append(sid)
            P(f"[s{sid}{sfx(tag)}] ✖ {msg}  总计 {el:.0f}s")
            # 安全阀：还没任何一镜成功就失败 → 大概率是系统性问题
            # （模型名不对 / 节点缺失 / ComfyUI 版本不匹配），继续跑只会逐个烧时间。
            # 但**超时不算系统性问题**：GPU 被别人占满时单镜可能排队几小时，
            # 这时候中止队列等于把剩下所有镜头一起放弃（曾因此漏掉 5 个镜头）。
            if not ok and "超时" not in msg and "队列消失" not in msg:
                P("")
                P("!! 首镜即失败（非超时），判定为系统性问题，中止队列以免逐镜空跑。")
                P(f"!! 手动单镜试跑：FILM={_film.FILM or 'reference'} "
                  f"python scripts/gen_one.py {sid} {seed} {length}")
                break
            if not ok:
                P(f"   （超时/掉队不计入系统性问题，继续下一镜）")

    P("")
    P("=" * 68)
    P(f"队列结束  成功 {len(ok)} / 失败 {len(fail)}  总耗时 {(time.time() - t_all) / 60:.1f} 分")
    if ok:
        P(f"  成功：{', '.join('s' + str(i) for i in ok)}")
    if fail:
        P(f"  失败：{', '.join('s' + str(i) for i in fail)}")
        P("  重跑本脚本会自动只补失败的镜头。")
    P("=" * 68)


if __name__ == "__main__":
    main()
