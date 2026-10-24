#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""分析 BGM 的真实 BPM、重拍相位与每拍位置，供剪辑对齐。"""
import numpy as np
import wave
import os
import json
import sys

SR = 22050
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WAV = os.path.join(HERE, "out", "audio", "bgm_source.wav")

w = wave.open(WAV, "rb")
n = w.getnframes()
ch = w.getnchannels()
raw = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
w.close()
x = raw.reshape(-1, ch).mean(axis=1)
x = x[::44100 // SR]
dur = len(x) / SR
print(f"源音频 {dur:.3f}s  {SR}Hz  mono")

# ---------- 1. STFT + 谱通量 onset 强度 ----------
NFFT, HOP = 2048, 256
win = np.hanning(NFFT)
frames = 1 + (len(x) - NFFT) // HOP
spec = np.empty((frames, NFFT // 2 + 1), dtype=np.float32)
for i in range(frames):
    seg = x[i * HOP:i * HOP + NFFT] * win
    spec[i] = np.abs(np.fft.rfft(seg))
flux = np.maximum(spec[1:] - spec[:-1], 0).sum(axis=1)   # 谱通量
flux = np.log1p(flux * 200)
flux = flux - flux.mean()
fps = SR / HOP

# ---------- 2. 自相关求 BPM ----------
lo, hi = int(0.28 * fps), int(1.4 * fps)          # 43~214 BPM
ac = np.correlate(flux, flux, "full")[len(flux) - 1:]
ac[:lo] = 0
ac[hi:] = 0
period = int(np.argmax(ac))
bpm0 = 60.0 * fps / period
# 半/倍速归一化到 [90, 150]
bpm = bpm0
while bpm < 90:
    bpm *= 2
while bpm > 150:
    bpm /= 2
print(f"自相关周期 {period} 帧 = {period/fps:.4f}s → 原始 {bpm0:.1f} BPM → 归一 {bpm:.1f} BPM")

# 在真实周期附近微调（半拍细分）
cands = []
for p in range(max(lo, int(period * 0.45)), min(hi, int(period * 1.55))):
    cands.append((ac[p], p))
best = max(cands)[1]
# ---------- 3. 相位：用高斯梳对到最强 onset ----------
PERIOD_FRAMES = best
sc = []
for ph in range(PERIOD_FRAMES):
    idx = np.arange(ph, frames - 1, PERIOD_FRAMES)
    sc.append(flux[idx].mean())
ph = int(np.argmax(sc))
beat_times = (np.arange(ph, frames, PERIOD_FRAMES)) / fps
print(f"拍长 {PERIOD_FRAMES/fps:.4f}s  相位 {ph/fps:.3f}s  检测到 {len(beat_times)} 拍")

# ---------- 4. 能量包络，找段落强弱 ----------
env = np.abs(x)
w2 = int(0.2 * SR)
e = np.convolve(env, np.ones(w2) / w2, "same")
print("\n结构（按 8 秒窗口的 RMS）：")
for s in range(0, int(dur), 8):
    seg = e[int(s * SR):int((s + 8) * SR)]
    print(f"  {s:3d}-{s+8:3d}s  rms {20*np.log10(seg.std()+1e-9):7.2f} dB  {'#'*max(0,int(30+20*np.log10(seg.std()+1e-9)))}")

json.dump({
    "bpm": round(bpm, 2),
    "beat": PERIOD_FRAMES / fps,
    "phase": ph / fps,
    "duration": dur,
    "beats": [round(float(b), 4) for b in beat_times]
}, open(os.path.join(HERE, "out", "audio", "beats.json"), "w"), indent=1)
print("\n✔ out/audio/beats.json")
