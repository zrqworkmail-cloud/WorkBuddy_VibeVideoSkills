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
print(f"音频时长 {T:.3f}s  帧率 {fps:.2f}/s")

best = None
for p in np.arange(0.500, 0.575, 0.0004):
    for ph in np.arange(0, p, 0.004):
        idx = np.arange(int(ph * fps), int(T * fps), int(round(p * fps)))
        idx = idx[idx < len(flux)]
        if len(idx) < 20:
            continue
        s = float(flux[idx].mean())
        # 惩罚相邻拍强度差过大（应稳定踩点）
        s -= 0.35 * float(np.abs(np.diff(flux[idx])).mean())
        if best is None or s > best[0]:
            best = (s, p, ph)
s, p, ph = best
print(f"拟合结果: 拍长 {p:.5f}s ({60/p:.2f} BPM)  相位 {ph:.4f}s  score {s:.5f}")

ASSUMED = 0.53406
print(f"假设拍长 {ASSUMED:.5f}s → 误差 {p-ASSUMED:+.5f}s/拍")
print(f"100s 后累积漂移: {(p-ASSUMED)*188:.3f}s")

# 各剪辑点与最近"实测拍"的距离
cuts = [10.68, 19.23, 32.04, 44.86, 55.54, 66.22, 79.04, 89.72]
print("\n剪辑点对位误差：")
for c in cuts:
    k = (c - ph) / p
    nearest = ph + round(k) * p
    print(f"  {c:6.2f}s → 最近实时拍 {nearest:6.2f}s  误差 {c-nearest:+.3f}s")
print(f"\n修正量：把音乐起点前移 {ph:.4f}s 即可让 t=0 落在实时拍上")
