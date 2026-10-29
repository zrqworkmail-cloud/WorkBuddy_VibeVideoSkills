# 视频制作工作流 · SOP（详细操作版）

> ⚠️ **状态：早期详细版，判据与规则以上游为准。**
> - 判据、硬规则、闸门 → 以 `SKILL.md` 为准（已更新到"七条硬规则"与"预览工具自检"）
> - 通用方法论、迁移清单、多片结构 → 以仓库 `docs/视频制作通用流程.md` 为准
> - 本文件的价值在**具体操作细节**：文件地图、逐步自检项、命令参数。发现与上游冲突时，以上游为准。

> 参考实现：《为什么越熬夜越精神》竖版科普短片（1080×1920 / 24fps / 2:17）
> 核心思想：**逐帧确定性渲染**（`render(lt)` 纯时间函数）+ **本地 AI 底板** + **量化质检闸门** + **开源技能嫁接**。

---

## 一、总览

```
timeline.json ──build_timeline.py──> timeline.js（唯一时间基准）
     │
     ├─> cN.html ─concept_render.js─> concepts/cN.png（I2V 首帧）
     │        └─ gen_one.py N ─Wan2.2 I2V─> ai/sN.mp4（704×1280 @16fps, 121帧）
     │
     ├─> build_base.py [ids] ──> base/base_sN.mp4（按分镜时长定速+调色+插帧）
     │        └─ concat ──> base.mp4
     │
     └─> index.html（<section id=sN> + data-t + FNS.sN）
              └─ composite.js ─Puppeteer 逐帧截图─> ffmpeg overlay(base+BGM) ──> 成片.mp4
```

**一句话分工**：`timeline.json` 定节奏，`index.html` 定画面，`build_base.py` 定底板，`composite.js` 出片，`qc_*.py` 守门。

---

## 二、时间模型（一切对齐的基准，先懂这个）

| 项 | 值 | 说明 |
|---|---|---|
| BPM / 每拍 | 112.3 / **0.53406s** | 全片卡点基准 |
| 分镜时长 | `beats × 0.53406` | **唯一公式**，base 与覆盖层都必须服从 |
| 全片 | 256 拍 = **136.719s** | 改动分镜拍数时总数必须守恒（或同步重做 BGM） |
| 帧率 | 24fps | base 与 overlay 一致 |
| BGM | 136.719410s | 与视频严丝合缝；composite **不加 `-shortest`**（会裁尾帧） |

**三条铁律**
1. 改 `timeline.json` 后必须跑 `build_timeline.py` 重生成 `timeline.js`（浏览器只读 js）。
2. 拍数变了的镜头**必须重建 base 分段**，否则旧分段时长与新时间轴错位（build_base 默认复用旧分段，只重建 `ONLY` 列表里的）。
3. 覆盖层按**全局时间** `t` 驱动（`window.__seek(t)`），base 按**拼接顺序**对齐——两边都只认 timeline，不要各自写死时间。

---

## 三、文件地图

| 路径 | 作用 |
|---|---|
| `src/timeline.json` | 分镜表（id / beats / name），**改这里** |
| `src/timeline.js` | 由 build_timeline.py 生成，勿手改 |
| `src/index.html` | 全部画面：`<section id=sN>` 场景、`data-t` 入场、`FNS.sN` 逐帧函数、`FLASH` 卡点光效 |
| `src/cN.html` | I2V 概念首帧（SVG 绘制），concept_render.js 渲染成 png |
| `src/drive.js` | 画面实测数据（analyze_motion.py 生成），驱动读数 |
| `scripts/build_timeline.py` | timeline.json → timeline.js，打印节拍表 |
| `scripts/concept_render.js` | cN.html → concepts/cN.png |
| `scripts/wan22.py` | Wan2.2 I2V 提交器（SCENES 提示词表 / NEG 负面词 / 双专家采样） |
| `scripts/gen_one.py` | **单镜可靠生成**（提交→轮询→下载→磁盘兜底），推荐入口 |
| `scripts/gpu_gate.py` | GPU 让渡门控：利用率 + **空闲显存 ≥9000MiB 硬门槛** |
| `scripts/build_base.py` | 底板：LOOK 调色/特效、TRIM、PARTS_TIMED 定速、GEO 构图、慢放插帧、拼接 |
| `scripts/composite.js` | 成片：Puppeteer 逐帧截图透明覆盖层 → ffmpeg 叠加 base+BGM |
| `scripts/scene_preview.js` | **单镜秒级预览**（调文案/时序的第一工具） |
| `scripts/qc_rhythm.py` | **节奏体检**：每镜最长静止 ≤3s / 静止占比 / 运动能量 |
| `scripts/analyze_motion.py` | 从 base 提取 ROI 信号 → drive.js（亮度/液面/开合/运动量） |
| `scripts/_ovqc.js` | 多时间点覆盖层 QC + JS 报错捕获 |
| `tools/oss-skills/` | 嫁接的开源技能库（见第七节） |

---

## 四、标准生产流程（八步）

### 1. 定节奏
```bash
# 改 src/timeline.json 的 scenes（id/beats/name）
python scripts/build_timeline.py          # 输出节拍表，核对总拍数
```
✔ 自检：总拍数 = 256（或与 BGM 时长一致）；每镜时长 = beats×0.53406。

### 2. 画概念首帧
```bash
node scripts/concept_render.js <N>        # src/cN.html → out/ai/concepts/cN.png
```
✔ 自检：尺寸 704×1280；主体位置与构图意图一致（如"主体压下半"就在 y>700 画）。

### 3. 生成 AI 底板素材
```bash
python scripts/gen_one.py <N> <seed> 121
```
- 提示词写进 `wan22.py` 的 `SCENES[N]`，**必带负面词 NEG**（去插画感/畸形/发光皮肤）。
- 提示词四查：细节充分 / 契合叙事功能 / 与概念帧同向 / 与其他镜区分。
- **要运动**：不要写 "completely still"；写慢眨眼、呼吸、光效明灭、极缓推近（静止素材会触发节奏缺陷，见第六节）。

✔ 自检：`ffprobe` 121 帧 / 7.56s；**帧间运动能量**（qc_rhythm 同款算法）> 0.0012。

### 4. 建底板
```bash
python scripts/build_base.py 3,7,13       # 只重建改动过的镜头；不带参数=全量
```
- `LOOK`：每镜调色链 + 特效（vignette/sharpen/bloom）。
- `TRIM / TRIM_END`：裁掉 I2V 开头的画风过渡与尾部多余动作。
- `PARTS_TIMED`：分段定速（速度即表演），`sp>1.10` 自动上 `minterpolate` 插帧。
- `GEO`：个别镜头改构图给文字腾位（如 s11 裁顶下移，顶部 13% 亮度≈0）。
- 慢放统一走 `setpts + minterpolate(mci)`，**绝不**用 `fps` 复制帧。

✔ 自检：每段时长 vs timeline 期望（≤0.06s 误差）；全段齐了才 concat。

### 5. 做覆盖层（画面）
在 `index.html` 对应 `<section id=sN>` 里加：
- `data-t`（相对分镜起点的秒）/ `data-anim`（fade/up/mask/chars/blur/term/draw/punch/jolt/wipe/pop）/ `data-d`
- 需要逐帧逻辑就写 `FNS.sN(lt,t,el)`；`lt` 是分镜本地时间。
- 卡点光效在 `FLASH[N]` 配。

**七条硬规则**（违反必出 bug；前五条管渲染，后两条管工程，详见 SKILL.md）：
1. **禁止 CSS transition/keyframes**——逐帧 seek 会抖；所有动画都由 `render(lt)` 计算。
2. **禁止 `Math.random()`**——每帧重算会跳；需要随机用 `rng(seed)` 确定性函数。
3. **禁止 `background-clip:text`**——无头 Chrome 合成层会丢渐变填充（字变透明）；用纯色 + 光晕。
4. 带样式的原子标签（`tx-grad/tx-mark/tx-serif…`）**不可被拆字**（拆了样式丢失、字消失）。
5. 慢放素材与动画同步：若视频放慢 K 倍，在 FNS 首行 `lt/=K` 把本地时间压回设计时刻表（s3 的做法，水滴落点因此仍精确等于眼皮合上那一拍）。
6. **单镜样式必须 `#sN` 限定**——改 `.txt/.h1` 这类全局类会移动全片所有镜头。
7. **绝对定位块必须算垂直占位**——多个 absolute 块的 top/bottom 各写各的，重叠在缩略图上看不出来；文字块高度随内容变，别只看首行。

### 6. 单镜预览（**每次改文案必做**）
```bash
node scripts/scene_preview.js s6 5 --base   # 5 帧采样，叠到底板帧上
```
✔ 自检：无 JS 报错；文字不压主体、不越安全区、入场时机与画面动作对得上。
> 这是全流程最省时间的工具：秒级出图，替代 7 分钟全片重渲。

### 7. 合成成片
```bash
node scripts/composite.js 24
```
✔ 自检：帧数 = 时长×24；`ffprobe` 音视频时长一致；文件大小合理（~50MB/2min）。

### 8. 质检交付
```bash
python scripts/qc_rhythm.py                 # 节奏体检（必过）
```
+ 程序化抽检：关键帧像素统计（落点/亮度分区/音画电平）。
+ 交付：成片 + 本 SOP + 优化记录。

---

## 五、三道质检闸门

| 闸门 | 工具 | 判据 | 时机 |
|---|---|---|---|
| ① 单镜 | `scene_preview.js` | 无 JS 报错；排版/时序/构图目检 | 每次改画面 |
| ② 节奏 | `qc_rhythm.py` | **每镜最长静止 ≤3.0s**；静止占比>45% 提示 | 合成后 |
| ③ 成片 | ffprobe + 像素统计 | 时长严丝合缝；关键帧特征（水滴在眼窝、顶部文字带纯黑、BPM 辉光随拍搏动）；音频 mean≈-15dB | 交付前 |

> 判据来源：GitHub 开源技能 `anything2explainer`（★2.7k）的量化标准，见第七节。

---

## 六、踩坑速查（症状 → 根因 → 规则）

| 症状 | 根因 | 规则 |
|---|---|---|
| 字"消失"/变透明 | `background-clip:text` 在合成层丢填充 | 纯色 + text-shadow 光晕 |
| 慢放"掉帧/幻灯片" | `fps` 复制帧 | `setpts` + `minterpolate=mi_mode=mci` |
| 分段拼接后总长被压缩 | 多段 xfade 塞进一条 filtergraph，offset 错位 | 分步 concat，每步校验时长 |
| `-ss/-to` 后时长不对 | 放在 `-i` 之后被当输出限制 | 输入侧裁剪：放 `-i` 之前 |
| 生成 OOM（node 10） | 外部进程瞬时占 ~9GB，旧门控只看利用率% | `gpu_gate` 空闲显存 ≥9000MiB 硬门槛 |
| 误判"两个 ComfyUI 抢端口" | venv python 与 uv python 是**父子进程=同一服务** | 查 `ParentProcessId` 再下结论 |
| 后台任务莫名消失 | shell 里加 `&` 会随 shell 退出被连坐 | 一律用托管 `run_in_background` |
| 成片下半"很黑" | `.ov-scrim` 是覆盖层专用压暗渐变（底部 90-95% α），**设计如此** | 与未加 scrim 的底板对比会误判，勿"修" |
| 慢推加了却没效果 | skill 的"1.0→1.05 慢推"是 30-45 帧镜头级速率，拉长到整镜慢 20 倍 | 要么镜头级用，要么换素材 |
| 周期性光效验证为"无差异" | 跨拍抽帧被底板慢漂移混淆 | 抽**同拍相邻帧**对比 |
| 单镜时长与时间轴错位 | 改了 beats 但复用了旧 base 分段 | 改拍数必须重建该镜分段 |

---

## 七、开源嫁接层（昨天新增的能力）

**方法论**（用户笔记）：任何想做的能力 → 先让 AI 搜 GitHub 找成熟开源项目 → 交给 Agent 读文档/查环境/装依赖/改造成本机可用 → 用它们的量化判据当自己的质检标准。

**已归档** `tools/oss-skills/`：
| 来源 | 星标 | 已取用 |
|---|---|---|
| anything2explainer | ★2.7k | `reference/` 8 份：口播文案13条、动效词表、构图与光、风格指南、踩坑集、QC/构建协议；`scripts/` 3 个 QC 源码 |
| onetake | ★3.1k | 协议思想："one file, pure functions of time, moves from the library"（与 render(lt) 同源） |
| video-shotcraft | ★13.1k | 镜头语言参考（待消化） |
| remotion-dev/skills | ★5.6k | 官方 12 子技能索引（暂不迁 Remotion，仅作参考） |

**怎么用**
- 写新片文案 → 先读 `reference/narration-guidance.md`（13 条：处境开场/一条主线/先因后果/数字换可感尺度/比喻承重/术语后置/结尾回扣…）。
- 设计新分镜 → 从 `reference/motion-vocabulary.md` 选动效（入场/强调/光效/离场/运镜的帧数公式）。
- 交付前 → `qc_rhythm.py`（判据来自对方）+ 本 SOP 第三闸门。
- 想接配音 → 对方 `tts_build.py` 方案（中文 edge-tts 云希，免费本地）。

---

## 八、新片 Checklist

```
□ 写 timeline.json（拍数 × 0.53406 = 时长），build_timeline.py 核对总拍数
□ 每镜：cN.html 概念帧 → concept_render.js → gen_one.py 生成（提示词四查 + 带运动）
□ build_base.py 建底板 → 逐段时长自检
□ index.html 加 section + data-t + FNS（守五条硬规则）
□ scene_preview.js 逐镜过文案/时序（每次改都过）
□ composite.js 合成
□ qc_rhythm.py 必过（最长静止 ≤3s）
□ ffprobe 音画时长一致 + 关键帧像素抽检 + 音频电平
□ 交付：成片 + 本 SOP + 优化记录
```
