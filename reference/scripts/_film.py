#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""影片路径解析（Python 侧）。

多片共用一个 scripts/ 目录：用环境变量 FILM 选择影片。
  FILM 未设        → 参考实现（reference 根，即第一支片）
  FILM=motion-sickness → films/motion-sickness/

用法：
  FILM=motion-sickness python scripts/build_timeline.py
  python scripts/build_timeline.py            # 仍是旧片，行为不变
"""
import os

WB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # reference
FILM = os.environ.get("FILM", "").strip()
FILMROOT = os.path.join(WB, "films", FILM) if FILM else WB
SRC = os.path.join(FILMROOT, "src")
OUT = os.path.join(FILMROOT, "out")


def p_src(*parts):
    return os.path.join(SRC, *parts)


def p_out(*parts):
    return os.path.join(OUT, *parts)


def timeline():
    """读 timeline.json（返回 dict）。"""
    import json
    with open(p_src("timeline.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_out(*parts):
    """确保 out 下某目录存在并返回路径。"""
    d = p_out(*parts)
    os.makedirs(d, exist_ok=True)
    return d
