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
BEAT = 0.53406
CUTS = [10.68, 19.23, 32.04, 44.86, 55.54, 66.22, 79.04, 89.72]

def score(delta):
    tot, n = 0.0, 0
    for c in CUTS:
        i = int((c + delta) * fps)
        band = flux[i - int(0.05 * fps): i + int(0.05 * fps)]
        ref = flux[i - int(0.25 * fps): i + int(0.25 * fps)]
        if len(band):
            tot += band.mean() - 0.5 * ref.mean()
            n += 1
    return tot / max(n, 1)

best = None
for d in np.arange(-BEAT / 2, BEAT / 2, 0.004):
    s = score(d)
    if best is None or s > best[1]:
        best = (d, s)
d0, s0 = best
print(f"最优偏移 δ = {d0:+.4f}s   score {s0:.4f}")
print(f"  → 音乐起点应后移 {d0:+.4f}s")

# 逐一校验
print("\n各剪辑点校正后的 onset 强度：")
for c in CUTS:
    i = int((c + d0) * fps)
    band = flux[i - int(0.05 * fps): i + int(0.05 * fps)]
    ref = flux[i - int(0.25 * fps): i + int(0.25 * fps)]
    r = band.mean() / (abs(ref.mean()) + 1e-6)
    print(f"  {c:6.2f}s  强度 {band.mean():7.3f}   相对 {r:6.2f}")

# 残余漂移：把 8 个点当作一串，检查是否单调恶化
print("\n漂移检查（对位残差随时间是否增大）：")
for c in CUTS:
    loc = c + d0
    k = loc / BEAT
    print(f"  {c:6.2f}s  网格位置 {k:7.3f} 拍  小数部分 {k - round(k):+.3f}")
