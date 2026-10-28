"""
合成音效轨（纯代码，无外部素材）：
- 马蹄：S6 驿马段（46–54s）
- 战鼓：S9 万岁段（74–80s）
- 开城低频轰鸣：S10（86–88s）
- 钟声：受禅（95s）
输出 out/sfx.wav（与视频等长 213s，立体声）
"""
import numpy as np, wave, sys

SR = 44100
DUR = 213.0
N = int(SR * DUR)
out = np.zeros(N, dtype=np.float32)

def add(sig, t0, gain=1.0):
    i = int(t0 * SR)
    n = min(len(sig), N - i)
    if n > 0:
        out[i:i+n] += sig[:n] * gain

def env_ad(n, a=0.005, d=0.15):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(int(a * SR), 1)
    e[:na] *= np.linspace(0, 1, na)
    return e

def drum(f0=62, dur=0.45, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 0.7 * np.exp(-t / 0.03))          # 起音下滑
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.002, 0.16)
    noise = np.random.RandomState(1).randn(n) * np.exp(-t / 0.03) * 0.25
    return (sig + noise) * gain

def hoof(dur=0.09, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rs = np.random.RandomState(7)
    noise = rs.randn(n) * np.exp(-t / 0.02)
    tone = np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.035) * 0.5
    return (noise * 0.6 + tone) * gain

def gong(dur=3.2, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    parts = [220, 330, 440, 560, 720]
    sig = sum(np.sin(2 * np.pi * p * t) / (i + 1.6) for i, p in enumerate(parts))
    return sig * env_ad(n, 0.004, 1.1) * gain

def rumble(dur=2.2, gain=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rs = np.random.RandomState(3)
    low = rs.randn(n)
    # 简易低通
    k = 0.02
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        acc += k * (low[i] - acc)
        y[i] = acc
    return y * env_ad(n, 0.02, 0.9) * 8 * gain

# 马蹄：46–54s，0.16s 一踏
t = 49.0
while t < 57.0:
    add(hoof(gain=0.5), t)
    add(hoof(gain=0.35), t + 0.08)
    t += 0.16

# 战鼓：74–81s，0.5s 一击，重音每 4 拍
t = 74.0
i = 0
while t < 81.0:
    add(drum(gain=1.0 if i % 4 == 0 else 0.55), t)
    t += 0.5
    i += 1

# 开城轰鸣
add(rumble(gain=1.0), 89.0)
add(drum(48, 0.9, 1.1), 89.0)

# 钟声（受禅）
add(gong(gain=0.9), 98.0)
add(gong(gain=0.5), 98.6)

# 归一化
peak = np.max(np.abs(out))
if peak > 0:
    out = out / peak * (10 ** (-8 / 20))
stereo = np.column_stack([out, out])
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
with wave.open('out/sfx.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("WROTE out/sfx.wav  peak=%.1f dBFS" % (20*np.log10(np.max(np.abs(out))+1e-9)))
