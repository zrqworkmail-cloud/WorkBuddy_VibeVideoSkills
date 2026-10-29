#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""素材级节奏预检：每出一镜就判一次，不等全片合成。

为什么要有这个：
  qc_rhythm.py 跑的是**成片**，按 timeline 切分镜边界。但成片要等 18 镜全齐、
  底板拼好、覆盖层渲完才能做——那时才发现某镜"入场即停"，重做一镜又要 30 分钟。
  本脚本直接在**单个素材片段**上算同样的判据，生成完立刻能判，把质检从"事后"
  前移到"事中"。

判据（与 qc_rhythm.py 同一套，来自 anything2explainer）：
  最长静止 > 3.0s   → 静止缺陷（观众会感到"卡住"）
  静止占比 > 45%    → 提示（该镜可能"入场即停"）
  最长静止 > 2.0s   → 观察

用法：
  FILM=motion-sickness python scripts/qc_clip.py            # 全部已生成镜头
  FILM=motion-sickness python scripts/qc_clip.py s4 s3      # 指定镜头
注意：需要 numpy，本机请用 D:/anaconda3/python.exe 跑。
"""
import glob
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film   # noqa: E402

FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
FPS = 16
QUIET = 0.0012        # 帧间平均绝对差阈值（240×428 灰度 0..1）
STILL_LIMIT = 3.0
OBSERVE = 2.0
W, H = 240, 428


def energies(path):
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-i", path,
           "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10 ** 8)
    fsz = W * H
    prev = None
    out = []
    while True:
        buf = p.stdout.read(fsz)
        if len(buf) < fsz:
            break
        fr = np.frombuffer(buf, dtype=np.uint8).astype(np.float32).reshape(H, W) / 255.0
        if prev is None:
            prev = fr
            out.append(1.0)
            continue
        out.append(float(np.abs(fr - prev).mean()))
        prev = fr
    p.stdout.close()
    p.wait()
    return out


def judge(path):
    e = energies(path)
    seg = np.array(e)
    quiet = seg < QUIET
    longest = cur = 0
    for q in quiet:
        cur = cur + 1 if q else 0
        longest = max(longest, cur)
    ls = longest / FPS
    ratio = quiet.mean() * 100
    if ls > STILL_LIMIT:
        flag = "✖ 静止超限"
    elif ls > OBSERVE:
        flag = "△ 观察"
    elif ratio > 45:
        flag = "△ 静止偏多"
    else:
        flag = "✔"
    return ls, ratio, seg.mean(), flag, len(e)


def main():
    ai = _film.p_out("ai")
    args = [a.lstrip("s") for a in sys.argv[1:] if a.strip()]
    if args:
        files = [os.path.join(ai, f"s{a}.mp4") for a in args]
    else:
        files = sorted(glob.glob(os.path.join(ai, "s*.mp4")))
        files = [f for f in files if "_v" not in os.path.basename(f)]

    print(f"{'镜':6}{'时长':>7}{'平均能量':>10}{'静止占比':>9}{'最长静止':>9}  判定")
    print("-" * 60)
    bad = []
    for f in files:
        if not os.path.exists(f):
            print(f"{os.path.basename(f):6}  —— 未生成")
            continue
        ls, ratio, me, flag, n = judge(f)
        name = os.path.basename(f)[:-4]
        print(f"{name:6}{n / FPS:>6.2f}s{me:>10.4f}{ratio:>8.1f}%{ls:>8.2f}s  {flag}")
        if flag.startswith("✖"):
            bad.append(name)
    print("-" * 60)
    print(f"静止超限 {len(bad)} 镜" + (f"：{', '.join(bad)}" if bad else "，全部通过"))


if __name__ == "__main__":
    main()
