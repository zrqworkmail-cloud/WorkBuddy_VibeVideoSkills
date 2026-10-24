#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""从 timeline.json 生成 src/timeline.js（供页面 file:// 直接加载），并打印节拍表。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")

with open(os.path.join(SRC, "timeline.json"), "r", encoding="utf-8") as f:
    tl = json.load(f)

beat = tl.get("beatSec", 60.0 / tl["bpm"])
t = 0.0
rows = []
for sc in tl["scenes"]:
    dur = sc["beats"] * beat
    rows.append((sc["id"], sc["name"], sc["beats"], round(t, 3), round(t + dur, 3), round(dur, 3)))
    sc["start"] = round(t, 4)
    sc["end"] = round(t + dur, 4)
    sc["dur"] = round(dur, 4)
    t += dur

tl["beat"] = round(beat, 6)
tl["duration"] = round(t, 4)
tl["totalBeats"] = sum(s["beats"] for s in tl["scenes"])

js = "window.TIMELINE = " + json.dumps(tl, ensure_ascii=False, indent=2) + ";\n"
with open(os.path.join(SRC, "timeline.js"), "w", encoding="utf-8") as f:
    f.write(js)

print(f"BPM {tl['bpm']}  beat {beat:.5f}s  total {tl['totalBeats']} beats  =  {t:.3f}s")
print("-" * 62)
print(f"{'id':<4}{'beats':>6}{'start':>9}{'end':>9}{'dur':>8}   name")
for r in rows:
    print(f"{r[0]:<4}{r[2]:>6}{r[3]:>9.2f}{r[4]:>9.2f}{r[5]:>8.2f}   {r[1]}")
print("-" * 62)
print(f"total duration: {t:.3f}s  ({t/60:.2f} min)")
