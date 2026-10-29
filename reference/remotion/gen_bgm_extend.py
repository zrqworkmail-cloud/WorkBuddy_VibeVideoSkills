"""
BGM 延长剪辑 v4（不是循环，是"接一段"）

思路（DJ/制作人延长曲目的做法）：
1. 原曲先完整播到 E（约 130s，避开尾部淡出）
2. 在 [E-cf, E] 与曲中某段 [S, S+cf] 之间做 **等功率交叉**（cf=4s），把尾巴接到 S 段
3. 交叉之后继续播 x[S+cf:...]，直到目标时长
4. 片尾 3s 淡出

好处：
- 只有 **一个** 接点，且是 4s 长融合（不是硬切，也不是短到听得出"跳"）
- 融合两端都是响的段落，不会出现音量凹陷
- 不像"循环"那样每 70 秒重来一次

输出 out/bgm_ext_<dur>.m4a，并打印选点与相似度
"""
import subprocess, numpy as np, sys, wave
import sys

PY = sys.executable   # 当前解释器，换机器无需改
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
SR = 44100
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 213.0
SRC = "../out/audio/bgm_final.m4a"
E = 130.0        # 第一遍播到这里（原曲淡出前）
CF = 4.0         # 交叉时长
ANALYZE = 1.0    # 相似度分析窗

raw = subprocess.run([FF, "-i", SRC, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x) / SR
print("source: %.2fs" % dur)

# ---- BPM（用于把 S 对齐到小节）----
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
bar = 60.0 / bpm * 4
print("BPM %.1f  bar %.3fs" % (bpm, bar))

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

tail_vec = band_vec(E - CF)
cands = []
s = 4.0
while s + CF < E - 10:
    cands.append(s)
    s += bar
scored = sorted(((float(np.dot(tail_vec, band_vec(S))), S) for S in cands), reverse=True)
print("top-5 接续点：")
for sim, S in scored[:5]:
    print("   S=%.2fs  sim=%.4f" % (S, sim))
sim, S = scored[0]
print("选用 S=%.2fs（相似度 %.4f）" % (S, sim))

# ---- 构造 ----
cf = int(CF * SR)
head = x[:int(E * SR) - cf]                 # 播到 E-cf
tail = x[int(E * SR) - cf:int(E * SR)]      # E-cf..E
cont = x[int(S * SR):]                      # 从 S 继续
cont_head = cont[:cf]
t = np.linspace(0, 1, cf)
blend = tail * np.sqrt(1 - t) + cont_head * np.sqrt(t)
body = cont[cf:]

out = np.concatenate([head, blend, body])
if len(out) < int(TARGET * SR):
    # 还不够长：再从 S 接一次（同样的方法）
    extra = np.concatenate([x[int(S * SR):int(E * SR) - cf], blend, body])
    while len(out) < int(TARGET * SR):
        out = np.concatenate([out, extra])
out = out[:int(TARGET * SR)]
fo = int(3.0 * SR)
out[-fo:] *= np.linspace(1, 0, fo)

peak = np.max(np.abs(out))
if peak > 0:
    out = out / peak * (10 ** (-1 / 20))
stereo = np.column_stack([out, out])
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
tmp = "out/_bgm_ext.wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
dst = "out/bgm_ext_%ds.m4a" % int(TARGET)
subprocess.run([FF, "-y", "-i", tmp, "-c:a", "aac", "-b:a", "192k", dst],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("WROTE %s  (接点 %.1fs, 融合 %.0fs)" % (dst, E - CF, CF))
