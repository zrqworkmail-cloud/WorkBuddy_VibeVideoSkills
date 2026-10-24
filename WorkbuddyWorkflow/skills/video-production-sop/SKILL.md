---
name: video-production-sop
description: 代码逐帧渲染视频的通用生产流程（时间轴定节奏 → 素材层 → 透明覆盖层 → 合成 → 量化质检）。适用于任何由代码按时间计算画面的短视频：知识科普、数据解说、产品演示、动画短片，竖版横版皆可。当用户要制作/修改这类视频，或提到 timeline.json、build_base、composite、qc_rhythm、FNS 场景动画、scene_preview、I2V 底板、逐帧渲染时使用。Deterministic frame-by-frame video production SOP, any subject and aspect ratio.
agent_created: true
---

# 代码逐帧渲染视频 · 通用生产流程（video-production-sop）

## 何时使用

- 制作或修改**画面由代码按时间计算**的短视频：知识科普、数据解说、产品演示、动画短片。
- 竖版（9:16）与横版（16:9）都适用；本文的具体数值来自竖版参考实现，换画幅只需改参数。
- 排查这类管线的问题：文字消失、慢放掉帧、音画错位、生成 OOM、成片"卡住"。
- 不适用：真人口播、纯剪辑（非代码渲染）、复杂三维。

> 完整方法论（七参数决策表、迁移清单、判据来源）见仓库 `WorkbuddyWorkflow/视频制作通用流程.md`；
> 本文是给执行用的浓缩版，判据与硬规则优先。

## 核心思想

1. **逐帧确定性渲染**：所有动画是时间 `lt` 的纯函数（`render(lt)` / `FNS.sN(lt,t,el)`），任意一帧可复现、可定位、可对比。
2. **三层分离**：素材层（AI/实拍/渲染）+ 覆盖层（文字图形，透明）+ 音轨，各自生成后一次性合成。
3. **量化质检**：不靠"看着还行"，靠判据（最长静止 ≤3s、时长误差 ≤0.06s、关键帧像素特征）。

## 时间模型（一切对齐的基准）

| 项 | 规则 |
|---|---|
| 节奏基准 | 有 BGM 用 BPM（每拍 = 60/BPM）；无 BGM 用固定镜头时长 |
| 分镜时长 | `拍数 × 每拍` —— 唯一公式，素材层与覆盖层都必须服从 |
| 全片 | **总拍数守恒**：Σ拍数 × 每拍 = 成片时长 = 音轨时长 |
| 帧率 | 全片统一（参考实现 24fps）；素材层与覆盖层必须一致 |
| BGM | 合成时**不加 `-shortest`**（会裁尾帧） |

参考实现实例：BPM 112.3 → 每拍 0.53406s；256 拍 = 136.719s；14 镜。**数值是示例，不是规范。**


**三条铁律**
1. 改 `timeline.json` 后必须重生成 `timeline.js`（浏览器只读 js）。
2. **拍数变了的镜头必须重建 base 分段**，否则旧分段与新时间轴错位。
3. 覆盖层按全局 `t` 驱动，base 按拼接顺序对齐——两边都只认 timeline，不要各自写死时间。

## 八步流程

> 命令与路径是**参考实现**（仓库 `WorkbuddyWorkflow/src|scripts`）的写法。换项目/换画幅时替换成你的路径，
> 步骤顺序与判据不变。

1. **定节奏**：改 `src/timeline.json` → `python scripts/build_timeline.py`，核对总拍数与每镜时长。
2. **概念首帧**：`src/cN.html` → `node scripts/concept_render.js <N>` → `out/ai/concepts/cN.png`（704×1280）。
3. **生成底板**：提示词写进 `scripts/wan22.py` 的 `SCENES[N]`（四查：细节充分/契合功能/同向概念帧/区别于他镜），`python scripts/gen_one.py <N> <seed> 121`。
   - **必带运动**：不写 "completely still"；写慢眨眼、呼吸、光效明灭、极缓推近。静止素材会触发节奏缺陷。
4. **建底板**：`python scripts/build_base.py 3,7,13`（只重建改动镜头）。配置项：`LOOK` 调色/特效、`TRIM/TRIM_END` 裁头尾、`PARTS_TIMED` 分段定速、`GEO` 改构图、慢放 `setpts+minterpolate`。
5. **做覆盖层**：在 `src/index.html` 的 `<section id=sN>` 加 `data-t/data-anim/data-d`；需要逐帧逻辑写 `FNS.sN(lt,t,el)`；卡点光效配 `FLASH[N]`。
6. **单镜预览（每次改画面必做）**：`node scripts/scene_preview.js s6 5 --base`，秒级出图，查排版/时序/构图 + JS 报错。
7. **合成**：`node scripts/composite.js 24`（Puppeteer 逐帧截图 → ffmpeg 叠加 base+BGM）。
8. **质检交付**：`python scripts/qc_rhythm.py` 必过 + `ffprobe` 音画时长一致 + 关键帧像素抽检 + 音频电平（mean≈-15dB）。

## 渲染层五条硬规则（违反必出 bug）

1. **禁止 CSS transition / keyframes**——逐帧 seek 会抖，动画全部由 `render(lt)` 计算。
2. **禁止 `Math.random()`**——每帧重算会跳，用确定性 `rng(seed)`。
3. **禁止 `background-clip:text`**——无头 Chrome 合成层丢渐变填充（字变透明）；用纯色 + text-shadow 光晕。
4. **带样式的原子标签不可拆字**（`tx-grad/tx-mark/tx-serif` 等），拆了样式丢失、字消失。
5. **慢放素材要与动画同步**：视频放慢 K 倍时，在 FNS 首行 `lt/=K` 把本地时间压回设计时刻表（保证动作落点仍等于画面事件）。

## 三道质检闸门

| 闸门 | 工具 | 判据 | 时机 |
|---|---|---|---|
| ① 单镜 | `scene_preview.js` | 无 JS 报错；排版/时序/构图 | 每次改画面 |
| ② 节奏 | `qc_rhythm.py` | **每镜最长静止 ≤3.0s**；静止占比>45% 提示 | 合成后 |
| ③ 成片 | ffprobe + 像素统计 | 时长严丝合缝；关键帧特征（如落点、文字带亮度、光效搏动）；音频电平 | 交付前 |

## 踩坑速查（症状 → 根因 → 规则）

| 症状 | 根因 | 规则 |
|---|---|---|
| 字消失/透明 | `background-clip:text` 丢填充 | 纯色 + 光晕 |
| 慢放掉帧/幻灯片 | `fps` 复制帧 | `setpts` + `minterpolate=mi_mode=mci` |
| 拼接后总长被压缩 | 多段 xfade 塞一条 filtergraph，offset 错位 | 分步 concat，每步校验 |
| `-ss/-to` 时长不对 | 放在 `-i` 之后被当输出限制 | 输入侧裁剪，放 `-i` 前 |
| 生成 OOM（node 10） | 外部进程瞬时占显存，门控只看利用率% | 空闲显存硬门槛（≥9GB） |
| 误判"两个 ComfyUI 抢端口" | venv 与 uv python 是父子进程=同一服务 | 查 ParentProcessId |
| 后台任务莫名消失 | shell 里加 `&` 随 shell 退出被连坐 | 用托管后台任务 |
| 成片下部很黑 | `.ov-scrim` 覆盖层压暗渐变，设计如此 | 勿与未加 scrim 的底板对比误判 |
| 慢推加了没效果 | 镜头级速率（5%/1.5s）拉长到整镜慢 20 倍 | 镜头级用，或换素材 |
| 周期性光效"无差异" | 跨拍抽帧被底板慢漂移混淆 | 抽**同拍相邻帧** |
| 单镜时长错位 | 改了 beats 却复用旧分段 | 改拍数必须重建该镜 |

## 资源

- **`WorkbuddyWorkflow/视频制作通用流程.md`（仓库内）**：完整方法论——七参数决策表、通用八步、迁移清单、判据出处。做新题材先读这份。
- `references/workflow-sop.md`：完整 SOP（文件地图、更详细的步骤与自检项）。
- `references/qc_rhythm.py`：节奏体检参考实现（拷进项目 scripts/ 并改路径即可用）。
- `references/narration-guidance.md`：口播文案 13 条写作原则（出处 anything2explainer，★2.7k）。
- `references/motion-vocabulary.md`：动效词表——入场/强调/光效/离场/运镜的帧数公式（同上）。
- `references/composition-and-light.md`：构图与光、主体尺寸三档、QC 量化判据（同上）。
- `references/lessons.md`：踩坑与根因集（同上）。
- 上述开源文档仅作本地参考，版权归原作者（MIT/Apache 许可，见各仓库 LICENSE）。

## 新片 Checklist

```
□ timeline.json（拍数×beatSec=时长）→ build_timeline.py 核对总拍数
□ 每镜：cN.html 概念帧 → concept_render.js → gen_one.py（提示词四查 + 带运动）
□ build_base.py 建底板 → 逐段时长自检（≤0.06s 误差）
□ index.html 加 section + data-t + FNS（守五条硬规则）
□ scene_preview.js 逐镜过文案/时序
□ composite.js 合成
□ qc_rhythm.py 必过（最长静止 ≤3s）
□ ffprobe 音画时长一致 + 关键帧像素抽检 + 音频电平
□ 交付：成片 + 工作流记录
```
