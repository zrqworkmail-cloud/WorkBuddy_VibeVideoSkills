#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""底板构建 v3：9 段各自独立生成的真实素材，逐镜差异化处理。
关键改动：彻底删除「播放-倒放」ping-pong，改为前向慢速延展（setpts），
并给每个镜头不同的后处理（暗角/辉光/锐化/单色），避免特效单一。"""
import json, os, shutil, subprocess, sys

import _film

ROOT = _film.FILMROOT
FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
AI = os.path.join(ROOT, "out", "ai")
OUT = os.path.join(ROOT, "out", "base")
FPS = 24                      # 成片帧率改为 24fps
# 运动补偿插帧：先用 setpts 把 16fps 素材按 S 倍慢速展开到本镜目标时长，
# 再用 minterpolate(mci) 生成真正的中间帧补到 24fps —— 彻底消除掉帧，
# 不再是 fps 过滤器的复制帧。素材原生 16fps 时延展后有效帧率会掉到 16~24，
# 因此插帧是必须的。tpad 用克隆末帧补齐 setpts 尾差（<0.2s），保证每段帧数精确。
MINTERP = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"

# 场景 → (素材, 调色链, 特效类型)
# 每镜素材独立（s1..s9 各自生成），特效各不相同，杜绝雷同。
LOOK = {
    "1": ("s1", "eq=contrast=1.05:saturation=1.02:brightness=-0.01", "vignette"),
    "2": ("s2", "eq=contrast=1.04:saturation=1.10:brightness=0.01", "vignette"),
    "3": ("s3", "eq=contrast=1.08:saturation=1.06:brightness=-0.01", "sharpen"),
    "4": ("s4", "eq=contrast=1.10:saturation=0.85:brightness=-0.04", "vignette"),
    # s13 生物钟·假清醒：月光房（新生成）→ 低饱和冷调、压暗
    "13": ("s13", "eq=contrast=1.10:saturation=0.82:brightness=-0.04", "vignette"),
    # s5 皮质醇：逆光剪影 → 压饱和、保冷调
    "5": ("s5", "eq=contrast=1.10:saturation=0.70:brightness=-0.03", "vignette"),
    # s6 多巴胺：背影+手机蓝光 → 辉光强化屏幕光
    "6": ("s6", "eq=contrast=1.06:saturation=1.04:brightness=0.0", "bloom"),
    # s7 前额叶：伏案剪影 → 低饱和、压暗
    "7": ("s7", "eq=contrast=1.12:saturation=0.32:brightness=-0.04", "vignette"),
    "8": ("s8", "hue=h=170:s=0.7,eq=contrast=1.08:saturation=0.90", "vignette"),
    "9": ("s9", "colorbalance=rs=0.18:gs=0.06:bs=-0.14,eq=contrast=1.0:saturation=0.96:brightness=0.06", "bloom"),
    # s10 入睡阈值：眼睛合上 → 冷调、锐化眼部细节
    "10": ("s10", "eq=contrast=1.10:saturation=0.90:brightness=-0.02", "sharpen"),
    # s11 肾上腺素：改用新生成的下半身侧脸（s14）→ 主体压在画面下半，冷轮廓光、去饱和
    "11": ("s14", "eq=contrast=1.12:saturation=0.70:brightness=-0.03", "vignette"),
    # s12 杏仁核：紧张侧影 → 近乎单色
    "12": ("s12", "eq=contrast=1.12:saturation=0.26:brightness=-0.04", "vignette"),
}


# 个别镜头需要改变构图，为文字腾出空间（默认 scale=1080:1920 全幅）。
# 例：GEO = {"3": "scale=929:1651:flags=lanczos,pad=1080:1920:75:0:color=black"}
# s11 肾上腺素：s14 主体偏上（脸占上半），会撞顶部"心跳被顶起来"+右上读数。
# 裁掉顶部 160px、把颈/下颌压到画面下部 ~87%，顶部留 240px 深色带给文字 —— 满足"肾上腺素放到下半部分"，
# 同时让颈动脉搏动（故事主角）更突出。
GEO = {
    "11": "crop=704:1120:0:160,scale=1080:1680,pad=1080:1920:0:240:black",
}

# 按镜头裁掉素材的头/尾（I2V 前 1~2 秒常还在从概念首帧"过渡"，画风不稳；
# 尾部若有多余动作也要裁掉，保证这一段停在叙事需要的那一帧）。
# s3 人眼特写：跳过前 1.6s 的插画过渡，并在 6.8s 处收尾 —— 停在"眼睛睁开（醒来）"，
#    否则片尾又闭眼，会和"睡一觉存款清零、人重新清醒"的文案打架。
# s10 入睡阈值：同样跳过前 1.6s 插画过渡；尾部 I2V 会不自觉把眼睛重新睁开
#    （实测 5.5s 完好闭合 → 6.0s 已出现睁开缝隙 → 7.2s 完全睁开），
#    与"眼皮合上 → 阈值越过"的叙事相反，因此在 5.7s 收尾，停在完全闭合的那一帧。
TRIM = {"3": 1.6, "10": 1.6}
TRIM_END = {"3": 6.15, "10": 5.7}

# 多段拼接：某些镜头由两段素材首尾相接（交叉淡化）而成。
# s3 现在是「腺苷滴入 → 闭眼 → 睡着 → 醒来」的完整弧线，把原来的 s10 并了进来：
#   前半段用 s10（睁眼 → 闭上），后半段用 s3（闭着 → 睁开 → 清醒），
#   在"完全闭合"处交叉淡化 0.4s，看起来就是同一只眼睛连续发生的事，不再切镜头。
PARTS = {}
XFADE = 0.4

# 分段定速：(素材, 起, 止, 目标秒数)。用于"速度本身就是表演"的镜头。
# s3 现在**放慢 1.25×**（用户："视频还是慢一点比较好"）：
#   s10 睁眼→困→闭上 4.80s → 6.00s（sp=1.25），眼皮合上从原来的 2.25s 推迟到 2.81s；
#   s3  闭着→睁开→清醒 3.80s → 4.90s（sp≈1.29）。
#   FNS.s3 里 lt/=1.25 把本地时间压回设计时刻表，水滴仍在 lt=2.81 落点＝放慢后眼皮合上那一拍。
#   两段和 10.90s − xfade 0.20 = 10.70s ≈ 新镜长 10.68s（末尾 S≈1.0 微调收口）。
PARTS_TIMED = {
    "3": [("s10", 0.60, 5.40, 6.00),
          ("s3",  3.60, 7.40, 4.90)],
}
XFADES = [0.20]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "")[-1200:])


def probe_dur(path):
    p = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    for line in (p.stderr or "").splitlines():
        if "Duration:" in line:
            h, m, s = line.split("Duration:")[1].strip().split(",")[0].split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError("读不到时长 " + path)


tl = json.load(open(os.path.join(ROOT, "src", "timeline.json"), encoding="utf-8"))
BEAT = tl.get("beatSec", 60.0 / tl["bpm"])
os.makedirs(OUT, exist_ok=True)
# 只重建指定镜头（样品迭代用），例：python build_base.py 3
ONLY = set(a.strip() for a in sys.argv[1].split(",") if a.strip()) if len(sys.argv) > 1 else None
if ONLY:
    print("[build_base] 只重建镜头:", ",".join(sorted(ONLY)))
segs = []

for sc in tl["scenes"]:
    i = sc["id"][1:]
    src_key, grade, fx = LOOK[i]
    src = os.path.join(AI, f"{src_key}.mp4")
    seg = os.path.join(OUT, f"base_s{i}.mp4")
    if ONLY is not None and i not in ONLY:
        # 未在本次重建范围内：复用已有分段（素材可能还没生成，所以先判分段）
        if os.path.exists(seg):
            segs.append(seg)
        else:
            print(f"  [s{i}] 跳过（无分段）")
        continue
    if not os.path.exists(src):
        raise RuntimeError("缺素材 " + src)

    # 分段定速镜头：每段先各自 setpts 到目标时长，再逐对 xfade 接成一条。
    # 分步做（而不是塞进一条 filtergraph）：三段串两个 xfade 时 offset 极易错位，
    # 之前就把 25.6s 压成了 10s。分步可逐步校验时长。
    if i in PARTS_TIMED:
        parts = PARTS_TIMED[i]
        tmp = os.path.join(OUT, f"_src_s{i}.mp4")
        segs_p = []
        for k, (key, a, b, target) in enumerate(parts):
            sp = target / max(0.01, b - a)
            segp = os.path.join(OUT, f"_p{i}_{k}.mp4")
            # 慢放段必须做运动插值：直接 fps=24 会复制帧 → 成片"掉帧/幻灯片"。
            # -ss 裁出的片段起始 PTS 不是 0，先归零再乘速度，否则时长会错。
            # 阈值降到 1.10：s3 放慢 1.25×/1.29× 也要插帧（原来 >1.35 才插，1.25 会被漏掉当掉帧）。
            if sp > 1.10:
                filt = (f"setpts=(PTS-STARTPTS)*{sp:.6f},scale=704:1280,setsar=1,"
                        f"minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")
            else:
                filt = (f"setpts=(PTS-STARTPTS)*{sp:.6f},scale=704:1280,setsar=1,fps=24")
            run([FF, "-hide_banner", "-loglevel", "error", "-y",
                 "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", os.path.join(AI, f"{key}.mp4"),
                 "-filter_complex", f"[0:v]{filt}[v]", "-map", "[v]",
                 "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", segp])
            segs_p.append(segp)
        cur = segs_p[0]
        for k in range(1, len(segs_p)):
            nxt = os.path.join(OUT, f"_p{i}_x{k}.mp4")
            fade = XFADES[k - 1]
            off = max(0.02, probe_dur(cur) - fade)
            run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", cur, "-i", segs_p[k],
                 "-filter_complex",
                 f"[0:v][1:v]xfade=transition=fade:duration={fade}:offset={off:.3f}[v]",
                 "-map", "[v]", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", nxt])
            cur = nxt
        shutil.copyfile(cur, tmp)
        src = tmp
        print(f"  [s{i}] 分段定速拼接 → {probe_dur(tmp):.2f}s  "
              + ' + '.join(f'{k}[{aa}-{bb}→{tt}s]' for k, aa, bb, tt in parts))

    # 多段拼接镜头：先把各段裁好、交叉淡化接成一条临时素材，再走后面的统一流程
    if i in PARTS:
        parts = PARTS[i]
        tmp = os.path.join(OUT, f"_src_s{i}.mp4")
        inputs = []
        for (key, a, b) in parts:
            inputs += ["-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", os.path.join(AI, f"{key}.mp4")]
        if len(parts) == 2:
            d0 = parts[0][2] - parts[0][1]
            off = max(0.05, d0 - XFADE)
            fc = (f"[0:v]setpts=PTS-STARTPTS,scale=704:1280,setsar=1[a];"
                  f"[1:v]setpts=PTS-STARTPTS,scale=704:1280,setsar=1[b];"
                  f"[a][b]xfade=transition=fade:duration={XFADE}:offset={off:.3f}[v]")
        else:
            raise RuntimeError("PARTS 目前只支持两段")
        run([FF, "-hide_banner", "-loglevel", "error", "-y"] + inputs +
            ["-filter_complex", fc, "-map", "[v]", "-r", "16",
             "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", tmp])
        src = tmp
        print(f"  [s{i}] 拼接 {' + '.join(k for k, _, _ in parts)} → 单条素材")

    t0 = 0.0 if (i in PARTS or i in PARTS_TIMED) else TRIM.get(i, 0.0)
    t1 = None if (i in PARTS or i in PARTS_TIMED) else TRIM_END.get(i, None)
    clip = (t1 if t1 else probe_dur(src)) - t0
    need = sc["beats"] * BEAT
    S = need / clip                      # 前向慢速倍数（>1 为放慢），绝无倒放
    nfr = round(need * FPS)
    seg = os.path.join(OUT, f"base_s{i}.mp4")

    scale_part = GEO.get(i, "scale=1080:1920:flags=lanczos")
    # s7 前额叶：底板是"长时间完全不动"的伏案剪影（设计如此），但 qc_rhythm.py 实测
    # 成片最长静止 8.0s（>3s 上限，静止占比 90%）——"入场即停"是明确缺陷，观众会觉得卡住。
    # 嫁接 anything2explainer（★2.7k）的处方："没有其它运镜的镜头可加 1.0→1.05 慢推"：
    # 加全程 1.00→1.06 中心慢推，既消除静止，也贴合"判断力慢慢失守"的叙事。
    if i == "7":
        scale_part = (f"scale=1080:1920:flags=lanczos,"
                      f"zoompan=z='1+0.06*on/{nfr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                      f":d=1:s=1080x1920:fps={FPS}")
    base = (f"setpts=PTS*{S:.6f},{MINTERP},"
            f"tpad=stop_mode=clone:stop_duration=2,"
            f"{scale_part},{grade},fps={FPS}")
    if fx == "bloom":
        # 辉光：亮部高斯模糊后 screen 叠加，营造发光/空气感
        fc = (f"[0:v]{base},split[a][b];[b]gblur=sigma=16[g];"
              f"[a][g]blend=all_mode=screen:all_opacity=0.30,"
              f"unsharp=5:5:0.3:5:5:0.0,format=yuv420p[v]")
    elif fx == "sharpen":
        fc = f"[0:v]{base},unsharp=5:5:0.6:5:5:0.0,format=yuv420p[v]"
    elif fx == "vignette":
        fc = f"[0:v]{base},vignette=PI/5,unsharp=5:5:0.35:5:5:0.0,format=yuv420p[v]"
    else:
        fc = f"[0:v]{base},format=yuv420p[v]"

    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y"]
    # 注意：-ss / -to 必须放在 -i 之前才是「输入侧」裁剪；
    # 放在 -i 之后会被当成输出时长限制（曾把 17s 压成 5s）。
    if t0 > 0:
        cmd += ["-ss", f"{t0:.3f}"]           # 跳过画风不稳的开头
    if t1:
        cmd += ["-to", f"{t1:.3f}"]           # 在叙事需要的帧收尾
    cmd += ["-i", src]
    cmd += ["-filter_complex", fc, "-map", "[v]", "-frames:v", str(nfr),
            "-c:v", "libx264", "-preset", "medium", "-crf", "16",
            "-pix_fmt", "yuv420p", "-an", seg]
    run(cmd)
    print(f"  [s{i}] ← {src_key}  {fx:9s} {need:5.2f}s {nfr:4d}帧  慢速{S:.3f}×")
    segs.append(seg)

if len(segs) < len(tl["scenes"]):
    print(f"⚠ 分段不全（{len(segs)}/{len(tl['scenes'])}），跳过拼接；等素材齐了再全量构建")
else:
    with open(os.path.join(OUT, "list.txt"), "w", encoding="utf-8") as f:
        for s in segs:
            f.write(f"file '{os.path.basename(s)}'\n")
    base = os.path.join(ROOT, "out", "base.mp4")
    run([FF, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
         "-i", os.path.join(OUT, "list.txt"), "-c", "copy", base])
    print("✔", base, f"{os.path.getsize(base)/1048576:.1f} MB")
