"""
BGM 无缝循环 v2：先找"音乐上相似"的两个点，再等功率交叉融合。

步骤：
1. 解码 → 单声道
2. 计算 onset 能量包络 → 自相关估计 BPM
3. 按小节网格（4 拍）枚举候选循环终点 E
4. 对每个 E，比较 [E-cf, E] 与 [0, cf] 的频带能量向量（24 带，余弦相似度）
5. 取相似度最高的 E，做等功率交叉（sqrt 曲线）
6. 循环铺满目标时长，片尾淡出

输出：out/bgm_loop_v2_<dur>.m4a，并打印选点与相似度
"""
import subprocess, numpy as np, sys, wave

PY = "C:/Users/Admin/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
SR = 44100
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 213.0
SRC = "../out/audio/bgm_final.m4a"
CF = 0.5   # 相似度分析窗（秒）
BLEND = 0.04  # 接缝融合长度（秒）——相似点只需极短融合

raw = subprocess.run([FF, "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x) / SR
print("source: %.2fs" % dur)

# ---- 1) onset 包络 & BPM ----
hop = 512
win = 2048
n_frames = (len(x) - win) // hop
env = np.empty(n_frames, dtype=np.float32)
prev = np.zeros(win // 2 + 1, dtype=np.float32)
for i in range(n_frames):
    seg = x[i*hop:i*hop+win]
    spec = np.abs(np.fft.rfft(seg * np.hanning(win)))
    flux = np.maximum(spec - prev, 0).sum()
    env[i] = flux
    prev = spec
env = env - env.mean()
ac = np.correlate(env, env, "full")[len(env)-1:]
fps = SR / hop
# BPM 60~180
best = (0, 0)
for bpm in np.arange(60, 181, 0.25):
    lag = 60.0 / bpm * fps
    lo, hi = int(lag*0.97), int(lag*1.03)+1
    if hi >= len(ac):
        continue
    v = ac[lo:hi].max()
    if v > best[0]:
        best = (v, bpm)
bpm = best[1]
beat = 60.0 / bpm
bar = beat * 4
print("estimated BPM %.1f  (beat %.3fs, bar %.3fs)" % (bpm, beat, bar))

# ---- 2) 频带能量向量 ----
BANDS = 24
def band_vec(t0, length):
    a = int(t0 * SR); b = int(min(t0 + length, dur) * SR)
    seg = x[a:b]
    if len(seg) < 2048:
        seg = np.pad(seg, (0, 2048 - len(seg)))
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    edges = np.linspace(0, len(spec), BANDS + 1).astype(int)
    v = np.array([spec[edges[i]:edges[i+1]].sum() for i in range(BANDS)])
    v = np.log1p(v)
    n = np.linalg.norm(v)
    return v / (n + 1e-9)

head = band_vec(0.0, CF)

# ---- 3) 候选终点：小节网格，且离尾部淡出段留余量 ----
# 原曲尾部淡出约在 135.2s 开始，候选范围取 [0.55*dur, 134.0]
cands = []
t = bar * 8
while t < min(dur - CF - 1.0, 134.0):
    # 优先较长循环（≥100s），减少重复次数；同时保证相似度
    if t > max(dur * 0.5, 60.0):
        cands.append(t)
    t += bar

scored = []
for E in cands:
    v = band_vec(E - CF, CF)
    sim = float(np.dot(v, head))
    scored.append((sim, E))
scored.sort(reverse=True)
print("top-5 相似点：")
for sim, E in scored[:5]:
    print("   E=%.2fs  sim=%.4f" % (E, sim))

bestE = scored[0][1]
print("选用 E=%.2fs（相似度 %.4f，比随机点高 %.1f%%）" % (bestE, scored[0][0],
      (scored[0][0] / np.mean([s for s, _ in scored]) - 1) * 100))

# ---- 4) 构造循环：x[0:bestE] 的尾部与 x[0:CF] 等功率融合 ----
cf = int(BLEND * SR)
seg = x[:int(bestE * SR)].copy()
tail = seg[-cf:].copy()
headseg = x[:cf].copy()
t = np.linspace(0, 1, cf)
seg[-cf:] = tail * np.sqrt(1 - t) + headseg * np.sqrt(t)
loop = seg
print("loop length: %.2fs  → 全片将循环 %.1f 次" % (len(loop)/SR, TARGET/(len(loop)/SR)))

# ---- 5) 铺满 + 片尾淡出 ----
need = int(TARGET * SR)
out = np.tile(loop, int(np.ceil(need / len(loop))))[:need]
fo = int(3.0 * SR)
out[-fo:] *= np.linspace(1, 0, fo)

peak = np.max(np.abs(out))
if peak > 0:
    out = out / peak * (10 ** (-1 / 20))
stereo = np.column_stack([out, out])
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
tmp = "out/_bgm_v2.wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
dst = "out/bgm_loop_v2_%ds.m4a" % int(TARGET)
subprocess.run([FF, "-y", "-i", tmp, "-c:a", "aac", "-b:a", "192k", dst],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("WROTE", dst)
