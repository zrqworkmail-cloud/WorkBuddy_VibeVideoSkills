#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""在节拍网格基础上求：重拍相位、逐小节能量、最佳使用区间。"""
import numpy as np
import wave
import os
import json

SR = 22050
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BJ = json.load(open(os.path.join(HERE, "out", "audio", "beats.json")))

w = wave.open(os.path.join(HERE, "out", "audio", "bgm_source.wav"), "rb")
n = w.getnframes(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
x = x.reshape(-1, ch).mean(axis=1)[::44100 // SR]
w.close()

NFFT, HOP = 2048, 256
win = np.hanning(NFFT)
nf = 1 + (len(x) - NFFT) // HOP
spec = np.empty((nf, NFFT // 2 + 1), dtype=np.float32)
B = 4096
for i in range(0, nf, B):
    seg = np.lib.stride_tricks.sliding_window_view(
        x[i * HOP:i * HOP + B * HOP + NFFT][:B * HOP + NFFT], NFFT)[::HOP][:B]
    spec[i:i + len(seg)] = np.abs(np.fft.rfft(seg * win, axis=1))
flux = np.log1p(np.maximum(spec[1:] - spec[:-1], 0).sum(axis=1) * 200)
flux -= flux.mean()
fps = SR / HOP

BEAT = BJ["beat"]
PHASE = BJ["phase"]
BAR = BEAT * 4
NBARS = int((len(flux) / fps - PHASE) / BAR) + 1
print(f"beat {BEAT:.5f}s · bar {BAR:.5f}s · 相位 {PHASE:.4f}s · 小节数 {NBARS}")

# ---- 重拍相位：哪个 beat mod 4 是 downbeat ----
starts = PHASE + np.arange(nf) * 0  # placeholder
best = None
for k in range(4):
    tot = 0.0
    cnt = 0
    for bt in np.arange(PHASE, len(flux) / fps, BEAT):
        fi = int((bt + k * BEAT) * fps)
        if 0 <= fi < len(flux):
            tot += max(0.0, flux[fi]); cnt += 1
    if cnt:
        print(f"  downbeat offset {k}: 平均 onset 强度 {tot/cnt:.5f}  ({cnt} 拍)")
        if best is None or tot / cnt > best[1]:
            best = (k, tot / cnt)
DOWN = best[0]
print(f"→ downbeat offset = {DOWN}（每小节第一拍）")

# ---- 逐小节能量 ----
env = np.abs(x)
w2 = int(0.25 * SR)
e = np.convolve(env, np.ones(w2) / w2, "same")
rms = []
for b in range(NBARS):
    t0 = PHASE + b * BAR
    seg = e[int(t0 * SR):int((t0 + BAR) * SR)]
    rms.append(float(np.sqrt((seg ** 2).mean()) + 1e-12))
rms = np.array(rms)

def show(sel):
    for b in sel:
        r = rms[b]
        db = 20 * np.log10(r + 1e-9)
        print(f"   bar {b:3d}  {b*BAR+PHASE:7.2f}s  {db:6.1f} dB  {'#'*max(0,int((db+44)*1.4))}")
print("\n逐小节能量：")
show(range(0, NBARS))

# ---- 选 47 小节窗口：整体够响 + 结尾需进入收束区 ----
W = 47
bestw = None
for s in range(0, NBARS - W + 1):
    seg = rms[s:s + W]
    head = seg[:9].mean()                       # 钩子段要够撑
    body = seg[9:W - 5].mean()
    tail = seg[W - 5:].mean()                    # 结尾偏收束
    bodyw = seg[int(W * .55):int(W * .85)].mean()   # 中后段要有峰值
    score = 0.55 * bodyw + 0.30 * body + 0.15 * head
    if tail > bodyw * 1.25:                      # 结尾别炸
        score *= 0.55
    if bestw is None or score > bestw[1]:
        bestw = (s, score, head, body, tail, bodyw)
s = bestw[0]
print(f"\n最佳起点 = 小节 {s}（音乐 {s*BAR+PHASE:.3f}s）  score {bestw[1]:.5f}")
print(f"  起段 {bestw[2]:.4f} 中段 {bestw[3]:.4f} 峰值 {bestw[5]:.4f} 尾段 {bestw[4]:.4f}")
print(f"  → 使用区间: {s*BAR+PHASE:.3f}s ~ {s*BAR+PHASE+W*BAR:.3f}s  ({W*BAR:.2f}s)")

# 第一个可用 downbeat
first_down = PHASE + s * BAR
json.dump({
    "bpm": BJ["bpm"], "beat": BEAT, "phase": PHASE, "downbeat": DOWN,
    "bar": BAR, "nbars": NBARS, "bar_rms": [round(v, 6) for v in rms.tolist()],
    "music_start": round(float(first_down), 4),
    "bars_used": W, "duration": round(W * BAR, 4)
}, open(os.path.join(HERE, "out", "audio", "grid.json"), "w"), indent=1)
print("✔ out/audio/grid.json")
