# WorkbuddyWorkflow

这里沉淀**用 Workbuddy 跑通、可复用的工作流**。每条工作流都包含三部分：

1. **通用流程**——脱离具体项目也能用的方法与判据
2. **参考实现**——跑通过的一套代码，可当模板抄
3. **演进记录**——为什么这么设计，踩过哪些坑

---

## 目录

```
WorkbuddyWorkflow/
├── 视频制作通用流程.md        ← 通用 SOP（先读这个）
├── 视频制作流程演进记录.md     ← 决策记录：为什么这么改
├── src/                      ← 参考实现：时间轴、覆盖层、概念帧
├── scripts/                  ← 参考实现：构建与渲染脚本
├── tools/oss-skills/         ← 嫁接的开源技能库
└── skills/                   ← 本地技能（可复制到 ~/.workbuddy-ai/skills/）
```

---

## 视频制作

### 怎么开始

- **要做一支新片** → 读 [《视频制作通用流程.md》](./视频制作通用流程.md)，按第 2 节填七参数表，再走八步流程
- **想知道为什么这么设计** → 读 [《视频制作流程演进记录.md》](./视频制作流程演进记录.md)
- **想直接抄代码** → 看下面的参考实现

### 参考实现说明

这套实现解决的是"**逐帧确定性渲染 + AI 素材 + 文字覆盖层**"这一类问题，跑通过一支 1080×1920 / 24fps / 136.7s 的竖版科普片。

#### 文件地图

| 路径 | 作用 |
|---|---|
| `src/timeline.json` | 分镜表（id / 拍数 / 名称），**改这里** |
| `src/timeline.js` | 由构建脚本生成，勿手改 |
| `src/index.html` | 全部画面：每镜一个 `<section id=sN>`、入场动画属性、逐帧函数、卡点光效 |
| `src/cN.html` | 概念首帧（SVG 绘制），渲染成 png 作为 AI 生成的首帧 |
| `src/drive.js` | 画面实测数据，驱动读数类动画 |
| `scripts/build_timeline.py` | 时间轴 json → js，打印节拍表 |
| `scripts/concept_render.js` | 概念帧 html → png |
| `scripts/wan22.py` | I2V 模型提交器（提示词表 / 负面词 / 采样配置） |
| `scripts/gen_one.py` | **单镜可靠生成**（提交→轮询→下载→磁盘兜底），推荐入口 |
| `scripts/gpu_gate.py` | GPU 让渡门控：利用率 + 空闲显存硬门槛 |
| `scripts/build_base.py` | 素材层：调色/特效、裁头尾、分段定速、构图调整、慢放插帧、拼接 |
| `scripts/composite.js` | 成片：逐帧截图透明覆盖层 → 叠加素材层 + BGM |
| `scripts/scene_preview.js` | **单镜秒级预览**（调文案/时序的第一工具） |
| `scripts/qc_rhythm.py` | **节奏体检**：每镜最长静止 ≤3s / 静止占比 / 运动能量 |
| `scripts/analyze_motion.py` | 从素材提取区域信号 → 驱动数据动画 |
| `scripts/_ovqc.js` | 多时间点覆盖层质检 + JS 报错捕获 |
| `tools/oss-skills/` | 嫁接的开源技能库（文案/动效/构图/QC 判据） |

#### 环境依赖

```bash
npm i puppeteer-core --no-save     # 使用系统 Chrome，不下载 Chromium
```

- Node.js（截图与合成）
- ffmpeg（脚本内路径可配，当前硬编码 `D:/tools/ffmpeg/bin/ffmpeg.exe`）
- Chrome（`puppeteer-core` 通过 `executablePath` 指向系统 Chrome）
- Wan2.2 I2V（ComfyUI）——**可替换**成其他 I2V/T2V 模型或实拍素材

#### 快速验证管线是否可用

```bash
node -e "require.resolve('puppeteer-core')"     # 依赖是否就位
python scripts/build_timeline.py                # 时间轴是否自洽
node scripts/scene_preview.js s1 3 --base       # 单镜预览是否出图
```

---

## 约定

- **产物不入库**：`out/`（成片、素材、帧）与 `node_modules/` 已加入 `.gitignore`
- **文档分工**：通用流程答"怎么做"，演进记录答"为什么这么改"，两者不重复
- **数值不神圣**：文档里所有具体参数都是参考实现的实例，换题材时按第 10 节判断改什么、留什么
