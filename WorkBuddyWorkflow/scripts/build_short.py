#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""短版构建器：从成片素材里切短片段，拼一条高信息密度的平台适配版。

与 build_base_uniform 的区别：
  build_base_uniform  把整段素材重定时到目标时长（适合 7.5s 的完整镜头）
  本脚本              从素材里**截取一个 2~3 秒的片段**，再补齐到目标时长
                      —— 高信息密度版本必须这么切，否则 7.5s 素材压成 2s 会变成快进

同时生成覆盖层的 timeline.json 与 index.html（大字、快节奏、每镜一句）。

用法：
  FILM=yunche-45s python scripts/build_short.py
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _film   # noqa: E402

FF = "D:/tools/ffmpeg/bin/ffmpeg.exe"
FFPROBE = "D:/tools/ffmpeg/bin/ffprobe.exe"
FPS = 24
W, H = 1080, 1920

# 素材源片（短版复用长片素材，不重新生成）
SRC_FILM = "motion-sickness"

# 提亮：长片实测平均亮度 38~51/255，手机信息流里读作"一块黑"。
# 这里拉到 55+，同时保一点对比度避免发灰。
GRADE = "eq=brightness=0.10:gamma=1.28:contrast=0.97:saturation=1.10"
MINTERP = "minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"

ROOT = _film.FILMROOT
SRC_AI = os.path.join(os.path.dirname(ROOT), "motion-sickness", "out", "ai")


def P(*a):
    print(*a, flush=True)


def dur_of(path):
    return float(subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                                 "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip())


def main():
    overlay_only = "--overlay-only" in sys.argv
    out_dir = os.path.join(ROOT, "out")
    base_dir = os.path.join(out_dir, "base")
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(os.path.join(ROOT, "src"), exist_ok=True)

    shots = json.load(open(os.path.join(ROOT, "shotlist.json"), encoding="utf-8"))
    total = sum(s["dur"] for s in shots)
    if overlay_only:
        write_overlay(shots, total)
        P(f"✔ 仅重建覆盖层（{len(shots)} 镜 / {total:.2f}s）")
        return 0
    P(f"短版 {len(shots)} 镜  总长 {total:.2f}s")

    cum = 0.0
    prev_n = 0
    segs = []
    P("")
    P(f"{'#':3}{'素材':6}{'入点':>6}{'时长':>7}{'帧数':>7}  文案")
    P("-" * 62)
    for i, s in enumerate(shots, 1):
        src = os.path.join(SRC_AI, f"{s['clip']}.mp4")
        if not os.path.exists(src):
            P(f"✖ 缺素材 {src}")
            return 1
        cum += s["dur"]
        n_end = round(cum * FPS)
        n = n_end - prev_n
        prev_n = n_end

        dst = os.path.join(base_dir, f"b{i:02d}.mp4")
        # 从 in 点截取，重定时到目标时长，补帧到 24fps，提亮，放大
        vf = (f"trim=start={s['in']:.3f},setpts=PTS-STARTPTS,"
              f"setpts=(PTS-STARTPTS)*{(s['dur'] / s['dur']):.6f},{MINTERP},{GRADE},"
              f"scale={W}:{H}:flags=lanczos,"
              f"tpad=stop_mode=clone:stop_duration=1,trim=end_frame={n},setpts=N/({FPS}*TB)")
        subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src,
                        "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium",
                        "-crf", "16", "-pix_fmt", "yuv420p", dst], check=True)
        real = dur_of(dst)
        P(f"{i:<3}{s['clip']:6}{s['in']:>6.1f}{s['dur']:>7.2f}{n:>7}  "
          f"{s['text']}{' / ' + s['text2'] if s.get('text2') else ''}   ({real:.2f}s)")
        segs.append(dst)

    # 拼接
    lst = os.path.join(base_dir, "_concat.txt")
    with open(lst, "w", encoding="utf-8") as f:
        for p in segs:
            f.write("file '" + p.replace("\\", "/") + "'\n")
    base = os.path.join(out_dir, "base.mp4")
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", base], check=True)
    bd = dur_of(base)
    P("")
    P(f"✔ 底板 {bd:.3f}s（目标 {total:.3f}s，差 {bd - total:+.3f}s）")

    # 音轨：从原 BGM 截前 N 秒，尾部 2s 淡出
    src_bgm = os.path.join(os.path.dirname(ROOT), SRC_FILM, "out", "audio", "bgm_final.m4a")
    os.makedirs(os.path.join(out_dir, "audio"), exist_ok=True)
    bgm = os.path.join(out_dir, "audio", "bgm_final.m4a")
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", src_bgm,
                    "-t", f"{bd:.3f}", "-af", f"afade=t=out:st={bd - 2:.3f}:d=2",
                    "-c:a", "aac", "-b:a", "192k", bgm], check=True)
    P(f"✔ 音轨 {dur_of(bgm):.3f}s（尾部 2s 淡出）")

    # 覆盖层：生成 timeline.json 与 index.html
    write_overlay(shots, bd)
    P("✔ 覆盖层 src/index.html + src/timeline.json")
    return 0


ACCENT = {"red": "#FF4A2E", "cyan": "#57DFFF", "lime": "#C9FF4E", "white": "#FFFFFF"}


def write_overlay(shots, total):
    # timeline.json
    t = 0.0
    scenes = []
    for i, s in enumerate(shots, 1):
        scenes.append({"id": f"k{i}", "beats": 0, "name": s["text"] + (s.get("text2") or ""),
                       "start": round(t, 3), "dur": s["dur"]})
        t += s["dur"]
    tl = {"title": "晕车45秒版", "bpm": 112.3, "beatSec": 0.53406, "width": W, "height": H,
          "fps": FPS, "duration": round(total, 3), "scenes": scenes}
    with open(os.path.join(ROOT, "src", "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(tl, f, ensure_ascii=False, indent=2)
    # 必须同时写 timeline.js：index.html 靠 <script src> 引入，window.TIMELINE 才有值。
    # 只写 json 不写 js，覆盖层会一直等不到 __ready（合成报 Waiting failed）。
    with open(os.path.join(ROOT, "src", "timeline.js"), "w", encoding="utf-8") as f:
        f.write("window.TIMELINE = " + json.dumps(tl, ensure_ascii=False) + ";\n")

    # index.html
    body = []
    for i, s in enumerate(shots, 1):
        a2 = ACCENT.get(s.get("accent", "white"), "#FFFFFF")
        line2 = (f'<div class="t2" data-t="0.28" data-anim="rise" data-d="0.3" '
                 f'style="color:{a2}">{s["text2"]}</div>') if s.get("text2") else ""
        body.append(f'''<section class="scene" id="k{i}">
  <div class="txt">
    <div class="t1" data-t="0.02" data-anim="rise" data-d="0.26">{s["text"]}</div>
    {line2}
  </div>
</section>''')

    html = f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>晕车 45 秒版</title>
<style>
@font-face{{font-family:'NSC';src:url('file:///C:/Windows/Fonts/NotoSansSC-VF.ttf') format('truetype');font-weight:100 900;font-display:block}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#000}}
html.ov,html.ov body{{background:transparent}}
body.ov #stage{{background:transparent}}
body{{font-family:'NSC','Microsoft YaHei',sans-serif;-webkit-font-smoothing:antialiased}}
#stage{{position:relative;width:{W}px;height:{H}px;overflow:hidden;background:#07080C}}
.ov-scrim{{display:none;position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(to top,rgba(3,5,9,.92) 0%,rgba(3,5,9,.80) 24%,rgba(3,5,9,.42) 40%,rgba(3,5,9,.06) 56%,rgba(3,5,9,0) 66%),
             linear-gradient(to bottom,rgba(3,5,9,.45) 0%,rgba(3,5,9,0) 12%)}}
body.ov .ov-scrim{{display:block}}
.scene{{position:absolute;inset:0;opacity:0;visibility:hidden}}
.txt{{position:absolute;left:84px;width:912px;bottom:420px}}
.t1{{font-size:112px;font-weight:900;line-height:1.1;letter-spacing:-.03em;color:#FFF;
  -webkit-text-stroke:1.2px rgba(6,8,14,.65);
  text-shadow:0 4px 30px rgba(0,0,0,.85),0 2px 8px rgba(0,0,0,.75)}}
.t2{{margin-top:18px;font-size:96px;font-weight:900;line-height:1.12;letter-spacing:-.03em;
  -webkit-text-stroke:1.1px rgba(6,8,14,.62);
  text-shadow:0 4px 30px rgba(0,0,0,.85),0 2px 8px rgba(0,0,0,.75)}}
[data-anim]{{opacity:0}}
</style></head><body>
<div id="stage"><div class="ov-scrim"></div>
{chr(10).join(body)}
</div>
<script src="timeline.js"></script>
<script>
(function(){{
'use strict';
if(/[?&]ov=1/.test(location.search)){{document.documentElement.classList.add('ov');document.body.classList.add('ov');}}
const TL=window.TIMELINE, DUR=TL.duration;
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v, easeOut=p=>1-Math.pow(1-clamp(p),3);
const scenes=TL.scenes.map(sc=>{{const el=document.getElementById(sc.id);
  return el?{{id:sc.id,start:sc.start,end:sc.start+sc.dur,dur:sc.dur,el,
    items:[...el.querySelectorAll('[data-t]')].map(e=>({{el:e,t0:parseFloat(e.dataset.t)||0,d:parseFloat(e.dataset.d)||.3}}))}}:null;}}).filter(Boolean);
function render(t){{
  for(const sc of scenes){{
    let vis=0;
    if(t>=sc.start-.001&&t<=sc.end+.001) vis=Math.min(clamp((t-sc.start)/.10),clamp((sc.end-t)/.10));
    sc.el.style.opacity=vis.toFixed(3);
    sc.el.style.visibility=vis>.002?'visible':'hidden';
    if(vis<=.002) continue;
    for(const it of sc.items){{
      const p=clamp((t-sc.start-it.t0)/it.d), e=easeOut(p);
      it.el.style.opacity=e.toFixed(3);
      it.el.style.transform=`translate3d(0,${{((1-e)*26).toFixed(2)}}px,0)`;
    }}
  }}
}}
window.__seek=t=>render(t); window.__DUR=DUR; render(0);
document.fonts.ready.then(()=>{{render(0);window.__ready=true;}});
}})();
</script></body></html>'''
    open(os.path.join(ROOT, "src", "index.html"), "w", encoding="utf-8").write(html)


if __name__ == "__main__":
    sys.exit(main())
