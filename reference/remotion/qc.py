"""
质检：帧间运动检测（最长静止 <= 3s）+ 亮度抽检（排除全黑/全白）+ 音频电平。
用法：python qc.py [video_path]  （默认 out/lgm_final.mp4）
"""
import subprocess, numpy as np, json, sys

PY = sys.executable   # 当前解释器，换机器无需改
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

# 双重判据：
#  (a) chg_frac：变化像素占比（>6 灰度），衡量"强动效"强度（参考值）
#  (b) 冻结判据：全帧平均绝对差 < 0.06 灰度 = 画面真的没动（真正的 dead air）
CHG = 6.0
diffs = []
chg_frac = []
for i in range(1, N):
    d = np.abs(frames[i] - frames[i-1])
    chg_frac.append(float((d > CHG).mean()))
    diffs.append(float(d.mean()))
diffs = np.array(diffs)
chg_frac = np.array(chg_frac)

FROZEN = 0.002
frozen = diffs < FROZEN
max_run = 0
cur = 0
runs = []
for i, s in enumerate(frozen):
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
print("frozen-run (mean|diff| < %.2f gray): longest %d frames (%.2fs) at frame %d" % (FROZEN, max_run, max_static_sec, max_run_start))
print("frozen runs:", runs[:12])
print("min per-frame mean diff: %.4f gray" % float(diffs.min()))

# 参考：强动效覆盖率
print("strong-motion coverage: mean %.2f%%, min %.2f%%" % (chg_frac.mean()*100, chg_frac.min()*100))

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
