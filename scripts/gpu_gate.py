#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""GPU 让渡门控（GPU courtesy gate）。

规则：**只在确认 GPU 空闲时才提交任务，被占用一律排队等待，绝不抢占他人算力。**

判定 GPU「被占用」的三类信号（任一命中即等待）：
  1) 外部生成进程：存在别的 python 生成脚本（wan_i2v / i2v / t2v / hunyuan / rife / sample_video ...）
     —— 自己的 wan22.py 与自己启动的 ComfyUI 服务（main.py --listen）除外。
  2) ComfyUI 队列里有别人排的活：/queue 的 running + pending 计数 > 0。
  3) GPU 持续高利用率：nvidia-smi 采样数点均值 > GPU_BUSY_UTIL%。

每 GPU_INTERVAL 秒复查一次；每 GPU_LOG_EVERY 秒向控制台报一次等待状态（不刷屏）。
wait_gpu() 返回已等待秒数。
"""
import json
import subprocess
import time
import urllib.request

SERVER = "http://127.0.0.1:8188"
GPU_INTERVAL = 60            # 复查间隔（秒）
GPU_LOG_EVERY = 300           # 等待状态播报间隔（秒）
GPU_BUSY_UTIL = 45            # GPU 利用率阈值（%）
GPU_UTIL_SAMPLES = 3          # 每次判定连续采样点数
GPU_FREE_FLOOR_MIB = 9000     # 空闲显存下限（MiB）：Wan2.2 双专家峰值 ~9-10GB

# 我们自己的进程标识（不应被判为"外部占用"）
OUR_MARKERS = ("wan22.py", "gpu_gate")
# 生成类脚本关键词（命中即视为外部占卡任务）
GEN_KEYWORDS = ("wan_i2v", "wan_", "i2v", "t2v", "hunyuan", "rife",
                "sample_video", "generate.py", "inference.py", "predict.py",
                "video_", "demo.py", "run_inference", "stretch.py")


def _python_cmds():
    """返回本机 python.exe 进程的命令行列表。"""
    ps = ("powershell -NoProfile -Command "
          "\"Get-CimInstance Win32_Process -Filter \\\"Name='python.exe'\\\" "
          "| Select-Object -ExpandProperty CommandLine\"")
    try:
        out = subprocess.run(ps, shell=True, capture_output=True, text=True,
                             timeout=60).stdout or ""
    except Exception:
        return []
    return [l.strip() for l in out.splitlines() if l.strip()]


def foreign_generators():
    """外部正在跑生成任务的进程命令行（排除自己的）。"""
    bad = []
    for line in _python_cmds():
        low = line.lower()
        if any(m in low for m in OUR_MARKERS):
            continue                       # 自己的提交器/门控
        if "main.py" in low and "--listen" in low:
            continue                       # 自己启动的 ComfyUI 服务端
        if any(k in low for k in GEN_KEYWORDS):
            bad.append(line)
    return bad


def comfyui_queue_len():
    """ComfyUI 队列中的任务数（含正在跑 + 排队）。"""
    try:
        with urllib.request.urlopen(SERVER + "/queue", timeout=8) as r:
            d = json.load(r)
        return len(d.get("queue_running", [])) + len(d.get("queue_pending", []))
    except Exception:
        return 0


def gpu_util_samples(n=GPU_UTIL_SAMPLES):
    vals = []
    for _ in range(n):
        try:
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=utilization.gpu",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=20).stdout.strip()
            vals.append(int(out.split(",")[0]))
        except Exception:
            vals.append(-1)
        time.sleep(2)
    return vals


def gpu_free_mib():
    """当前空闲显存（MiB）。读不到返回 None。"""
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=20).stdout.strip()
        return int(out.split()[0])
    except Exception:
        return None


def gpu_busy_reason():
    """返回 None 表示空闲，否则返回占用原因描述。"""
    foreign = foreign_generators()
    if foreign:
        return f"外部生成进程 {len(foreign)} 个：{foreign[0][:120]}"
    q = comfyui_queue_len()
    if q > 0:
        return f"ComfyUI 队列有 {q} 个任务在跑/排队"
    vals = gpu_util_samples()
    ok = [v for v in vals if v >= 0]
    if ok:
        avg = sum(ok) / len(ok)
        if avg > GPU_BUSY_UTIL:
            return f"GPU 利用率 {avg:.0f}%（采样 {vals}）"
    # 空闲显存下限：Wan2.2 I2V 双专家峰值约需 9~10GB。只看利用率会漏判——
    # 曾出现"利用率 3%、但外部进程瞬时占了 ~9GB"，导致第二段 KSampler(node 10) OOM。
    # 这里加一道硬门槛：空闲显存不足就再等等，绝不带着 OOM 风险提交。
    free = gpu_free_mib()
    if free is not None and free < GPU_FREE_FLOOR_MIB:
        return f"空闲显存仅 {free} MiB（<{GPU_FREE_FLOOR_MIB} MiB 门槛），有 OOM 风险"
    return None


def wait_gpu(interval=GPU_INTERVAL, log_every=GPU_LOG_EVERY, max_wait=None):
    """阻塞直到 GPU 空闲；返回累计等待秒数。"""
    waited = 0
    last_log = -log_every
    while True:
        reason = gpu_busy_reason()
        if reason is None:
            if waited:
                print(f"[gate] GPU 已空闲（等待 {waited // 60} 分 {waited % 60} 秒）→ 开始提交",
                      flush=True)
            return waited
        if waited - last_log >= log_every:
            print(f"[gate] GPU 被占用：{reason} → 让渡等待中，已等 "
                  f"{waited // 60} 分 {waited % 60} 秒（下次 {interval}s 后复查）", flush=True)
            last_log = waited
        if max_wait is not None and waited >= max_wait:
            print(f"[gate] 已达最长等待 {max_wait}s，GPU 仍被占用：{reason}", flush=True)
            return waited
        time.sleep(interval)
        waited += interval


if __name__ == "__main__":
    t0 = time.time()
    wait_gpu()
    print(f"[gate] 空闲确认耗时 {time.time() - t0:.0f}s")
