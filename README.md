# vibe-knowledge-video

竖版科普短视频（1080×1920 / 24fps）的**逐帧确定性渲染管线**。参考成片《为什么越熬夜越精神》。

核心思路：所有动画都是时间 `lt` 的纯函数（`render(lt)` / `FNS.sN(lt,t,el)`），任意一帧可复现、可定位、可对比。AI 底板（Wan2.2 I2V）与文字覆盖层分离渲染，最后一次性合成。

## 目录结构

| 路径 | 职责 |
|---|---|
| `src/index.html` | 覆盖层主文件，每镜一个 `<section id=sN>` |
| `src/timeline.json` / `.js` | 时间轴（浏览器只读 js，改 json 后必须重新生成） |
| `src/c1-c14.html` | 各镜概念首帧，用于生成 AI 底板 |
| `scripts/` | 构建与渲染脚本（见下） |
| `tools/oss-skills/` | 开源技能参考（anything2explainer / video-shotcraft） |
| `out/` | 渲染产物（**不入库**，约 673MB） |

## 八步流程

```bash
# 1. 定节奏
python scripts/build_timeline.py

# 2-3. 概念首帧 → 生成 AI 底板
node scripts/concept_render.js 3
python scripts/gen_one.py 3 12345 121

# 4. 建底板（只重建改动镜头）
python scripts/build_base.py 3,7,13

# 5. 做覆盖层：编辑 src/index.html

# 6. 单镜预览（每次改画面必做）
node scripts/scene_preview.js s6 5 --base

# 7. 合成
node scripts/composite.js 24

# 8. 质检
python scripts/qc_rhythm.py
```

## 环境依赖

- Node.js（`puppeteer-core`，使用系统 Chrome）
- ffmpeg：脚本内硬编码为 `D:/tools/ffmpeg/bin/ffmpeg.exe`
- Chrome：`C:/Program Files/Google/Chrome/Application/chrome.exe`
- Wan2.2 I2V（ComfyUI）用于生成底板素材

```bash
npm i puppeteer-core --no-save
```

## 三条铁律

1. 改 `timeline.json` 后必须重生成 `timeline.js`。
2. 拍数变了的镜头必须重建 base 分段。
3. 覆盖层按全局 `t` 驱动，base 按拼接顺序对齐，两边都只认 timeline。

## 文档

- `视频制作工作流.md` — 操作手册，新片直接照做
- `视频制作流程优化建议.md` — 决策记录与开源技能评估

## 质检判据

- `qc_rhythm.py` 必过：最长静止 ≤ 3s
- 音画时长误差 ≤ 0.06s
- 关键帧像素抽检
- 音频电平 mean ≈ -15dB
