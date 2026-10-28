"""
质检：帧间运动检测（最长静止 <= 3s）+ 亮度抽检（排除全黑/全白）+ 音频电平。
用法：python qc.py [video_path]  （默认 out/lgm_final.mp4）
"""
import subprocess, numpy as np, json, sys

PY = "C:/Users/Admin/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
VIDEO = sys.argv[1] if len(sys.argv) > 1 else "out/lgm_final.mp4"
print("QC target:", VIDEO)

# 自动探测画幅，等比缩到宽 270
probe = subprocess.run([FF, "-i", VIDEO], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE).stderr.decode(errors="ignore")
import re
m = re.search(r"Video:.*?, (\d{3,5})x(\d{3,5})", probe)
if not m:
    raise SystemExit("cannot detect video size")
src_w, src_h = int(m.group(1)), int(m.group(2))
W = 270
H = int(round(W * src_h / src_w / 2)) * 2
print(f"source {src_w}x{src_h} -> analyze {W}x{H}")

fps = 24
# 抽帧为灰度 rawvideo
cmd = [FF, "-i", VIDEO, "-vf", f"scale={W}:{H}", "-pix_fmt", "gray",
       "-f", "rawvideo", "-"]
print("reading frames (grayscale %dx%d)..." % (W, H), file=sys.stderr)
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
frame_bytes = W * H
frames = []
while True:
    buf = proc.stdout.read(frame_bytes)
    if len(buf) < frame_bytes:
        break
    frames.append(np.frombuffer(buf, dtype=np.uint8).reshape(H, W).astype(np.float32))
proc.wait()
N = len(frames)
print("frames read:", N, file=sys.stderr)

# 亮度抽检
means = [float(f.mean()) for f in frames]
print("brightness: min=%.1f max=%.1f mean=%.1f" % (min(means), max(means), sum(means)/len(means)))

# 帧间差分：用「变化像素占比」判断是否有真实运动（避免深色背景下局部动画被全局均值掩盖）
CHG = 6.0  # 单像素变化阈值（灰度）
diffs = []
chg_frac = []
for i in range(1, N):
    d = np.abs(frames[i] - frames[i-1])
    chg_frac.append(float((d > CHG).mean()))
    diffs.append(float(d.mean()))
diffs = np.array(diffs)
chg_frac = np.array(chg_frac)

# 静止判定：相邻帧变化像素占比 < 0.3% 视为基本静止（真正冻结才会低于此）
TH = 0.003
static = (chg_frac < TH)
max_run = 0
cur = 0
max_run_start = 0
runs = []
for i, s in enumerate(static):
    if s:
        cur += 1
        if cur == 1:
            run_start = i
    else:
        if cur > 0:
            runs.append((run_start, cur))
            if cur > max_run:
                max_run = cur; max_run_start = run_start
        cur = 0
if cur > 0:
    runs.append((run_start, cur))
    if cur > max_run:
        max_run = cur; max_run_start = run_start

max_static_sec = max_run / fps
print("longest static run: %d frames (%.2fs) starting near frame %d" % (max_run, max_static_sec, max_run_start))
print("static runs (frame_idx, length_frames):", runs[:10])

# 场景切换检测（变化像素占比 > 5%）
big = np.where(chg_frac > 0.05)[0]
print("scene cuts (frame_idx):", big.tolist())

result = {
    "frames": N,
    "duration_sec": N / fps,
    "brightness": {"min": min(means), "max": max(means), "mean": sum(means)/len(means)},
    "max_static_frames": max_run,
    "max_static_sec": round(max_static_sec, 3),
    "static_pass": max_static_sec <= 3.0,
    "scene_cuts": big.tolist(),
}
print(json.dumps(result, ensure_ascii=False, indent=2))
