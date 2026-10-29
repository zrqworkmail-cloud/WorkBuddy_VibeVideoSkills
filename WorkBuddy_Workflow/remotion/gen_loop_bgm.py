"""
把既定 BGM 做成无缝循环母带：
1) 去掉原曲尾部的淡出段（淡出是给单次播放用的，循环时必须去掉）
2) 用首尾交叉淡化（crossfade）把接缝抹平
3) 循环铺满目标时长，再在最后做一次淡出

输出：out/bgm_loop_<dur>.m4a
"""
import subprocess, numpy as np, sys

PY = "C:/Users/Admin/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
SR = 44100
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 213.0
SRC = "../out/audio/bgm_final.m4a"

# 解码为 float32 单声道（用于分析）+ 立体声（用于输出）
raw = subprocess.run([FF, "-i", SRC, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                     stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout
x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
print("source length: %.2fs" % (len(x) / SR))

# 1) 找到尾部淡出的起点：用 0.25s 窗 RMS，从尾部往前找能量开始持续下降的位置
win = int(0.25 * SR)
n = len(x) // win
rms = np.array([np.sqrt(np.mean(x[i*win:(i+1)*win] ** 2)) for i in range(n)])
peak = np.percentile(rms, 80)
# 从尾部往前，找到第一个 RMS 低于 60% 峰值的位置，再往前留 1s 余量
cut_idx = n
for i in range(n - 1, int(n * 0.5), -1):
    if rms[i] < peak * 0.6:
        cut_idx = i
        break
cut = max(int((cut_idx - 4) * win), int(SR * 30))  # 至少留 30s
print("trim tail at %.2fs (drop fade-out)" % (cut / SR))
x = x[:cut]

# 2) 首尾交叉淡化，做成无缝环
cf = int(4.0 * SR)  # 4s 交叉（等功率）
head = x[:cf].copy()
body = x[cf:].copy()
# 把 head 与尾部最后 cf 段混合：loop = body + blend(tail, head)
tail = x[-cf:].copy()
t = np.linspace(0, 1, cf)[:, None]
# 等功率交叉：sqrt 曲线，避免中间出现音量凹陷（这正是"接缝明显"的主因）
blend = tail * np.sqrt(1 - t) + head * np.sqrt(t)
loop = np.concatenate([body, blend], axis=0)
print("seamless loop length: %.2fs" % (len(loop) / SR))

# 3) 铺满目标时长
need = int(TARGET * SR)
reps = int(np.ceil(need / len(loop)))
out = np.tile(loop, (reps, 1))[:need]

# 4) 片尾淡出 3s
fo = int(3.0 * SR)
out[-fo:] *= np.linspace(1, 0, fo)[:, None]

# 5) 归一化到 -1dBFS 峰值，写 wav
peak_out = np.max(np.abs(out))
if peak_out > 0:
    out = out / peak_out * (10 ** (-1 / 20))
pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)

import wave
tmp = "out/_bgm_loop.wav"
with wave.open(tmp, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

dst = "out/bgm_loop_%ds.m4a" % int(TARGET)
subprocess.run([FF, "-y", "-i", tmp, "-c:a", "aac", "-b:a", "192k", dst],
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("WROTE", dst)
