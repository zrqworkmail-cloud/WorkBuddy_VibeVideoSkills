"""
代码生成 BGM（零 AI 权重 / 零本地模型）——老干妈辟谣短 uses.
合成：轻量 lo-fi 和声进行 + 琶音 + 软底鼓/踩镲，循环结构，整段淡入淡出。
输出 16-bit PCM WAV，峰值为约 -6dBFS，均方根约 -15dB，不触顶。
"""
import numpy as np

SR = 44100
BPM = 120
BEAT = 60.0 / BPM            # 0.5s
BAR = BEAT * 4               # 2.0s
# 视频 876 帧 / 24fps ≈ 36.5s；生成 40s 再由 ffmpeg 按视频时长截断（不使用 -shortest）
DUR = 40.0
N = int(SR * DUR)

def hz(semi):
    # 半音相对 A4=440
    return 440.0 * (2 ** (semi / 12.0))

# 和声进行（每 2 小节换一次根音）：C - Am - F - G  (i-VI-IV-V 经典走向)
# 用 MIDI 半音表示，A4=69
PROG = [
    [60, 64, 67],   # C  maj (C E G)
    [57, 60, 64],   # A  min (A C E)
    [53, 57, 60],   # F  maj (F A C)
    [55, 59, 62],   # G  maj (G B D)
]
PROG_BARS = 2  # 每个和弦持续 2 小节 = 4s

def env(n, kind='pad'):
    t = np.arange(n) / SR
    if kind == 'pad':
        # 缓入缓出，避免爆音
        a = int(0.15 * SR); r = int(0.4 * SR)
        e = np.ones(n)
        if n > a:
            e[:a] = np.linspace(0, 1, a)
        if n > r:
            e[-r:] = np.minimum(e[-r:], np.linspace(1, 0, r))
        return e
    if kind == 'pluck':
        a = int(0.01 * SR); d = int(0.5 * SR)
        e = np.exp(-np.arange(n) / (d))
        if n > a:
            e[:a] = np.linspace(0, 1, a)
        return e
    if kind == 'kick':
        return np.exp(-np.arange(n) / (0.12 * SR))
    if kind == 'hat':
        return np.exp(-np.arange(n) / (0.03 * SR))
    return np.ones(n)

def note_wave(freq, n, kind='pad'):
    t = np.arange(n) / SR
    if kind == 'pad':
        # 叠加基频 + 轻微泛音，柔和
        s = 0.6 * np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * 2 * freq * t) + 0.08 * np.sin(2 * np.pi * 3 * freq * t)
    else:
        s = np.sin(2 * np.pi * freq * t)
    return s * env(n, kind)

def render():
    out = np.zeros(N)
    # 1) 和声 pad（每个和弦铺底，三声部）
    chord_dur = PROG_BARS * BAR
    chord_n = int(chord_dur * SR)
    for ci, chord in enumerate(PROG):
        start = int(ci * chord_dur * SR)
        # 循环铺满整段
        while start < N:
            for semi in chord:
                # 低八度铺底
                f = hz(semi - 12)
                seg = note_wave(f, chord_n, 'pad') * 0.10
                end = int(min(start + chord_n, N))
                out[start:end] += seg[: end - start]
            start = int(start + len(PROG) * chord_dur * SR)  # 整轮循环

    # 2) 琶音（八分音符流动），音量小
    arp_notes = []
    # 把四个和弦的音 + 高八度串成八分音符序列
    seq = []
    for chord in PROG:
        seq += chord + [chord[0] + 12]
    step = BEAT / 2  # 八分音符
    step_n = int(step * SR)
    idx = 0
    pos = 0
    while pos < N:
        semi = seq[idx % len(seq)]
        f = hz(semi)
        seg = note_wave(f, step_n, 'pluck') * 0.05
        end = min(pos + step_n, N)
        out[pos:end] += seg[: end - pos]
        pos += step_n
        idx += 1

    # 3) 节奏：底鼓在每拍，踩镲在反拍
    beat_n = int(BEAT * SR)
    kick_seg = note_wave(60, int(0.18 * SR), 'kick') * 0.22  # 用低频近似
    # 用正弦低频做 kick
    kt = np.arange(int(0.18 * SR)) / SR
    kick = np.sin(2 * np.pi * 55 * kt) * np.exp(-kt / 0.12) * 0.25
    hat_seg_n = int(0.05 * SR)
    ht = np.arange(hat_seg_n) / SR
    hat = (np.random.RandomState(0).randn(hat_seg_n)) * np.exp(-ht / 0.03) * 0.05
    # 用确定性噪声（固定种子）避免 Math.random 风格不可复现；这里只是底噪纹理
    pos = 0
    while pos < N:
        end = min(pos + len(kick), N)
        out[pos:end] += kick[: end - pos]
        # 反拍踩镲
        hpos = pos + beat_n // 2
        hend = min(hpos + len(hat), N)
        if hend > hpos:
            out[hpos:hend] += hat[: hend - hpos]
        pos += beat_n

    # 整体淡入淡出（首尾 0.6s）
    fade = int(0.6 * SR)
    out[:fade] *= np.linspace(0, 1, fade)
    out[-fade:] *= np.linspace(1, 0, fade)

    # 归一化到 -6dB 峰值
    peak = np.max(np.abs(out))
    target = 10 ** (-6 / 20)
    if peak > 0:
        out = out / peak * target
    # 限幅保护（软）
    out = np.clip(out, -0.99, 0.99)

    pcm = (out * 32767.0).astype(np.int16)
    # 转立体声
    stereo = np.column_stack([pcm, pcm])
    return stereo

def write_wav(path, data):
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())

if __name__ == '__main__':
    data = render()
    write_wav('out/lgm_bgm.wav', data)
    rms = np.sqrt(np.mean(data.astype(np.float32) ** 2))
    db_rms = 20 * np.log10(rms + 1e-9)
    peak_db = 20 * np.log10(np.max(np.abs(data.astype(np.float32))) + 1e-9)
    print(f'WROTE out/lgm_bgm.wav  len={len(data)/SR:.2f}s  rms={db_rms:.1f}dB  peak={peak_db:.1f}dB')
