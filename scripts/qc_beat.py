import numpy as np, wave, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
w = wave.open(os.path.join(ROOT, "out", "audio", "final_audio.wav"), "rb")
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
SR = 22050; HOP = 256; NFFT = 2048; win = np.hanning(NFFT)
nf = 1 + (len(x) - NFFT) // HOP
S = np.empty((nf, NFFT // 2 + 1), dtype=np.float32)
CH = 2048
for i in range(0, nf, CH):
    seg = np.lib.stride_tricks.sliding_window_view(
        x[i * HOP:i * HOP + CH * HOP + NFFT][:CH * HOP + NFFT], NFFT)[::HOP][:min(CH, nf - i)]
    S[i:i + len(seg)] = np.abs(np.fft.rfft(seg * win, axis=1))
flux = np.log1p(np.maximum(S[1:] - S[:-1], 0).sum(axis=1) * 200); flux -= flux.mean()
fps = SR / HOP
cuts = [10.68, 19.23, 32.04, 44.86, 55.54, 66.22, 79.04, 89.72]
BEAT = 0.53406
print("剪辑点 → 该时刻的音乐 onset 强度（越高说明踩得越准）")
ok = 0
for c in cuts:
    i = int(c * fps)
    band = flux[max(0, i - int(0.06 * fps)): i + int(0.06 * fps)]
    full = flux[max(0, i - int(0.27 * fps)): i + int(0.27 * fps)]
    s = band.mean()
    strong = s > np.percentile(full, 60)
    ok += strong
    print(f"  {c:6.2f}s  band {s:7.3f}   {'✓ 踩在重拍' if strong else '✗ 偏离'}")
print(f"\n首帧 onset = {flux[:int(0.1*fps)].mean():.3f}（>0 表示从节拍上开始）")
print(f"剪辑点精准率 {ok}/{len(cuts)}")
