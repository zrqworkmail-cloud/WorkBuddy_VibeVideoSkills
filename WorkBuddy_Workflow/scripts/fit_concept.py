#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 ImageGen 出的原图裁成 I2V 用的概念帧（704×1280），并切掉右下角水印。

为什么需要这一步：
  ImageGen 出的是 1024×1536（2:3），I2V 要 704×1280（0.55），比例不同；
  且生成图右下角带"AI生成"水印，必须裁掉，否则会进成片。

处理链：裁掉底部水印区 → 按高度缩到 1280 → 居中裁 704 宽。

用法：
  FILM=motion-sickness python scripts/fit_concept.py 1 out/ai/gen/xxx.png
  FILM=motion-sickness python scripts/fit_concept.py 1 out/ai/gen/xxx.png 120   # 自定义裁底高度
"""
import os
import subprocess
import sys

import _film

FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"


def fit(sid, src, bottom=100):
    if not os.path.exists(src):
        raise SystemExit(f"原图不存在: {src}")
    dst_dir = _film.p_out("ai", "concepts")
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, f"c{sid}.png")
    vf = f"crop=iw:ih-{bottom}:0:0,scale=-1:1280,crop=704:1280"
    subprocess.run(
        [FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
         "-vf", vf, "-frames:v", "1", dst],
        check=True,
    )
    w, h = 704, 1280
    print(f"✔ c{sid}.png  {w}×{h}  {(os.path.getsize(dst)/1024):.0f} KB  ← {os.path.basename(src)}")
    return dst


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    sid = sys.argv[1]
    src = sys.argv[2]
    bottom = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    fit(sid, src, bottom)
