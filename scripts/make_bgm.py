#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""用【用户原始音乐】构建 BGM（bgm_final.m4a）。

源：D:/Users/Admin/Music/VibeKnowledgeBGM.mp4（用户指定，2:30）。
做法：
  1) 取音质最好的音轨解码为 bgm_source.wav；
  2) 谱通量 onset 检测 + 暴力搜索起点 M0，使 9 个镜头的剪辑点尽量落在鼓点上
     （剪辑点从 timeline.json 自动累计，永不与时间轴脱节）；
  3) 从 M0 起裁出与成片等长的音频；**若原始音乐不够长，则循环补齐**（拍长为整数倍，
     保证循环点不破坏节拍相位）；
  4) 轻量归一化到约 -16 LUFS + 头尾淡入淡出，写 bgm_final.m4a。

用法：python scripts/make_bgm.py
"""
import json
import os
import subprocess
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
SRC_MUSIC = "D:/Users/Admin/Music/VibeKnowledgeBGM.mp4"
OUTDIR = os.path.join(ROOT, "out", "audio")
SRC_WAV = os.path.join(OUTDIR, "bgm_source.wav")
OUT_M4A = os.path.join(OUTDIR, "bgm_final.m4a")

TARGET_LUFS = -16.0     # 在线视频通用口响
FADE_IN, FADE_OUT = 1.2, 2.6


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "")[-1500:])


def probe_dur(path):
    p = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    for line in (p.stderr or "").splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].strip().split(",")[0].split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError("读不到时长 " + path)


def main():
    # ---------- 1. 时间轴 ----------
    tl = json.load(open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf-8"))
    BEAT = tl.get("beatSec", 60.0 / tl["bpm"])
    BAR = 4 * BEAT
    cuts, t = [], 0.0
    for i, sc in enumerate(tl["scenes"]):
        t += sc["beats"] * BEAT
        if i < len(tl["scenes"]) - 1:      # 镜头之间的切换点才算剪辑点
            cuts.append(round(t, 4))
    VIDEO_DUR = round(t, 4)
    print(f"成片时长 {VIDEO_DUR}s / {tl['bpm']} BPM / 剪辑点 {len(cuts)} 个：{cuts}")

    # ---------- 2. 解码原始音乐 ----------
    # 注意：源文件是「音乐视频」（含 hevc 画面），只有一条 AAC 音轨；用 -vn 只取音频。
    os.makedirs(OUTDIR, exist_ok=True)
    run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", SRC_MUSIC,
         "-vn", "-map", "0:a:0", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", SRC_WAV])
    SRC_DUR = probe_dur(SRC_WAV)
    print(f"原始音乐 {SRC_DUR:.2f}s → {SRC_WAV}")

    w = wave.open(SRC_WAV, "rb")
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    x = x.reshape(-1, 2).mean(axis=1)
    w.close()

    # ---------- 3. 谱通量 onset ----------
    SR, HOP, NFFT = 22050, 128, 2048
    win = np.hanning(NFFT)
    nf = 1 + (len(x) - NFFT) // HOP
    S = np.empty((nf, NFFT // 2 + 1), dtype=np.float32)
    CH = 4096
    for i in range(0, nf, CH):
        seg = np.lib.stride_tricks.sliding_window_view(
            x[i * HOP:i * HOP + CH * HOP + NFFT][:CH * HOP + NFFT], NFFT)[::HOP][:min(CH, nf - i)]
        S[i:i + len(seg)] = np.abs(np.fft.rfft(seg * win, axis=1))
    flux = np.log1p(np.maximum(S[1:] - S[:-1], 0).sum(axis=1) * 200)
    flux -= flux.mean()
    fps = SR / HOP

    def score(M0, half=0.075):
        tot = 0.0
        for c in cuts:
            lo = int((c + M0 - half) * fps)
            hi = int((c + M0 + half) * fps)
            tot += flux[max(0, lo):hi].max()
        return tot / len(cuts)

    # ---------- 4. 搜索起点 M0 ----------
    # 关键：8 个剪辑点彼此相距都是"整小节"的倍数（4/8/16/24/32/40/48/53 小节）。
    # 因此只要把【第一个剪辑点】对准音乐里一个真实的鼓点 onset，其余剪辑点会自动落在强拍上。
    single_max = SRC_DUR - VIDEO_DUR - 0.05
    lo_hi = (0.5, single_max) if single_max > 1.0 else (0.5, 26.0)

    # onset 峰值列表（局部极大 + 阈值）
    TH = np.percentile(flux, 90)
    peaks = [i / fps for i in range(2, len(flux) - 2)
             if flux[i] >= max(flux[i - 2:i + 3]) and flux[i] > TH]

    def dev(M0):
        out = []
        for c in cuts:
            d = int((c + M0) * fps)
            band = flux[max(0, d - int(0.09 * fps)):d + int(0.09 * fps)]
            pk = (max(0, d - int(0.09 * fps)) + int(np.argmax(band))) / fps
            out.append(pk - (c + M0))
        return np.array(out)

    def flux_at(t):
        i = int(t * fps)
        return float(flux[i]) if 0 <= i < len(flux) else -9.9

    def combined(mean_flux, mean_absdev):
        return mean_flux - 12.0 * mean_absdev      # 偏离越多，惩罚越重

    # ① 全网格粗搜；② 用「任一剪辑点吸附到任一 onset」精修（可吸收音乐本身的速度漂移）
    best = None
    for M0 in np.arange(lo_hi[0], lo_hi[1], 0.02):
        mf = float(np.mean([flux_at(c + M0) for c in cuts]))
        s = combined(mf, 0.0)
        if best is None or s > best[0]:
            best = (s, mf, 0.0, float(M0))
    for p in peaks:
        for c0 in cuts:
            M0 = float(p - c0)
            if not (lo_hi[0] <= M0 <= lo_hi[1]):
                continue
            d = dev(M0)
            mf = float(np.mean([flux_at(c + M0) for c in cuts]))
            s = combined(mf, float(np.mean(np.abs(d))))
            if s > best[0]:
                best = (s, mf, float(np.mean(np.abs(d))), M0)
    _, mf, mad, M0 = best
    NEED_LOOP = single_max <= 1.0
    print(f"起点 M0 = {M0:.4f}s   平均鼓点强度 {mf:.4f}   平均偏差 {mad * 1000:.0f} ms"
          f"   {'循环播放' if NEED_LOOP else '单次播放'}")

    print("\n各剪辑点对齐情况：")
    for c in cuts:
        lo = int((c + M0 - 0.09) * fps)
        hi = int((c + M0 + 0.09) * fps)
        pk = lo + int(np.argmax(flux[lo:hi]))
        print(f"  视频 {c:7.2f}s → 音乐 {c + M0:7.3f}s  偏差 {((pk / fps) - (c + M0)) * 1000:+5.0f} ms")

    # ---------- 5. 生成 bgm_final.m4a ----------
    if NEED_LOOP:
        reps = int(np.ceil(VIDEO_DUR / trim)) + 1
        run([FF, "-hide_banner", "-loglevel", "error", "-y", "-stream_loop", str(reps - 1),
             "-t", f"{trim:.6f}", "-i", SRC_WAV, "-t", f"{trim * reps:.6f}",
             "-ac", "2", "-ar", "44100", os.path.join(OUTDIR, "bgm_loop.wav")])
        base = os.path.join(OUTDIR, "bgm_loop.wav")
    else:
        base = SRC_WAV
    run([FF, "-hide_banner", "-loglevel", "error", "-y",
         "-ss", f"{M0:.6f}", "-i", base, "-t", f"{VIDEO_DUR:.6f}",
         "-map", "0:a:0",
         "-af", (f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11,"
                 f"afade=t=in:st=0:d={FADE_IN},afade=t=out:st={VIDEO_DUR - FADE_OUT:.3f}:d={FADE_OUT}"),
         "-ar", "44100", "-ac", "2",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT_M4A])
    got = probe_dur(OUT_M4A)
    print(f"\n✔ {OUT_M4A}  {got:.2f}s  {os.path.getsize(OUT_M4A) / 1048576:.2f} MB")


if __name__ == "__main__":
    main()
