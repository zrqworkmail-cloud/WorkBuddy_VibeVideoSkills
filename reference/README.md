# reference/ · 参考实现

跑通过的一套代码，可当模板抄。解决的是"**逐帧确定性渲染 + AI 素材 + 文字覆盖层**"这一类问题，产出过 1080×1920 / 24fps / 136.7s 的竖版科普片，以及 1920×1080 / 213s 的横版历史片。

> 这里的路径与参数都是**某次实现的示例**。换项目时替换成你自己的，但**步骤顺序与判据不变**——见 `../skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow/SKILL.md`。

## 两代实现

| 代 | 目录 | 技术栈 | 状态 |
|---|---|---|---|
| **初代** | `src/` `scripts/` | HTML + Puppeteer 逐帧截图 + ffmpeg | 可用，偏重 |
| **二代** | `remotion/` | Remotion 4 + SVG，纯代码渲染 | **推荐**，单镜十几秒出片 |

## 文件地图（初代）

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
| `scripts/qc_rhythm.py` | **节奏体检**：最长连续冻结 ≤3s / 静止占比 / 运动能量 |
| `scripts/analyze_motion.py` | 从素材提取区域信号 → 驱动数据动画 |
| `scripts/_ovqc.js` | 多时间点覆盖层质检 + JS 报错捕获 |
| `tools/oss-skills/` | 嫁接的开源技能库（文案/动效/构图/QC 判据） |

## 文件地图（二代 · Remotion）

| 路径 | 作用 |
|---|---|
| `remotion/src/Root.tsx` | 注册所有 Composition（成片 + 各尺寸封面） |
| `remotion/src/<片子>.tsx` | 单个片子的全部场景与时间轴 |
| `remotion/src/<片子>Cover*.tsx` | 封面组件（16:9 / 4:3 / 3:4 各一版） |
| `remotion/qc.py` | 节奏质检（自动探测画幅，横竖通用） |
| `remotion/gen_bgm_extend.py` | BGM 延长剪辑（相似段交叉接续） |
| `remotion/gen_sfx.py` | 事件音效合成（战鼓/马蹄/开城/钟声） |

## 环境依赖

```bash
npm i puppeteer-core --no-save     # 初代：用系统 Chrome，不下载 Chromium
cd remotion && npm i               # 二代：Remotion
```

- Node.js（截图与合成）
- ffmpeg（可用 `imageio-ffmpeg` 自带的，不必装系统版）
- Chrome（`puppeteer-core` 通过 `executablePath` 指向系统 Chrome；Remotion 用 Playwright 的 Chromium）
- Wan2.2 I2V（ComfyUI）——**可替换**成其他 I2V/T2V 模型或实拍素材

## 快速验证管线

```bash
node -e "require.resolve('puppeteer-core')"        # 初代依赖是否就位
python scripts/build_timeline.py                    # 时间轴是否自洽
node scripts/scene_preview.js s1 3 --base           # 单镜预览是否出图

cd remotion && ./node_modules/.bin/remotion still src/index.ts <Composition> out/test.png   # 二代出图
```

## 产物

`out/`（初代成片与素材）与 `remotion/out/`（二代成片）都在 `.gitignore` 里，**不入库**。

重建方式：

```bash
python scripts/build_base.py      # 重建底板（几分钟，不需要 GPU）
node scripts/composite.js 24      # 合成（约 7 分钟）
```
