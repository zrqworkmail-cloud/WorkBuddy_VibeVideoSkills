#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""工作流同步：把本地改动提交并推送到 GitHub。

为什么单独写脚本而不是直接 git push：
  1) 需要"无改动时安静退出"，否则定时任务每天报一次错，很快就没人看了
  2) push 需要重试——网络抖动很常见，一次失败不代表通道坏了
  3) 提交信息要能自动生成，且带日期，方便回溯是哪次自动同步

安全边界：
  - `out/`（成片/底板/帧，数百 MB）与 `node_modules/` 已在 .gitignore，不会被提交
  - 单文件超 100MB 会被 GitHub 拒收，脚本会先扫一遍暂存区做拦截

用法：
  python scripts/sync_workflow.py                      # 自动提交信息
  python scripts/sync_workflow.py -m "docs: 补充xx"     # 指定提交信息
  python scripts/sync_workflow.py --dry-run            # 只看会提交什么
"""
import argparse
import os
import subprocess
import sys
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))      # vibe-knowledge-video/
GIT_NAME = "Ruoquan Zhou"
GIT_EMAIL = "252115044@stu.sdufe.edu.cn"
MAX_FILE_MB = 95


def run(args, check=True, capture=True):
    r = subprocess.run(args, cwd=REPO, capture_output=capture, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"{' '.join(args)} 失败：{(r.stderr or r.stdout)[:400]}")
    return r


def staged_files():
    r = run(["git", "diff", "--cached", "--name-only"], check=False)
    return [l for l in r.stdout.splitlines() if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--message", default="")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    if not os.path.isdir(os.path.join(REPO, ".git")):
        print(f"✖ 不是 git 仓库：{REPO}")
        return 1

    run(["git", "add", "-A"])
    files = staged_files()
    if not files:
        print("· 工作区干净，无需同步")
        return 0

    # 大文件拦截（GitHub 单文件上限 100MB，超了整次推送都会失败）
    big = []
    for f in files:
        p = os.path.join(REPO, f)
        if os.path.exists(p) and os.path.getsize(p) > MAX_FILE_MB * 1024 * 1024:
            big.append((f, os.path.getsize(p) / 1048576))
    if big:
        print("✖ 以下文件超过 %dMB，GitHub 会拒收，请先加入 .gitignore：" % MAX_FILE_MB)
        for f, mb in big:
            print(f"   {mb:8.1f}MB  {f}")
        return 2

    print(f"待提交 {len(files)} 个文件：")
    for f in files[:20]:
        print(f"   {f}")
    if len(files) > 20:
        print(f"   … 其余 {len(files) - 20} 个")

    if a.dry_run:
        print("（--dry-run，未提交）")
        return 0

    msg = a.message or f"chore(workflow): 自动同步 {datetime.now():%Y-%m-%d %H:%M}"
    run(["git", "-c", f"user.name={GIT_NAME}", "-c", f"user.email={GIT_EMAIL}",
         "commit", "-q", "-m", msg])
    head = run(["git", "log", "--oneline", "-1"]).stdout.strip()
    print(f"✔ 已提交 {head}")

    # 先试标准通道。本机代理通常拦 github.com:443，所以大概率会失败，
    # 因此只试 2 次（每次要等代理超时约 20 秒），然后转 API 通道。
    for attempt in range(1, 3):
        r = run(["git", "push", "origin", "main"], check=False)
        if r.returncode == 0:
            print("✔ 已推送到 origin/main")
            return 0
        err = (r.stderr or r.stdout).strip().splitlines()
        print(f"  第 {attempt}/2 次 git push 失败：{err[-1] if err else '未知错误'}")
        if attempt < 2:
            time.sleep(3)

    print("· git push 不通（代理拦 github.com:443），改用 GitHub API 推送…")
    try:
        import _gh_api
        ok, msg = _gh_api.push_via_api()
    except Exception as e:
        ok, msg = False, f"{type(e).__name__}: {str(e)[:300]}"

    if ok:
        print(f"✔ {msg}")
        return 0

    print(f"✖ API 推送也失败：{msg}")
    print("  本地已提交，未丢失；可稍后手动重跑本脚本。")
    return 3


if __name__ == "__main__":
    sys.exit(main())
