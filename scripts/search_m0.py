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

CUTS = [10.68, 19.23, 32.04, 44.86, 55.54, 66.22, 79.04, 89.72]
BEAT = 0.53406

def at(t):
    i = int(t * fps)
    if i < 0 or i + 1 >= len(flux):
        return -9.9
    return float(flux[i])

def score(M0, half_win=0.045):
    tot = 0.0
    for c in CUTS:
        # 在 c+M0 ±0.09s 内取最强 onset
        lo = int((c + M0 - 0.09) * fps); hi = int((c + M0 + 0.09) * fps)
        band = flux[lo:hi]
        tot += band.max()
    return tot / len(CUTS)

best = None
for M0 in np.arange(40.6, 41.6, 0.001):
    s = score(M0)
    if best is None or s > best[1]:
        best = (M0, s)
M0, s = best
print(f"暴力搜索最优 M0 = {M0:.4f}s   平均鼓点强度 {s:.4f}")
print(f"对比 41.0762 → {score(41.0762):.4f}   41.1242 → {score(41.1242):.4f}")

print("\n每个剪辑点在最优 M0 下的情况：")
for c in CUTS:
    lo = int((c + M0 - 0.09) * fps); hi = int((c + M0 + 0.09) * fps)
    band = flux[lo:hi]
    pk = lo + int(np.argmax(band))
    dev = (pk / fps) - (c + M0)
    print(f"  视频 {c:6.2f}s → 音乐 {c+M0:7.3f}s  最强鼓点在 {dev*1000:+5.0f} ms  强度 {band.max():6.3f}")

print(f"\n建议: -ss {M0:.4f}")
