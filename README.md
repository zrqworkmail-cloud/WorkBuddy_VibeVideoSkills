# Workbuddy 工作流仓库

用 Workbuddy 跑通、可复用的工作流，都收在这里。

## 我想……

| 我要做什么 | 去哪里 |
|---|---|
| **做一支视频**（任何类型、任何项目） | **技能 `WorkBuddy_Video_Workflow`** — 从选题到提交的八阶段流程 |
| 知道流程为什么这么设计 | [docs/视频制作流程演进记录.md](./docs/视频制作流程演进记录.md) |
| 看代码渲染的完整方法论 | [docs/视频制作通用流程.md](./docs/视频制作通用流程.md) |
| 抄现成的代码 | [reference/](./reference/README.md)（Remotion + SVG，两代实现） |
| 看某支片是怎么做的 | [films/](./films/)（分镜、文案、质检报告） |
| 看踩过哪些坑 | 技能里的 `references/retro-lessons.md` |

## 目录

```
vibe-knowledge-video/
├── README.md                    ← 本文件
├── .gitignore
│
├── skills/                      ★ 技能（跨项目复用）
│   ├── README.md                ← 存放规则、同步命令、写作约定
│   └── WorkBuddy_Skills/
│       └── WorkBuddy_Video_Workflow/
│           ├── SKILL.md         ← 主干流程（八阶段）
│           └── references/      ← 按需加载的详细手册
│
├── docs/                        ← 方法论（回答"为什么"）
│   ├── 视频制作通用流程.md        ← 代码渲染的完整方法论
│   ├── 视频制作流程演进记录.md    ← 决策记录
│   └── 第二支片复盘.md
│
├── films/                       ← 各支片的交付物
│   └── <片名>/                   ← 分镜、文案、质检报告
│
└── reference/                   ← 参考实现（回答"怎么写代码"）
    ├── README.md                ← 文件地图、环境依赖
    ├── remotion/                ← 二代：Remotion + SVG（推荐）
    ├── src/ scripts/            ← 初代：HTML + Puppeteer
    └── tools/                   ← 嫁接的开源技能
```

## 技能：跨项目复用的部分

`skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow/` 是一条**与项目、工具、素材来源都无关**的视频制作流程：

```
选题 → 脚本 → 分镜 → 素材 → 剪辑合成 → 质检 → 交付 → 发布复盘
```

每阶段给「做什么 / 判据 / 常见错误」。换题材、换工具、换平台，阶段顺序不变，只有「素材」那一步的实现方式变（代码渲染 / AI 生成 / 实拍 / 混剪 / 图文）。

**按平台分一层**：`skills/<平台>_Skills/<技能名>/`。目前只有 `WorkBuddy_Skills`，留这一层是为了以后往别的工具迁时不打乱结构。

**为什么仓库里还要存一份**：WorkBuddy 只从用户级目录 `~/.workbuddy-ai/skills/` 加载技能，不认仓库路径；但仓库要管版本。所以**仓库为源，用户级为运行时副本**，单向同步。详见 [skills/README.md](./skills/README.md)。

## 四层结构

| 层 | 位置 | 回答什么 |
|---|---|---|
| **技能** | `skills/` | **怎么做**（可跨项目套用，含判据） |
| **方法论** | `docs/` | 为什么用这些参数与判据 |
| **复盘** | 技能里的 `references/retro-lessons.md` | 哪些错犯过、怎么防 |
| **实现** | `reference/` | 具体怎么写代码 |

## 使用方式

```bash
git clone https://github.com/zrqworkmail-cloud/vibe-knowledge-video.git
cd vibe-knowledge-video

# 把 WorkBuddy 技能装到用户级（WorkBuddy 只认这个路径）
SRC="skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow"
DST="$HOME/.workbuddy-ai/skills/WorkBuddy_Video_Workflow"
mkdir -p "$DST/references"
cp "$SRC/SKILL.md" "$DST/SKILL.md"
cp "$SRC"/references/* "$DST/references/"
```

## 约定

- **产物不入库**：`out/`、`node_modules/`、`*.mp4`、排障日志都在 `.gitignore` 里
- **技能不写项目细节**：`SKILL.md` 里不出现具体路径、脚本名、分辨率参数——那些放 references 或 `docs/`
- **文档不重复**：技能答"怎么做"，`docs/` 答"为什么"，`reference/` 答"怎么写代码"
- **数值不神圣**：文档里的具体参数都是参考实现的实例，换题材按"迁移清单"判断改什么、留什么
