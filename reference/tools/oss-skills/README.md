# oss-skills · 嫁接的开源技能

从 GitHub 拉取的开源视频制作技能，**只作参考阅读**，不作为本工作流的运行依赖。

## 收录

| 目录 | 上游仓库 | 许可 | 内容 |
|---|---|---|---|
| `anything2explainer/` | [Vincentwei1021/anything2explainer](https://github.com/Vincentwei1021/anything2explainer) | 见上游 | SKILL.md + 10 份 `reference/` + 3 个 QC 脚本（`motion_check.py` / `frame_metrics.py` / `selfcheck.py`） |
| `onetake/` | [feitangyuan/onetake](https://github.com/feitangyuan/onetake) | **PolyForm Noncommercial 1.0.0** | SKILL.md + 7 份 `references/` |
| `video-shotcraft/` | [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | 见 `LICENSE` | SKILL.md + 118 份 `references/`（含 `shots/` 镜头库、`sequences/` 序列模板） |

## 结构

每个目录都是**标准技能结构**，可以直接被 agent 加载：

```
<skill>/
├── SKILL.md          ← 入口
├── LICENSE           ← 上游许可
└── references/       ← 按需加载（anything2explainer 用单数 reference/）
```

## 与本工作流的关系

`docs/视频制作通用流程.md` 和 `skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow/` 里的部分判据来自这几个项目，具体出处标在对应章节（如 QC 节奏判据来自 anything2explainer 的 `motion_check.py`）。

**不是依赖**：删掉这个目录，本工作流照常运行。

## 更新方式

```bash
# 看上游有哪些文件
gh api repos/<owner>/<repo>/contents/references --jq '.[].name'

# 或整目录拉
git clone --depth 1 https://github.com/<owner>/<repo>.git /tmp/oss
cp -r /tmp/oss/references/* <skill>/references/
```

## 许可提醒

- `onetake` 是 **PolyForm Noncommercial 1.0.0**，仅限非商业用途。要用在商业项目上，先看它的 LICENSE。
- 其余两个的许可见各自目录下的 `LICENSE`（video-shotcraft）或上游仓库。

版权归原作者，此处仅作学习参考归档。
