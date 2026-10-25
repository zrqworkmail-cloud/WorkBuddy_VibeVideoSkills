#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""节奏体检 qc_rhythm.py —— 嫁接自 GitHub 开源技能的量化判据，用于我们的成片。

判据来源（已下载到 tools/oss-skills/）：
  anything2explainer (★2.7k)  每镜头最长静止 ≤3s；元素入场后不许完全静止；
                              每句至少一处可察觉的画面变化；末拍稳定期 30-45 帧
  onetake (★3.1k)             "Verify before showing" —— 成片复测，不是组级读数

实现：按 timeline.json 的分镜边界切分成片，逐帧测全局运动能量
（下采样灰度帧的平均绝对差），报告每镜：
  最长静止段（能量 < QUIET 视为"画面无变化"）、静止占比、平均能量。
判据：
  最长静止 >3.0s            → 静止缺陷（motion graphics 语境下观众会感到"卡住"）
  单镜静止占比 >45%          → 提示（该镜可能"入场即停"）
  最长静止 >2.0s 且非收尾镜  → 观察（收尾 s9 的定格是设计）

用法：python scripts/qc_rhythm.py [成片路径] （默认 out/为什么越熬夜越精神.mp4）
"""
import json, os, subprocess, sys
import numpy as np

import _film

ROOT = _film.FILMROOT
FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
FPS = 24
QUIET = 0.0012          # 帧间平均绝对差阈值（下采样 240x428 灰度 0..1），低于此视为"无变化"
STILL_LIMIT = 3.0       # 最长静止上限（秒）
OBSERVE = 2.0           # 观察线（秒）
W, H = 240, 428         # 下采样尺寸（保持 1080:1920 比例）

def decode(path):
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-i", path,
           "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**8)
    fsz = W * H
    prev = None
    while True:
        buf = p.stdout.read(fsz)
        if len(buf) < fsz:
            break
        fr = np.frombuffer(buf, dtype=np.uint8).astype(np.float32).reshape(H, W) / 255.0
        if prev is None:
            prev = fr
            yield 1.0                      # 首帧给个非零能量
            continue
        yield float(np.abs(fr - prev).mean())
        prev = fr
    p.stdout.close(); p.wait()

def main():
    tl = _film.timeline()
    default_vid = os.path.join(ROOT, "out", tl.get("title", "output") + ".mp4")
    vid = sys.argv[1] if len(sys.argv) > 1 else default_vid
    beat = tl["beatSec"]
    t = 0.0
    scenes = []
    for sc in tl["scenes"]:
        scenes.append((sc["id"], sc["name"], t, t + sc["beats"] * beat))
        t += sc["beats"] * beat
    dur = scenes[-1][3]

    energies = list(decode(vid))
    n = len(energies)
    print(f"成片 {os.path.basename(vid)}  {n} 帧 @ {FPS}fps  阈值: 静止<{QUIET}, 上限 {STILL_LIMIT}s")
    print(f"{'镜':5}{'时长':>6}{'平均能量':>9}{'静止占比':>9}{'最长静止':>9}  判定")
    bad = 0
    for sid, name, s0, s1 in scenes:
        i0, i1 = int(s0 * FPS), min(n, int(s1 * FPS) + 1)
        seg = np.array(energies[i0:i1])
        quiet = seg < QUIET
        longest = cur = 0
        for q in quiet:
            cur = cur + 1 if q else 0
            longest = max(longest, cur)
        ls = longest / FPS
        ratio = quiet.mean() * 100
        mean_e = seg.mean()
        flag = "✔"
        if ls > STILL_LIMIT:
            flag = "✖ 静止超限"; bad += 1
        elif ls > OBSERVE and sid != "s9":
            flag = "△ 观察"; bad += 0
        elif ratio > 45:
            flag = "△ 静止偏多"
        print(f"{sid:5}{s1-s0:6.1f}{mean_e:9.4f}{ratio:8.1f}%{ls:8.2f}s  {flag}  {name}")
    print("-" * 66)
    print("✔ 全镜通过节奏体检" if bad == 0 else f"✖ {bad} 个镜需处理（先修静止超限，再处理观察项）")

if __name__ == "__main__":
    main()
