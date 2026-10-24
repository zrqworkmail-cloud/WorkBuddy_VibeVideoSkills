#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""程序化合成 BGM：90 BPM / A 小调，101.333s。拍点与镜头剪辑点严格对齐。"""
import numpy as np
import wave
import json
import os

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "out", "audio")

with open(os.path.join(ROOT, "src", "timeline.json"), "r", encoding="utf-8") as f:
    TL = json.load(f)
BPM = TL["bpm"]
BEAT = 60.0 / BPM
BAR = 4 * BEAT
DUR = (2 * BEAT) + 0.0
SCENES = TL["scenes"]
DUR = sum(s["beats"] for s in SCENES) * BEAT
# 自行累计各镜 start：只依赖 timeline.json，与 build_timeline.py 的算法保持一致
_t = 0.0
for _s in SCENES:
    _s["start"] = _t
    _t += _s["beats"] * BEAT
N = int(SR * DUR)

# ---------------- 工具 ----------------
def hz(semi):                     # 相对 A4 的半音
    return 440.0 * 2.0 ** (semi / 12.0)

def env(dur, a, d, s, r):
    n = int(dur * SR)
    na, nd, nr = max(1, int(a * SR)), max(1, int(d * SR)), max(1, int(r * SR))
    ns = max(0, n - na - nd - nr)
    e = np.zeros(n)
    e[:na] = np.linspace(0, 1, na)
    e[na:na + nd] = np.linspace(1, s, nd)
    if ns:
        e[na + nd:na + nd + ns] = s
    e[-nr:] = np.linspace(e[-nr] if ns else 1, 0, nr)
    return e

def place(buf, sig, at, gain=1.0):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[:j - i] * (gain if np.isscalar(gain) else gain[:j - i])

def sine(freq, dur):
    return np.sin(2 * np.pi * np.cumsum(np.full(int(dur * SR), freq)) / SR)

def sweep(f0, f1, dur):
    n = int(dur * SR)
    return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, n)) / SR)

def pluck(freq, dur):
    tt = np.arange(int(dur * SR)) / SR
    e = np.exp(-tt * (11.0 + freq / 380.0))
    return (np.sin(2 * np.pi * freq * tt)
            + 0.32 * np.sin(2 * np.pi * freq * 2 * tt)
            + 0.12 * np.sin(2 * np.pi * freq * 3 * tt)) * e

def padnote(freq, dur):
    """微失谐三角波，柔和铺底"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return sum(2 * (tt * freq * d - np.floor(tt * freq * d + 0.5)) for d in (0.998, 1.0, 1.003)) / 3

def comb(x, d, g, taps):
    y = x.copy()
    for m in range(1, taps + 1):
        y[m * d:] += (g ** m) * x[:-m * d]
    return y

def reverb(x, mix=0.35, decay=2.0):
    """4 抽头反馈梳状混响（向量化）"""
    taps = max(6, int(decay * SR / (0.045 * SR)))
    out = x.copy()
    for f, g in ((0.029, .86), (0.037, .82), (0.041, .80), (0.053, .77)):
        out += comb(x, max(1, int(f * SR)), g, taps) * (mix / 4)
    return out

def lp(x, fc):
    """一阶低通，逐块向量化"""
    y = np.empty_like(x)
    a = np.exp(-2 * np.pi * fc / SR)
    np.multiply(x, (1 - a) / (1 - a), out=y[:0]) if False else None
    # 向量化一阶 IIR：按块递归
    out = np.empty_like(x)
    acc = 0.0
    k = 1 - a
    for i in range(0, len(x), 4096):
        blk = x[i:i + 4096]
        b = np.empty_like(blk)
        z = acc
        for j in range(len(blk)):
            z = a * z + k * blk[j]
            b[j] = z
        out[i:i + 4096] = b
        acc = z
    return out

rng = np.random.default_rng(11)
NH = rng.standard_normal(int(0.5 * SR))
NC = rng.standard_normal(int(0.5 * SR))
NW = rng.standard_normal(int(3.0 * SR))

def hat(open_):
    n = int((0.30 if open_ else 0.05) * SR)
    x = NH[:n] * np.exp(-np.arange(n) / SR * (9 if open_ else 150))
    return np.diff(x, prepend=0.0)

def clap():
    n = int(0.30 * SR)
    y = np.zeros(n)
    for off, g in ((0, 1.0), (0.013, .8), (0.028, .55), (0.05, .3)):
        i = int(off * SR)
        y[i:] += NC[:n - i] * np.exp(-np.arange(n - i) / SR * 30) * g
    return y

def riser():
    n = int(2.0 * SR)
    x = np.diff(NW[:n], prepend=0.0) * np.linspace(0.15, 1.0, n)
    x = np.abs(x) * np.linspace(0.1, 1, n)
    x += sweep(180, 6000, 2.0) * 0.05 * np.linspace(0.2, 1, n)
    return x / (np.max(np.abs(x)) + 1e-9)

# ---------------- 乐理：A 小调，VI–I–IV–II ----------------
CH = [
    ("Am9",     [57, 64, 67, 69, 76]),
    ("Fmaj7",   [53, 60, 65, 69, 72]),
    ("Cmaj7",   [48, 55, 60, 64, 67]),
    ("Gsus2",   [55, 62, 67, 74, 79]),
]
BASS_NOTE = [33, 29, 24, 31]
SCENE_BARS = sorted({int(round(s["start"] / BAR)) for s in SCENES})
NBARS = int(round(DUR / BAR))
print(f"BPM {BPM} · beat {BEAT:.4f}s · bar {BAR:.4f}s · {DUR:.3f}s · {NBARS} bars")
print(f"转场小节: {SCENE_BARS}")

L = np.zeros(N)
R = np.zeros(N)
KENV = np.zeros(N)
RISER_S = riser()

# ---- 第一遍：先把底鼓打进侧链包络 ----
KICKS = []
for bar in range(NBARS):
    t0 = bar * BAR
    if bar >= 1:
        for b, g in ((0, 1.0), (2, .9), (1.5, .45 if bar % 2 else .3)):
            KICKS.append((t0 + b * BEAT, g))
        if bar % 4 == 3:
            KICKS.append((t0 + 3.5 * BEAT, .5))
for at, g in KICKS:
    s = sweep(130, 44, 0.24) * env(0.24, .002, .10, 0.0, .14) * g
    i = int(at * SR)
    KENV[i:i + len(s)] = np.maximum(KENV[i:i + len(s)], np.abs(s))

# ---- 第二遍：正式混音 ----
for bar in range(NBARS):
    t0 = bar * BAR
    name, chord = CH[bar % 4]
    bn = BASS_NOTE[bar % 4]
    i0 = int(t0 * SR)
    Lbar = int(BAR * SR)

    # 铺底 pad（带侧链泵动）
    pad = np.zeros(Lbar)
    for st in chord:
        pad += padnote(hz(st), BAR) * 0.16
    pad = lp(pad, 420 + 520 * min(1, bar / 5)) * 8.0
    pad += reverb(pad, mix=0.4, decay=1.7)
    pump = np.clip(1.0 - 0.55 * KENV[i0:i0 + len(pad)][:len(pad)], 0.4, 1.0)
    place(L, pad, t0, 0.34 * pump)
    place(R, pad, t0, 0.34 * pump * 0.94)

    # 低音：1、3 拍
    if bar >= 0:
        for b in (0, 2):
            s = sine(hz(bn), BEAT * 1.7) * env(BEAT * 1.7, .01, .2, .72, .3)
            place(L, s, t0 + b * BEAT, .5)
            place(R, s, t0 + b * BEAT, .5)

    # 鼓
    if bar >= 1:
        # 踩镲 16 分
        for h in range(16):
            if h in (2, 6, 10, 14):
                continue
            opn = (h % 4 == 2) and bar % 4 == 3
            g = (0.20 if h % 2 == 0 else 0.11) + (0.09 if h % 4 == 0 else 0)
            s = hat(opn)
            place(L, s, t0 + h * BEAT / 4, g)
            place(R, s, t0 + h * BEAT / 4, g * .9)
        if bar % 2 == 1:
            place(L, clap(), t0 + 2 * BEAT, .28)
            place(R, clap(), t0 + 2 * BEAT, .28)

        # 琶音 8 分
        for e in range(8):
            st = chord[(e * 2 + bar) % len(chord)]
            f = hz(st + (12 if e % 3 else 0))
            p = pluck(f, 0.45)
            pr = reverb(p, mix=0.5, decay=1.2)
            place(L, p + pr, t0 + e * BEAT / 2, .15)
            place(R, p + pr, t0 + e * BEAT / 2, .15 * (1 - 0.35 * abs(np.sin(e * 1.7))))

    # 段落标记
    if bar in SCENE_BARS:
        boom = sweep(150, 40, 0.95) * env(0.95, .002, .25, 0.0, .65)
        place(L, boom, t0, .42); place(R, boom, t0, .42)
    if (bar - 1) in SCENE_BARS:
        place(L, RISER_S, t0, .14); place(R, RISER_S, t0, .14)

# 收束：最后两小节回到主和弦
eb = NBARS - 2
for k in range(8):
    at = eb * BAR + k * BEAT / 2
    st = [57, 60, 64, 67, 69, 72, 76, 79][k]
    s = pluck(hz(st), 1.5) * env(1.5, .01, .4, .25, .6)
    r = reverb(s, mix=0.6, decay=2.4)
    place(L, s + r, at, .26); place(R, s + r, at, .26)

# ---- 淡入淡出 ----
FI, FO = 1.8, 3.4
g = np.ones(N)
g[:int(FI * SR)] = np.linspace(0, 1, int(FI * SR)) ** 1.5
g[-int(FO * SR):] = np.linspace(1, 0, int(FO * SR)) ** 1.5
L *= g
R *= g

# ---- 软限幅 + 归一化 ----
L = np.tanh(L * 1.25) / np.tanh(1.25)
R = np.tanh(R * 1.25) / np.tanh(1.25)
pk = max(np.max(np.abs(L)), np.max(np.abs(R)))
L *= 0.92 / pk
R *= 0.92 / pk

os.makedirs(OUTDIR, exist_ok=True)
p = os.path.join(OUTDIR, "bgm.wav")
d = np.empty((N, 2), dtype=np.int16)
d[:, 0] = (np.clip(L, -1, 1) * 32767).astype(np.int16)
d[:, 1] = (np.clip(R, -1, 1) * 32767).astype(np.int16)
w = wave.open(p, "wb")
w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(d.tobytes())
w.close()
print("✔", p, f"{os.path.getsize(p)/1048576:.1f} MB", f"{DUR:.2f}s")
