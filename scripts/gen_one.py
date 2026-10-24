#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""可靠单镜生成器：提交 → 轮询 history(execution_success) → 下载；带 flush 与磁盘兜底。

背景：wan22.py 在「多 ComfyUI 实例抢同一端口 + 输出被块缓冲」时 wait() 偶发不返回。
本脚本：
  1) 复用 wan22.build / upload / submit / download / SCENES / NEG；
  2) wait 只认 /history/{pid} 里的 execution_success（不看缓存消息干扰）；
  3) API 下载失败时，兜底从 ComfyUI 输出目录取最新 wan22/sN_*.mp4 复制到 out/ai/sN.mp4；
  4) 全程 print(flush=True)，日志实时可见。
用法：python gen_one.py 10 20261021 121
"""
import json, os, sys, time, glob, shutil
import urllib.request, urllib.error

SERVER = "http://127.0.0.1:8188"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI = os.path.join(ROOT, "out", "ai")
COMFY_OUT = r"D:\AI\ComfyUI\output\wan22"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wan22  # noqa: E402


def P(*a):
    print(*a, flush=True)


def poll_history(pid, timeout=2400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.load(urllib.request.urlopen(SERVER + "/history/" + pid, timeout=10))
        except urllib.error.HTTPError:
            time.sleep(3); continue
        except Exception:
            time.sleep(3); continue
        if pid in h:
            rec = h[pid]
            kinds = [m[0] for m in rec.get("status", {}).get("messages", [])]
            if "execution_success" in kinds:
                return rec
            if "execution_error" in kinds:
                raise RuntimeError("execution_error " + json.dumps(rec.get("status", {}))[:300])
        time.sleep(3)
    raise TimeoutError("wait timeout for " + pid)


def disk_fallback(sid, dest):
    files = sorted(glob.glob(os.path.join(COMFY_OUT, f"s{sid}_*.mp4")),
                   key=os.path.getmtime)
    if not files:
        return 0
    shutil.copyfile(files[-1], dest)
    return os.path.getsize(dest)


def main():
    sid = int(sys.argv[1])
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20261021
    length = int(sys.argv[3]) if len(sys.argv) > 3 else 121
    src = os.path.join(AI, "concepts", f"c{sid}.png")
    name = wan22.upload_image(src)
    wf = wan22.build(wan22.SCENES[sid], name, seed + sid, length=length)
    wf["prompt"]["13"]["inputs"]["filename_prefix"] = f"wan22/s{sid}"
    pid = wan22.submit(wf)
    P(f"[s{sid}] submitted pid={pid[:12]}")
    t0 = time.time()
    rec = poll_history(pid)
    el = time.time() - t0
    outs = wan22.outputs(rec)
    dest = os.path.join(AI, f"s{sid}.mp4")
    if outs:
        fn, sub, typ = outs[0]
        n = wan22.download(fn, sub, typ, dest)
        P(f"[s{sid}] OK {el:.0f}s (API)  {dest}  {n/1048576:.1f} MB")
    else:
        P(f"[s{sid}] history 无 outputs → 磁盘兜底")
        n = disk_fallback(sid, dest)
        P(f"[s{sid}] OK {el:.0f}s (disk)  {dest}  {n/1048576:.1f} MB")


if __name__ == "__main__":
    main()
