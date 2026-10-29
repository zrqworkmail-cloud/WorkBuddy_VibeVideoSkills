# Workbuddy 工作流仓库

用 Workbuddy 跑通、可复用的工作流，都收在这里。

## 我想……

| 我要做什么 | 去哪里 |
|---|---|
| **做一支视频**（任何类型、任何项目） | **技能 `WorkBuddy_Video_Workflow`** — 从选题到提交的八阶段流程 |
| 知道流程为什么这么设计 | [视频制作流程演进记录.md](./WorkBuddy_Workflow/视频制作流程演进记录.md) |
| 看代码渲染的完整实现 | [视频制作通用流程.md](./WorkBuddy_Workflow/视频制作通用流程.md) + `remotion/` |
| 抄现成的代码 | `remotion/`（Remotion + SVG）、`src/`、`scripts/` |
| 看某支片是怎么做的 | `films/<片名>/`（分镜、文案、质检报告） |
| 看踩过哪些坑 | 技能里的 `references/retro-lessons.md` |

## 目录

```
.
├── README.md                    ← 本文件
├── .gitignore
└── WorkBuddy_Workflow/           ← 所有工作流
    ├── README.md                ← 工作流索引
    ├── skills/                  ← ★ 技能（跨项目复用的核心）
    │   ├── README.md            ← 技能怎么存放、怎么同步
    │   └── WorkBuddy_Video_Workflow/
    │       ├── SKILL.md         ← 主干流程（426 行）
    │       └── references/      ← 按需加载的详细手册
    ├── 视频制作通用流程.md        ← 代码渲染的完整方法论
    ├── 视频制作流程演进记录.md    ← 决策记录：为什么这么改
    ├── films/                   ← 各支片的交付物
    ├── remotion/ src/ scripts/  ← 参考实现
    └── tools/                   ← 嫁接的开源技能
```

## 技能：跨项目复用的部分

`WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow/` 是一条**与项目、工具、素材来源都无关**的视频制作流程：

```
选题 → 脚本 → 分镜 → 素材 → 剪辑合成 → 质检 → 交付 → 发布复盘
```

每阶段给「做什么 / 判据 / 常见错误」。换题材、换工具、换平台，阶段顺序不变，只有「素材」那一步的实现方式变（代码渲染 / AI 生成 / 实拍 / 混剪 / 图文）。

**为什么它在仓库里又有一份**：Workbuddy 只从用户级目录 `~/.workbuddy-ai/skills/` 加载技能，但仓库要管版本。所以**仓库为源，用户级为运行时副本**，单向同步。详见 [skills/README.md](./WorkBuddy_Workflow/skills/README.md)。

## 三层结构

| 层 | 文件 | 回答什么 |
|---|---|---|
| **技能** | `skills/WorkBuddy_Video_Workflow/SKILL.md` | **怎么做**（可跨项目套用） |
| **方法论** | `视频制作通用流程.md` | 为什么用这些参数与判据（代码渲染专属） |
| **演进记录** | `视频制作流程演进记录.md` | 为什么改过这么多次 |
| **复盘** | `references/retro-lessons.md` | 哪些错犯过、怎么防 |

## 使用方式

```bash
git clone https://github.com/zrqworkmail-cloud/vibe-knowledge-video.git
cd vibe-knowledge-video/WorkBuddy_Workflow

# 把技能装到用户级（Workbuddy 只认这个路径）
mkdir -p ~/.workbuddy-ai/skills/WorkBuddy_Video_Workflow/references
cp skills/WorkBuddy_Video_Workflow/SKILL.md ~/.workbuddy-ai/skills/WorkBuddy_Video_Workflow/
cp skills/WorkBuddy_Video_Workflow/references/* ~/.workbuddy-ai/skills/WorkBuddy_Video_Workflow/references/
```

## 约定

- **产物不入库**：`out/`（成片、素材、帧，动辄数百 MB）、`node_modules/`、`*.mp4`、排障日志都在 `.gitignore` 里
- **技能不写项目细节**：SKILL.md 里不出现具体路径、脚本名、分辨率参数——那些放 references 或仓库文档
- **文档不重复**：技能答"怎么做"，方法论答"为什么用这个参数"，演进记录答"为什么改"
- **数值不神圣**：文档里的具体参数都是参考实现的实例，换题材按"迁移清单"判断改什么、留什么
