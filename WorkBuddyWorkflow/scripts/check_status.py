#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""一眼看清生成进度：每镜产物大小/时间、实验版本、最近日志、GPU 状态。

用法：
  FILM=motion-sickness python scripts/check_status.py
"""
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film   # noqa: E402
import wan22   # noqa: E402


def mb(p):
    return f"{os.path.getsize(p) / 1048576:.1f}MB"


def ago(ts):
    d = time.time() - ts
    if d < 3600:
        return f"{d / 60:.0f}分前"
    if d < 86400:
        return f"{d / 3600:.1f}小时前"
    return f"{d / 86400:.1f}天前"


def main():
    tl = _film.timeline()
    ai = wan22.AI
    scenes = tl["scenes"]
    beat = tl["beatSec"]

    print("=" * 74)
    print(f"影片：{tl.get('title', '')}   {len(scenes)} 镜 / "
          f"{sum(s['beats'] for s in scenes)} 拍 / {sum(s['beats'] for s in scenes) * beat:.2f}s")
    print(f"目录：{ai}")
    print("=" * 74)
    print(f"{'镜':4}{'拍':>4}{'时长':>7}{'实验版':>10}  状态")
    print("-" * 74)

    done = 0
    for sc in scenes:
        sid = sc["id"]
        base = os.path.join(ai, f"{sid}.mp4")
        tags = []
        for f in sorted(os.listdir(ai)) if os.path.isdir(ai) else []:
            if f.startswith(sid + "_") and f.endswith(".mp4"):
                t = f[:-4][len(sid) + 1:]
                if t and not t.startswith("v"):
                    tags.append(t)
        if os.path.exists(base):
            done += 1
            info = f"{mb(base):>8}  {ago(os.path.getmtime(base))}"
        else:
            info = "      --   未生成"
        extra = " ".join(tags) if tags else ""
        print(f"{sid:4}{sc['beats']:>4}{sc['beats'] * beat:>7.2f}s{extra:>10}  {info}  {sc['name']}")

    print("-" * 74)
    print(f"基准版完成 {done}/{len(scenes)}")

    logp = os.path.join(ai, "_gen_log.jsonl")
    if os.path.exists(logp):
        rows = []
        for line in open(logp, encoding="utf-8"):
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
        if rows:
            print("\n最近 8 条生成记录：")
            for r in rows[-8:]:
                flag = "✔" if r.get("ok") else "✖"
                print(f"  {flag} {r.get('sid')}{('_' + r['tag']) if r.get('tag') else ''}"
                      f"  steps={r.get('steps')}  {r.get('elapsed')}s  {r.get('msg')}")

    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.free",
                              "--format=csv,noheader"], capture_output=True, text=True,
                             timeout=20).stdout.strip()
        print(f"\nGPU：{out}")
    except Exception:
        pass
    print("=" * 74)


if __name__ == "__main__":
    main()
