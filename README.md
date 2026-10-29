# Workbuddy 工作流仓库

用 Workbuddy 跑通、可复用的工作流都收在这里。每条工作流都按同一套结构沉淀：

| 组成 | 作用 | 例子 |
|---|---|---|
| **通用流程** | 脱离具体项目也能用的方法、参数决策、质检判据 | 视频制作通用流程 |
| **参考实现** | 跑通过的一套代码，可当模板直接抄 | 逐帧渲染管线 |
| **演进记录** | 为什么这么设计、踩过哪些坑、开源技能怎么选 | 流程演进记录 |

## 目录

```
.
├── README.md                 ← 本文件
├── .gitignore                ← 排除 out/ 与 node_modules/
└── WorkBuddy_Workflow/        ← 所有工作流
    ├── README.md             ← 工作流索引（从这里进）
    ├── 视频制作通用流程.md
    ├── 视频制作流程演进记录.md
    ├── src/  scripts/  tools/
    └── skills/
```

## 目前收录

### 视频制作

面向**任何"画面由代码按时间计算出来"的视频**——知识科普、数据解说、产品演示、动画短片，竖版横版皆可。

核心是四条原则：逐帧确定性渲染、素材层/覆盖层/音轨分层、量化质检闸门、先找轮子再造轮子。

👉 入口：[`WorkBuddy_Workflow/README.md`](./WorkBuddy_Workflow/README.md)

## 使用方式

```bash
git clone https://github.com/zrqworkmail-cloud/vibe-knowledge-video.git
cd vibe-knowledge-video/WorkBuddy_Workflow
```

要做新片，从《视频制作通用流程.md》第 2 节的七参数表开始填；想抄代码，直接看 `src/` 与 `scripts/`。

## 约定

- **产物不入库**：`out/`（成片、素材、帧，动辄数百 MB）与 `node_modules/` 都在 `.gitignore` 里
- **文档不重复**：通用流程答"怎么做"，演进记录答"为什么这么改"
- **数值不神圣**：文档里的具体参数都是参考实现的实例，换题材按"迁移清单"判断改什么、留什么
