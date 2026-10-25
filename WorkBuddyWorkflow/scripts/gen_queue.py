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
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film      # noqa: E402
import wan22      # noqa: E402
import gpu_gate   # noqa: E402
from gen_one import poll_history, disk_fallback  # noqa: E402

MIN_BYTES = 200 * 1024
# 单镜硬上限。实测 4 步在显存吃紧时可达 60 分钟；8 步（三相位）约翻倍，故分开设。
# 超时后**不重试**：任务很可能还在 ComfyUI 里跑，重试等于把同一条 GPU 活干两遍。
MAX_SHOT_4 = 6000      # 4 步：100 分钟
MAX_SHOT_8 = 9600      # 8 步：160 分钟


def P(*a):
    print(*a, flush=True)


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
        dest = out_path(sid, tag)
        limit = MAX_SHOT_8 if steps > 4 else MAX_SHOT_4
        try:
            rec = poll_history(pid, timeout=limit)
        except TimeoutError:
            # 超时 ≠ 失败：任务可能还在跑，或刚跑完但 history 还没返回。
            # 先查磁盘，避免把同一条 GPU 活干两遍。
            P(f"[{prefix}] 超过 {limit // 60} 分未完成，先查磁盘是否已落盘…")
            n = disk_fallback(sid, dest, min_mtime=t_submit - 5, prefix=prefix)
            if n >= MIN_BYTES:
                el = time.time() - t_submit
                return True, f"{el:.0f}s / {n / 1048576:.1f}MB / 超时后磁盘取回"
            # 磁盘也没有：不再重试。任务很可能仍挂在 ComfyUI 里，
            # 重试会重复提交、把同一条 GPU 活干两遍，还可能把别人的任务挤得更久。
            P(f"[{prefix}] 磁盘无产物 → 记为失败并跳过（不中断 ComfyUI 队列）")
            return False, f"超时 {limit // 60} 分且磁盘无产物"
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
            if not ok:
                P("")
                P("!! 首镜即失败，判定为系统性问题，中止队列以免逐镜空跑。")
                P(f"!! 手动单镜试跑：FILM={_film.FILM or 'reference'} "
                  f"python scripts/gen_one.py {sid} {seed} {length}")
                break

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
