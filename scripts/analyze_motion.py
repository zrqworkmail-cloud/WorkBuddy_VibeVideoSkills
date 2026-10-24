#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""从底板视频中提取「画面驱动信号」，让叠加层文字由真实画面驱动（而非估算）。

支持的测量模式：
  level_v  竖直 ROI 内的液面高度(0..1)——量筒/竖试管涨落
  level_h  水平 ROI 内的液面推进(0..1)——横向液柱推移
  bright   ROI 内平均亮度(0..1)——亮区明暗（如前额叶变暗、烛火）
  area     ROI 内「亮点」像素占比(0..1)——发光区域大小

打分指标 metric：
  lum    灰度均值（通用）
  cyan   (G+B)/2 - R，偏青绿的液体/辉光
  amber  (R+G)/2 - B，暖色发光体

输出 out/qc/drive_s<N>.json：
  scene / mode / metric / fps / dur / n / roi / raw / smooth
其中 smooth 为 5 帧滑动平均后的信号（0..1），叠加层 FNS 直接消费。

用法：python scripts/analyze_motion.py 3 level_v cyan
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
BASEDIR = os.path.join(ROOT, "out", "base")
QCDIR = os.path.join(ROOT, "out", "qc")

# 每个镜头需要测量的 ROI，归一化坐标 [x0, x1, y0, y1]（相对 1080x1920）
ROI = {
    "3":  [0.18, 0.82, 0.375, 0.625],   # s3 腺苷：人眼开合区（眼皮下垂 → 高度变小）
    "5":  [0.18, 0.82, 0.42, 0.88],     # s5 皮质醇：胸口/肩线（呼吸起伏）
    "6":  [0.60, 0.82, 0.50, 0.74],     # s6 多巴胺：手机屏幕（亮度闪动）
    "7":  [0.12, 0.88, 0.16, 0.92],     # s7 前额叶：整个人（运动量）
    "10": [0.18, 0.82, 0.28, 0.64],     # s10 入睡阈值：眼睛
    "11": [0.36, 0.66, 0.40, 0.70],     # s11 肾上腺素：颈侧柔光（搏动）
    "12": [0.12, 0.88, 0.24, 0.84],     # s12 杏仁核：肩背（惊颤）
    "9":  [0.10, 0.90, 0.18, 0.82],     # s9 黎明：整幅亮度（晨光渐亮 → 存款被冲掉）
}


def roi_gray(fr, roi):
    H, W = fr.shape[:2]
    x0 = max(0, min(W - 1, int(roi[0] * W)))
    x1 = max(x0 + 1, min(W, int(roi[1] * W)))
    y0 = max(0, min(H - 1, int(roi[2] * H)))
    y1 = max(y0 + 1, min(H, int(roi[3] * H)))
    return fr[y0:y1, x0:x1].mean(axis=2)


def decode_rgb(path, w=270, h=480):
    """以低分辨率流式读出 RGB 帧（避免整段驻留内存）。"""
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-i", path,
           "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                         bufsize=10 ** 8)
    fsz = w * h * 3
    while True:
        buf = p.stdout.read(fsz)
        if len(buf) < fsz:
            break
        yield np.frombuffer(buf, dtype=np.uint8).reshape(h, w, 3).astype(np.float32) / 255.0
    p.stdout.close()
    p.wait()


def chroma(fr, metric):
    r, g, b = fr[:, :, 0], fr[:, :, 1], fr[:, :, 2]
    if metric == "cyan":
        return (g + b) / 2 - r
    if metric == "amber":
        return (r + g) / 2 - b
    return fr.mean(axis=2)


def measure(fr, metric, roi, mode, thr=0.15):
    H, W = fr.shape[:2]
    x0 = max(0, min(W - 1, int(roi[0] * W)))
    x1 = max(x0 + 1, min(W, int(roi[1] * W)))
    y0 = max(0, min(H - 1, int(roi[2] * H)))
    y1 = max(y0 + 1, min(H, int(roi[3] * H)))
    m = chroma(fr[y0:y1, x0:x1], metric)          # ROI 内的打分图
    if mode == "bright":
        return float(m.mean())
    if mode == "area":
        thr = m.max() * 0.45
        return float((m > thr).mean())
    if mode == "level_v":
        # 液面 = 自上而下第一个「连续亮块」起点。
        # 用 metric 的绝对阈值（cyan 分能把液体与逆光辉光干净分开：
        # 辉光 ≈0.00，液体 +0.30~+0.59），并要求连续 K 行都亮，
        # 从而排除琥珀刻度线这类细亮线与辉光的误判。
        K = 14
        bright = (m > thr).mean(axis=1)
        n = len(bright)
        surface = n - 1
        for y in range(0, max(1, n - K)):
            if bright[y:y + K].min() > 0.5:
                surface = y
                break
        lvl = (n - 1 - surface) / (n - 1)
        return float(min(1.0, max(0.0, lvl)))
    if mode == "level_h":
        col = m.mean(axis=0) + 1e-6
        seg = (col - col.min()) / (col.max() - col.min() + 1e-9)
        right = np.where(seg > 0.98)[0]
        if len(right) == 0:
            return 0.0
        edge = right.max()
        return float((edge + 1) / col.shape[0])
    if mode == "height_v":
        # 竖直「亮块」的高度 / ROI 高度。
        # 用于人眼特写：眼皮下垂 → 眼白亮块变矮 → 数值下降 = 越困。
        bright = (m > thr).mean(axis=1)
        n = len(bright)
        rows = np.where(bright > 0.30)[0]      # 该行有 30% 以上像素是亮的即算眼白行
        if len(rows) < 4:
            return 0.0
        segs = np.split(rows, np.where(np.diff(rows) != 1)[0] + 1)
        seg = max(segs, key=len)          # 取最大连续亮块，忽略零散行
        return float(len(seg) / n)
    raise ValueError("未知模式 " + mode)


def smooth(a, k=5):
    """滑动平均（边缘复制填充，避免首尾被拉向 0 造成假下垂）。"""
    if len(a) < k:
        return a
    pad = k // 2
    ap = np.pad(np.asarray(a, dtype=float), pad, mode="edge")
    ker = np.ones(k) / k
    return np.convolve(ap, ker, mode="valid").tolist()


def main():
    sid = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "level_v"
    metric = sys.argv[3] if len(sys.argv) > 3 else "cyan"
    thr = float(sys.argv[4]) if len(sys.argv) > 4 else 0.15
    roi = ROI.get(sid)
    if roi is None:
        print(f"未配置 s{sid} 的 ROI")
        sys.exit(1)
    src = os.path.join(BASEDIR, f"base_s{sid}.mp4")
    if not os.path.exists(src):
        print("缺素材 " + src)
        sys.exit(1)
    p = subprocess.run([FF, "-hide_banner", "-i", src], capture_output=True, text=True)
    dur = 0.0
    for line in (p.stderr or "").splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].strip().split(",")[0].split(":")
            dur = int(h) * 3600 + int(m) * 60 + float(s)

    if mode == "motion":
        # 运动量：与上一帧在 ROI 内的平均绝对差。用于「长时间不动 → 突然一动」这类表演。
        sig, prev = [], None
        for fr in decode_rgb(src):
            g = roi_gray(fr, roi)
            sig.append(0.0 if prev is None else float(np.abs(g - prev).mean()))
            prev = g
    else:
        sig = [measure(fr, metric, roi, mode, thr) for fr in decode_rgb(src)]
    n = len(sig)
    fps = n / dur if dur else 24.0
    sm = smooth(sig)
    # 归一化到 0..1（供叠加层直接消费，避免受 ROI 绝对位置影响）
    lo, hi = min(sm), max(sm)
    norm = [round((v - lo) / (hi - lo + 1e-9), 4) for v in sm]
    os.makedirs(QCDIR, exist_ok=True)
    out = os.path.join(QCDIR, f"drive_s{sid}.json")
    json.dump({"scene": f"s{sid}", "mode": mode, "metric": metric, "thr": thr,
               "fps": round(fps, 3), "dur": round(dur, 4), "n": n, "roi": roi,
               "raw": [round(v, 4) for v in sig],
               "smooth": [round(v, 4) for v in sm],
               "norm": norm}, open(out, "w"))

    # 同时写 src/drive.js（file:// 下 fetch 会被拦，用 <script> 注入最稳），并合并其它镜头
    js_path = os.path.join(ROOT, "src", "drive.js")
    merged = {}
    if os.path.exists(js_path):
        txt = open(js_path, encoding="utf-8").read()
        try:
            merged = json.loads(txt.split("window.DRIVE =", 1)[1].rsplit(";", 1)[0])
        except Exception:
            merged = {}
    merged[f"s{sid}"] = {"fps": round(fps, 3), "dur": round(dur, 4), "n": n,
                         "raw": [round(v, 4) for v in sm], "norm": norm}
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.DRIVE = " + json.dumps(merged, ensure_ascii=False) + ";\n")
    print(f"✔ {js_path}（含 {len(merged)} 个镜头：{','.join(sorted(merged))}）")
    print(f"✔ {out}  {n} 帧 / {dur:.2f}s / {fps:.2f}fps")
    print(f"   原始信号 {lo:.3f} → {hi:.3f}（归一化后 0 → 1）")
    print(f"   归一化采样: 起 {norm[0]:.3f}  1/4 {norm[n//4]:.3f}  中 {norm[n//2]:.3f}  "
          f"3/4 {norm[3*n//4]:.3f}  末 {norm[-1]:.3f}")


if __name__ == "__main__":
    main()
