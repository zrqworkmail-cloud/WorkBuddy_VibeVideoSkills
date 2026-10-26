#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""底板构建（均匀时长版）：所有镜头都贴着素材原生时长时用这个。

与 build_base.py 的分工
------------------------
build_base.py           异构版：每镜不同的调色/裁切/分段定速/构图，为上一支片量身定制。
                        镜长跨度大（7~18s）时必须要它。
build_base_uniform.py   均匀版：所有镜头时长接近素材原生（本片 14~15 拍 ≈ 7.5~8.0s），
                        不需要裁头尾、不需要分段、几乎不需要慢放。逻辑只有四步：
                        重定时 → 补帧到 24fps → 统一调色 → 拼接。

为什么单独写一个而不是改旧的：
  旧脚本里 LOOK/TRIM/PARTS_TIMED/GEO 全是上一支片的硬编码，改成通用配置等于重写，
  而它现在是仓库里唯一跑通过 136 秒成片的参考实现，不能为了新片去冒破坏它的风险。

用法：
  FILM=motion-sickness python scripts/build_base_uniform.py             # 全部镜头
  FILM=motion-sickness python scripts/build_base_uniform.py s1,s2,s3    # 只建这几镜（试跑用）

产物：
  out/base/base_sN.mp4   单镜分段（1080×1920 / 24fps）
  out/base.mp4           拼接后的整条底板
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film   # noqa: E402

FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
FFPROBE = "D:/tools/ffmpeg/bin/ffprobe.exe"
FPS = 24
W, H = 1080, 1920
SRC_W, SRC_H = 704, 1280

# 全片统一调色。均匀版刻意只做一层，保证 18 镜风格一致——
# 逐镜调不同参数会让成片"拼盘感"很重，而这支片的概念帧本来就同源同调。
GRADE = "eq=contrast=1.06:saturation=1.03:brightness=-0.005"

# 补帧：16fps → 24fps 必须用运动补偿，不能用 fps 过滤器复制帧（会变幻灯片）
MINTERP = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"

# 单镜时长误差上限（秒）。超过就报错，不静默放过——错一帧全片就音画错位。
TOL = 0.06

# 裁头：I2V 生成的前 0.5~1.5 秒通常还在从概念首帧"过渡"，画面发糊、构图不稳。
# 实测 s1 第 1 秒是模糊的树影，必须裁掉。裁掉后靠放大倍率补足目标时长
# （7.56s 裁 0.9s 剩 6.66s，要凑 7.48s → 1.12 倍慢放，属于可接受范围）。
# 需要个别镜头不同时，在 TRIM_HEAD_OVERRIDE 里改。
TRIM_HEAD = 0.9
TRIM_HEAD_OVERRIDE = {}


def P(*a):
    print(*a, flush=True)


def probe_duration(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def build_segment(sid, src, target, dst, n_frames):
    """裁头 → 重定时到 target 秒 → 补帧到 24fps → 调色 → 放大到 1080×1920。

    n_frames 由调用方按**累计时间**算好（见 main 里的 cum/prev_n）。
    为什么不在这里各自 round(target*24)：每段独立取整会各自向下偏一点，
    18 段累加后总时长会短 0.3 秒（实测 136.416 vs 136.719），音画就错位了。
    按累计边界取整，误差只在最后一段体现，总量恒等于 round(总时长×24)。

    另注：不能在末尾再加 -r 24 —— 补帧后流已经是 24fps，再加 -r 会再补 2 帧。
    """
    src_dur = probe_duration(src)
    head = TRIM_HEAD_OVERRIDE.get(sid, TRIM_HEAD)
    usable = src_dur - head
    if usable <= 0.5:
        raise SystemExit(f"{sid} 裁头 {head}s 后仅剩 {usable:.2f}s，不可用")
    k = target / usable           # setpts 乘数：>1 变慢，<1 变快
    vf = (f"trim=start={head:.3f},setpts=(PTS-STARTPTS)*{k:.6f},{MINTERP},{GRADE},"
          f"scale={W}:{H}:flags=lanczos,"
          f"tpad=stop_mode=clone:stop_duration=1,trim=end_frame={n_frames},"
          f"setpts=N/({FPS}*TB)")
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
           "-vf", vf,
           "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
           "-pix_fmt", "yuv420p", dst]
    subprocess.run(cmd, check=True)
    return src_dur, k


def main():
    tl = _film.timeline()
    beat = tl["beatSec"]
    ai = _film.p_out("ai")
    outdir = _film.p_out("base")
    os.makedirs(outdir, exist_ok=True)

    want = set(a.strip().lstrip("s") for a in sys.argv[1].split(",") if a.strip()) if len(sys.argv) > 1 else None

    rows = []
    P("=" * 72)
    P(f"{'镜':5}{'拍':>4}{'目标':>8}{'源长':>8}{'倍率':>8}{'实长':>8}{'误差':>9}  判定")
    P("-" * 72)
    bad = 0
    cum = 0.0          # 累计目标时间
    prev_n = 0         # 累计帧边界
    for sc in tl["scenes"]:
        sid = sc["id"]
        num = sid.lstrip("s")
        if want and num not in want:
            continue
        src = os.path.join(ai, f"{sid}.mp4")
        dst = os.path.join(outdir, f"base_{sid}.mp4")
        target = sc["beats"] * beat
        cum += target
        n_end = round(cum * FPS)
        n_frames = n_end - prev_n          # 本段帧数 = 累计边界之差
        prev_n = n_end
        if not os.path.exists(src):
            P(f"{sid:5}{sc['beats']:>4}{target:>8.2f}{'':>8}{'':>8}{'':>8}{'':>9}  ✖ 素材缺失")
            bad += 1
            continue
        src_dur, k = build_segment(sid, src, target, dst, n_frames)
        real = probe_duration(dst)
        err = real - target
        ok = abs(err) <= TOL
        if not ok:
            bad += 1
        P(f"{sid:5}{sc['beats']:>4}{target:>8.2f}{src_dur:>8.2f}{k:>8.3f}{real:>8.2f}{err:>+9.3f}  "
          f"{'✔' if ok else '✖ 超差'}")
        rows.append((sid, dst))

    P("-" * 72)
    if bad:
        P(f"✖ {bad} 镜不合格，先修再拼（单镜误差上限 {TOL}s）")
        return 1

    if want:
        P("只建了指定镜头，未拼接。")
        return 0

    lst = os.path.join(outdir, "_concat.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for _, p in rows:
            f.write("file '" + p.replace("\\", "/") + "'\n")
    base = _film.p_out("base.mp4")
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "concat", "-safe", "0", "-i", lst,
                    "-c", "copy", base], check=True)
    total = probe_duration(base)
    expect = sum(sc["beats"] for sc in tl["scenes"]) * beat
    P(f"✔ 底板 {base}  {total:.3f}s  期望 {expect:.3f}s  差 {total - expect:+.3f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
