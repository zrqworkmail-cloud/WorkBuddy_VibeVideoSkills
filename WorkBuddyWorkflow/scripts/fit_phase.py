import numpy as np, wave, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
w = wave.open(os.path.join(ROOT, "out", "audio", "bgm_source.wav"), "rb")
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
x = x.reshape(-1, 2).mean(axis=1)
SR = 22050; HOP = 128; NFFT = 2048; win = np.hanning(NFFT)
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
T = len(flux) / fps

# 限幅半拍内只取一个峰
thr = np.percentile(flux, 90)
minsep = int(0.25 * fps)
peaks = []
i = 1
while i < len(flux) - 1:
    if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] > flux[i + 1]:
        if peaks and i - peaks[-1] < minsep:
            if flux[i] > flux[peaks[-1]]:
                peaks[-1] = i
        else:
            peaks.append(i)
        i += minsep
    else:
        i += 1
pt = np.array(peaks) / fps
print(f"{len(pt)} 个主鼓点")

# 只在 30~145s 内拟合（我们要用的区间）
m = (pt > 30) & (pt < 145)
sub = pt[m]
BEAT = 0.53406
best = None
for ph in np.arange(0, BEAT, 0.0015):
    hit = 0
    for g in np.arange(ph + 30, 145, BEAT):
        if np.min(np.abs(sub - g)) < 0.03:
            hit += 1
    n = len(np.arange(ph + 30, 145, BEAT))
    r = hit / n
    if best is None or r > best[0]:
        best = (r, ph, hit, n)
r, ph, hit, n = best
print(f"拍长固定 {BEAT}s · 30~145s 内相位 {ph:.4f}s · 命中率 {hit}/{n} = {r*100:.0f}%")

# 允许轻微漂移的线性拟合
e = []
for g in np.arange(ph + 30, 145, BEAT):
    j = np.argmin(np.abs(sub - g))
    if abs(sub[j] - g) < 0.08:
        e.append((g, sub[j] - g))
e = np.array(e)
slope, ic = np.polyfit(e[:, 0], e[:, 1], 1)
print(f"线性残差: 斜率 {slope*1000:+.3f} ms/s → 100s 漂移 {slope*100*1000:+.1f} ms")

# 目标：让 41.08s 附近某个拍点成为视频 t=0
cands = np.arange(ph + 25, ph + 50, BEAT)
cands = cands[abs(cands - 41.08) < BEAT]
print(f"\n41.08s 附近的拍点: {[round(float(c),4) for c in cands]}")
M0 = float(cands[0])
print(f"→ 建议音乐起点 M0 = {M0:.4f}s")
print("   （该点在 41.08 +" f"{M0-41.08:+.4f}s 处）")
