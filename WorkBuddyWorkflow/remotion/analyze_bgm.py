"""
客观分析 BGM：响度结构 / 频谱质心 / BPM 估计 / 首尾淡入淡出 / 与既有 BGM 同源性。
分析对象：
  A = films/yunche-45s/out/audio/bgm_final.m4a (40s, 用户所指「这个配音」)
  B = out/audio/bgm_final.m4a (136.72s, 既有管线 BGM)
"""
import subprocess, numpy as np

PY = "C:/Users/Admin/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"
FF = subprocess.check_output([PY, "-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).decode().strip()
SR = 44100

def decode(path):
    # 输入为预解码好的 f32le mono 44.1k raw 文件
    return np.fromfile(path, dtype=np.float32)

def analyze(x, label):
    n = len(x)
    dur = n / SR
    print(f"===== {label} : {dur:.2f}s =====")
    # 峰值/总体响度
    peak = np.max(np.abs(x))
    rms_all = np.sqrt(np.mean(x**2))
    print(f"peak={20*np.log10(peak+1e-9):.1f} dBFS   rms={20*np.log10(rms_all+1e-9):.1f} dBFS")
    # 1 秒窗 RMS 曲线（结构轮廓）
    win = SR
    secs = n // win
    curve = np.array([np.sqrt(np.mean(x[i*win:(i+1)*win]**2)) for i in range(secs)])
    cdb = 20*np.log10(curve + 1e-9)
    print("每秒 RMS(dB):", " ".join(f"{v:.0f}" for v in cdb))
    # 首尾处理检测：头 2s / 尾 2s 能量爬升/衰减
    head = cdb[:3]; tail = cdb[-3:]
    print(f"头3秒趋势: {head[0]:.0f}->{head[1]:.0f}->{head[2]:.0f}  尾3秒趋势: {tail[0]:.0f}->{tail[1]:.0f}->{tail[2]:.0f}")
    # 频谱质心（整体 + 每 5s）
    spec = np.abs(np.fft.rfft(x * 0.5))**2
    freqs = np.fft.rfftfreq(len(x), 1/SR)
    centroid_all = float((freqs*spec).sum()/ (spec.sum()+1e-12))
    print(f"整体频谱质心: {centroid_all:.0f} Hz")
    for s0 in range(0, int(dur)-4, 5):
        seg = x[s0*SR:(s0+5)*SR]
        if len(seg) < SR: break
        sp = np.abs(np.fft.rfft(seg))**2
        fr = np.fft.rfftfreq(len(seg), 1/SR)
        c = (fr*sp).sum()/(sp.sum()+1e-12)
        low = sp[fr<250].sum()/(sp.sum()+1e-12); mid = sp[(fr>=250)&(fr<2000)].sum()/(sp.sum()+1e-12); hi = sp[fr>=2000].sum()/(sp.sum()+1e-12)
        print(f"  {s0:3d}-{s0+5:3d}s  质心{c:5.0f}Hz  低频{low*100:3.0f}% 中频{mid*100:3.0f}% 高频{hi*100:3.0f}%")
    # BPM 估计：onset(半波整流能量差分) 自相关
    hop = 512
    frames = n // hop
    e = np.array([np.sqrt(np.mean(x[i*hop:(i+1)*hop]**2)) for i in range(frames)])
    d = np.diff(e); d[d < 0] = 0
    d = d - d.mean()
    ac = np.correlate(d, d, 'full')[len(d)-1:]
    # 60~180 BPM 对应 lag
    best = None
    for bpm_x10 in range(600, 1801):
        lag = 60.0*SR/bpm_x10/hop
        lo, hi_i = int(lag*0.98), max(int(lag*1.02), int(lag*0.98)+1)
        if lo >= len(ac): break
        hi_i = min(hi_i, len(ac))
        if hi_i <= lo: continue
        v = ac[lo:hi_i].max()
        if best is None or v > best[1]:
            best = (bpm_x10/10.0, v)
    # 归一化强度
    print(f"BPM 估计: {best[0]:.1f}  (置信 {best[1]/ (ac[0]+1e-9) *100:.0f}%)")
    # 静音段检测（>0.8s 低于 -40dB）
    thr = 10**(-40/20)
    quiet = curve < thr
    runs = []
    i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if j - i >= 1: runs.append((i, j-i))
            i = j
        else: i += 1
    print("静音段(秒,长):", runs if runs else "无")
    return curve

a = decode('out/_a.raw')
ca = analyze(a, "A: yunche-45s bgm_final.m4a (用户所指)")
b = decode('out/_b.raw')
cb = analyze(b, "B: out/audio/bgm_final.m4a (既有管线 BGM)")

# 同源性粗判：两者 5s 段频谱质心序列的相关性
print("===== 同源性粗判 =====")
def centroids(x, seg=5):
    out = []
    for s0 in range(0, len(x)//SR - seg + 1, seg):
        s = x[s0*SR:(s0+seg)*SR]
        sp = np.abs(np.fft.rfft(s))**2
        fr = np.fft.rfftfreq(len(s), 1/SR)
        out.append((fr*sp).sum()/(sp.sum()+1e-12))
    return np.array(out)
ca_c, cb_c = centroids(a), centroids(b)
k = min(len(ca_c), len(cb_c))
if k >= 4:
    r = np.corrcoef(ca_c[:k], cb_c[:k])[0, 1]
    print(f"前{k*5}s 频谱质心序列相关系数: {r:.3f}  (A均值{ca_c[:k].mean():.0f}Hz / B均值{cb_c[:k].mean():.0f}Hz)")
    print("解读: |r|>0.8 且均值接近 → 很可能同源；否则为不同曲目")
