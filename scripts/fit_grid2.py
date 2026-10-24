import numpy as np, wave, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
w = wave.open(os.path.join(ROOT, "out", "audio", "final_audio.wav"), "rb")
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
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

# ---- 1. 峰值检测 ----
thr = np.percentile(flux, 88)
minsep = int(0.22 * fps)
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
print(f"检测到 {len(pt)} 个鼓点（阈值 {thr:.2f}）")
print(f"前 12 个: {np.round(pt[:12],3).tolist()}")

# ---- 2. 若有个别拍缺失，补全网格 ----
d = np.diff(pt)
print(f"相邻间隔中位数 {np.median(d):.4f}s  均值 {d.mean():.4f}s")
BEAT = float(np.median(d))
print(f"→ 主拍长 {BEAT:.5f}s ({60/BEAT:.2f} BPM)")

# ---- 3. 相位：让最多鼓点落在网格上 ----
best = None
for ph in np.arange(0, BEAT, 0.002):
    grid = np.arange(ph, T, BEAT)
    hit = 0
    for g in grid:
        if np.min(np.abs(pt - g)) < 0.035:
            hit += 1
    if best is None or hit > best[0]:
        best = (hit, ph)
hit, ph = best
print(f"相位 {ph:.4f}s  命中 {hit}/{len(grid)} 个网格点  ({hit/len(grid)*100:.0f}%)")

# ---- 4. 逐点校验 ----
grid = np.arange(ph, T, BEAT)
err = []
for g in grid:
    e = np.min(np.abs(pt - g), initial=9)
    if e < 0.06:
        err.append(g - e if pt[np.argmin(np.abs(pt - g))] > g else g - e)
err = np.array(err)
print(f"对位误差: 均值 {err.mean():+.4f}s  标准差 {err.std():.4f}s  |最大| {np.abs(err).max():.4f}s")
drift = np.polyfit(np.arange(len(err)), err, 1)[0]
print(f"线性漂移 {drift*1e6:.1f} µs/拍 → 100s 累积 {drift*188*1000:.1f} ms")

cuts = [10.68, 19.23, 32.04, 44.86, 55.54, 66.22, 79.04, 89.72]
print("\n剪辑点对位（用实测网格）：")
for c in cuts:
    k = (c - ph) / BEAT
    nearest = ph + round(k) * BEAT
    print(f"  {c:6.2f}s → 拍点 {nearest:6.2f}s  差 {c-nearest:+.3f}s")
print(f"\n音乐起始修正量 = {ph:.4f}s（正数=起点应后移）")
