#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""GitHub API 推送（git push 走不通时的备用通道）。

为什么需要它
------------
本机没有直出网络，一切走透明代理 `127.0.0.1:63543`；该代理**放行 api.github.com，
但拦截 github.com:443**（`CONNECT tunnel failed, response 502`）。所以 `git push`
（走 github.com 的 git-upload-pack）必然失败，而 REST API 是通的。

核心难点：不能让本地与远程 SHA 分叉
----------------------------------
直接"上传文件 → 造个新 commit → 更新 ref"会得到一个内容相同但 SHA 不同的提交。
之后本地 HEAD 与远程 head 就不是同一条链，`git push` 会被判非快进而永久失败，
而且本地缺少远程那个 commit 对象，`git log` 都会报错。

解法：**逐字节复刻本地提交**。Git 的 commit SHA 是内容寻址的，只要以下全部一致，
GitHub 算出的 SHA 就与本地相同：
  - tree（文件清单：路径 + 模式 + blob SHA）
  - parents（父提交 SHA）
  - author / committer（姓名、邮箱、**时间戳与时区**）
  - message（**含末尾换行**）
每造一个 commit 都立刻用 `git rev-parse <sha>^{tree}` 校验 tree，不一致就中止，
绝不把分叉写进远程。

用法（一般由 sync_workflow.py 调用）：
  from _gh_api import push_via_api
  ok, msg = push_via_api()
"""
import base64
import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
BASE = "https://api.github.com"


# ---------------- git 辅助 ----------------
def _git(args, binary=False):
    # core.quotepath=false：否则中文路径会被输出成 "\350\247\206..." 这种八进制转义，
    # 拿去 cat-file 直接失败（本仓库有中文文件名，必然踩到）。
    r = subprocess.run(["git", "-c", "core.quotepath=false"] + args,
                       cwd=REPO, capture_output=True)
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", "replace")[:400]
        raise RuntimeError(f"git {' '.join(args)} 失败：{err}")
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


def token():
    """从 Windows 凭据库取 PAT（git credential fill 不联网，只读本地 helper）。"""
    r = subprocess.run(["git", "credential", "fill"], cwd=REPO,
                       input="protocol=https\nhost=github.com\n\n",
                       capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.startswith("password="):
            return line[len("password="):].strip()
    raise RuntimeError("取不到 GitHub 凭据（git credential fill 无 password）")


def owner_repo():
    url = _git(["remote", "get-url", "origin"]).strip()
    m = re.search(r"github\.com[:/]([^/]+)/(.+?)(?:\.git)?$", url)
    if not m:
        raise RuntimeError(f"无法从 remote 解析 owner/repo：{url}")
    return m.group(1), m.group(2)


# ---------------- API ----------------
def api(method, path, tok, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Authorization": "Bearer " + tok,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "Content-Type": "application/json",
                 "User-Agent": "workbuddy-sync"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} → {e.code}: {e.read().decode()[:400]}")


# ---------------- 提交对象解析 ----------------
def commit_info(sha):
    raw = _git(["cat-file", "commit", sha], binary=True)
    head, _, msg = raw.partition(b"\n\n")
    info = {"tree": None, "parents": [], "author": None, "committer": None,
            "message": msg.decode("utf-8", "replace")}
    for line in head.split(b"\n"):
        if line.startswith(b"tree "):
            info["tree"] = line[5:].decode()
        elif line.startswith(b"parent "):
            info["parents"].append(line[7:].decode())
        elif line.startswith(b"author "):
            info["author"] = line[7:].decode()
        elif line.startswith(b"committer "):
            info["committer"] = line[10:].decode()
    return info


def ident(s):
    """'Name <email> 1793000000 +0800' → API 需要的 {name,email,date}。"""
    m = re.match(r"^(.*?) <(.*?)> (\d+) ([+-]\d{4})$", s)
    if not m:
        raise RuntimeError(f"无法解析身份行：{s}")
    name, email, ts, tz = m.groups()
    sign = 1 if tz[0] == "+" else -1
    off = timedelta(hours=int(tz[1:3]), minutes=int(tz[3:5])) * sign
    return {"name": name, "email": email,
            "date": datetime.fromtimestamp(int(ts), timezone(off)).isoformat()}


def changed(c):
    """返回 [(new_mode, path)]，含新增/修改/删除（删除时 new_mode 为 000000）。"""
    out = _git(["diff-tree", "-r", "--no-commit-id", "--raw", f"{c}^", c])
    rows = []
    for line in out.splitlines():
        if not line.startswith(":"):
            continue
        meta, _, path = line.partition("\t")
        fields = meta[1:].split()
        new_mode = fields[1]
        if "\t" in path:            # 重命名：old \t new
            path = path.split("\t")[-1]
        rows.append((new_mode, path))
    return rows


# ---------------- 主流程 ----------------
def push_via_api(branch="main"):
    tok = token()
    owner, repo = owner_repo()
    head = _git(["rev-parse", "HEAD"]).strip()
    ref = api("GET", f"/repos/{owner}/{repo}/git/ref/heads/{branch}", tok)
    remote = ref["object"]["sha"]

    if remote == head:
        return True, "远程已是最新"

    try:
        commits = _git(["rev-list", "--reverse", f"{remote}..HEAD"]).split()
    except RuntimeError:
        return False, "本地缺少远程提交对象，无法计算差异（需要先同步远程）"
    if not commits:
        return False, f"本地没有领先远程的提交（远程 {remote[:8]} 可能已前进）"

    cur_tree = _git(["rev-parse", f"{remote}^{{tree}}"]).strip()
    for c in commits:
        info = commit_info(c)
        entries = []
        for mode, path in changed(c):
            if mode == "000000":                       # 删除
                entries.append({"path": path, "mode": "100644",
                                "type": "blob", "sha": None})
                continue
            if mode == "160000":                       # 子模块
                sub = _git(["rev-parse", f"{c}:{path}"]).strip()
                entries.append({"path": path, "mode": mode,
                                "type": "commit", "sha": sub})
                continue
            blob = _git(["cat-file", "blob", f"{c}:{path}"], binary=True)
            b = api("POST", f"/repos/{owner}/{repo}/git/blobs", tok,
                    {"content": base64.b64encode(blob).decode(), "encoding": "base64"})
            entries.append({"path": path, "mode": mode, "type": "blob", "sha": b["sha"]})

        t = api("POST", f"/repos/{owner}/{repo}/git/trees", tok,
                {"base_tree": cur_tree, "tree": entries})
        cur_tree = t["sha"]

        # 关键校验：造出来的 tree 必须与本地一致，否则立刻停手
        local_tree = _git(["rev-parse", f"{c}^{{tree}}"]).strip()
        if cur_tree != local_tree:
            return False, (f"tree 与本地不一致（本地 {local_tree[:8]} / 远端 {cur_tree[:8]}），"
                           f"已中止以免 SHA 分叉")

        cm = api("POST", f"/repos/{owner}/{repo}/git/commits", tok,
                 {"message": info["message"], "tree": cur_tree,
                  "parents": info["parents"],
                  "author": ident(info["author"]),
                  "committer": ident(info["committer"])})
        if cm["sha"] != c:
            return False, (f"commit SHA 未能复刻（本地 {c[:8]} / 远端 {cm['sha'][:8]}），"
                           f"已中止以免分叉")
        print(f"   · 已复刻提交 {c[:8]}  {info['message'].splitlines()[0][:50]}")

    api("PATCH", f"/repos/{owner}/{repo}/git/refs/heads/{branch}", tok,
        {"sha": head, "force": False})
    # 同步远程跟踪引用，避免本地误以为"领先远程"
    try:
        _git(["update-ref", f"refs/remotes/origin/{branch}", head])
    except RuntimeError:
        pass
    return True, f"API 推送成功（{len(commits)} 个提交，{head[:8]}）"


if __name__ == "__main__":
    ok, msg = push_via_api()
    print(("✔ " if ok else "✖ ") + msg)
    raise SystemExit(0 if ok else 1)
