"""
BGM 无缝循环 v3：前奏只播一次 + 在主体内找相似点循环

关键点（v2 的教训）：
- 循环点若落在原曲前奏（淡入段），每次重复都会重新"起手"→ 听起来像重开
- 正确做法：前奏 x[0:S] 只播一次，之后循环 x[S:E]，且 S/E 的频谱高度相似
- 相似点只需极短融合（40ms）；2s 长交叉会把开头播两遍，产生音量凹陷

步骤：
1. 解码、估计 BPM / 小节长度
2. 枚举起点 S（8–30s，小节对齐）与终点 E（S+60s ~ 134s，小节对齐）
3. 用 0.5s 频带能量向量的余弦相似度打分，取最高
4. loop = x[S:E]，尾部 40ms 与头部等功率融合
5. out = x[0:S] + 循环铺满至目标时长，片尾 3s 淡出
"""
import subprocess, numpy as np, sys, wave
import sys

PY = sys.executable   # 当前解释器，换机器无需改
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
SR = 44100
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 213.0
SRC = "../out/audio/bgm_final.m4a"
ANALYZE = 0.5
BLEND = 0.04

raw = subprocess.run([FF, "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x) / SR
print("source: %.2fs" % dur)

# ---- BPM ----
hop, win = 512, 2048
n_frames = (len(x) - win) // hop
env = np.empty(n_frames, dtype=np.float32)
prev = np.zeros(win // 2 + 1, dtype=np.float32)
for i in range(n_frames):
    seg = x[i*hop:i*hop+win]
    spec = np.abs(np.fft.rfft(seg * np.hanning(win)))
    env[i] = np.maximum(spec - prev, 0).sum()
    prev = spec
env -= env.mean()
ac = np.correlate(env, env, "full")[len(env)-1:]
fps = SR / hop
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
print("BPM %.1f  bar %.3fs" % (bpm, bar))

# ---- 频带向量 ----
BANDS = 24
def band_vec(t0, length=ANALYZE):
    a = int(t0 * SR); b = int(min(t0 + length, dur) * SR)
    seg = x[a:b]
    if len(seg) < 2048:
        seg = np.pad(seg, (0, 2048 - len(seg)))
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    edges = np.linspace(0, len(spec), BANDS + 1).astype(int)
    v = np.array([spec[edges[i]:edges[i+1]].sum() for i in range(BANDS)])
    v = np.log1p(v)
    return v / (np.linalg.norm(v) + 1e-9)

# ---- 起点候选（跳过前奏，取 8–32s）----
S_list = [s for s in np.arange(8, 32, bar)]
E_list = [e for e in np.arange(0, dur - 1, bar) if e > 60 and e < 134]

scored = []
for S in S_list:
    vS = band_vec(S)
    for E in E_list:
        if E - S < 55:
            continue
        vE = band_vec(E - ANALYZE)
        scored.append((float(np.dot(vS, vE)), S, E))
scored.sort(reverse=True)
print("top-5 (sim, S, E)：")
for sim, S, E in scored[:5]:
    print("   sim=%.4f  S=%.2fs  E=%.2fs  loop=%.1fs" % (sim, S, E, E - S))

sim, S, E = scored[0]
print("选用 S=%.2fs E=%.2fs（相似度 %.4f，循环 %.1fs，全片约 %.1f 次）"
      % (S, E, sim, E - S, (TARGET - S) / (E - S)))

# ---- 构造 loop ----
a, b = int(S * SR), int(E * SR)
loop = x[a:b].copy()
cf = int(BLEND * SR)
tail = loop[-cf:].copy()
head = loop[:cf].copy()
t = np.linspace(0, 1, cf)
loop[-cf:] = tail * np.sqrt(1 - t) + head * np.sqrt(t)

# ---- 前奏一次 + 循环铺满 ----
need = int(TARGET * SR)
intro = x[:a]
body_need = need - len(intro)
reps = int(np.ceil(body_need / len(loop)))
out = np.concatenate([intro, np.tile(loop, reps)])[:need]
fo = int(3.0 * SR)
out[-fo:] *= np.linspace(1, 0, fo)

peak = np.max(np.abs(out))
if peak > 0:
    out = out / peak * (10 ** (-1 / 20))
stereo = np.column_stack([out, out])
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
tmp = "out/_bgm_v3.wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
dst = "out/bgm_loop_v3_%ds.m4a" % int(TARGET)
subprocess.run([FF, "-y", "-i", tmp, "-c:a", "aac", "-b:a", "192k", dst],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("WROTE", dst)
