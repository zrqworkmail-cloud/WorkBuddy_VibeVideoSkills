# skills/ · 技能

```
skills/
└── WorkBuddy_Skills/            ← WorkBuddy 平台的技能
    └── WorkBuddy_Video_Workflow/
        ├── SKILL.md             ← 主干流程，加载时只读这个
        └── references/          ← 按需加载的详细手册
```

按平台分一层（`<平台>_Skills/`），是为了以后往别的工具迁时不打乱现有结构。目前只有 `WorkBuddy_Skills`。

## 双份机制

WorkBuddy 只认用户级目录 `~/.workbuddy-ai/skills/<name>/SKILL.md`，不认仓库路径；但仓库要管版本。所以：

```
仓库（进 Git，版本管理）                    用户级（运行时，不进 Git）
skills/WorkBuddy_Skills/                  ~/.workbuddy-ai/skills/
└── WorkBuddy_Video_Workflow/        ──▶  └── WorkBuddy_Video_Workflow/
```

**单向同步**：永远改仓库那份，再覆盖到用户级。反向改会丢。

```bash
SRC="skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow"
DST="$HOME/.workbuddy-ai/skills/WorkBuddy_Video_Workflow"
mkdir -p "$DST/references"
cp "$SRC/SKILL.md" "$DST/SKILL.md"
cp "$SRC"/references/* "$DST/references/"

diff -r "$SRC" "$DST"   # 无输出 = 一致
```

## 当前收录

| 技能 | 作用 | 入口 |
|---|---|---|
| `WorkBuddy_Video_Workflow` | 视频制作流程：选题 → 脚本 → 分镜 → 素材 → 剪辑合成 → 质检 → 交付 → 发布复盘 | `SKILL.md` |

## 新增一个技能

1. 在 `WorkBuddy_Skills/` 下建 `<SkillName>/`，写 `SKILL.md`
2. `SKILL.md` 必须带 YAML frontmatter：

```yaml
---
name: <SkillName>            # 必须与目录名一致
description: <一句话说清"什么时候该用它">   # 决定会不会被触发，写具体场景与关键词
agent_created: true
---
```

3. 详细内容放 `references/`，`SKILL.md` 只留主干 + 指向（**加载时只读 SKILL.md，references 按需打开**）
4. 同步到用户级（见上）

## 写作约定

| 约定 | 理由 |
|---|---|
| **SKILL.md 只写"怎么做"，不写"这个项目怎么做的"** | 技能要跨项目复用；项目细节放 references |
| **每个阶段给「做什么 / 判据 / 常见错误」三件套** | 判据是验收线，缺了就只能靠感觉 |
| **判据给具体阈值**（如"最长冻结 ≤3s"），不写"应该够短" | 模糊标准等于没有标准 |
| **踩坑写「症状 → 根因 → 修法」**，不写"注意 XX" | 只有根因能让人在新场景里举一反三 |
| **references 单文件不超过 500 行** | 太长就拆，按主题分册 |

## 维护检查

```bash
SK="skills/WorkBuddy_Skills/WorkBuddy_Video_Workflow"

# 1. 两份是否一致
diff -r "$SK" "$HOME/.workbuddy-ai/skills/WorkBuddy_Video_Workflow"

# 2. 有没有残留项目特定路径（应该为 0）
grep -c "reference/\|remotion/\|scripts/" "$SK/SKILL.md"

# 3. references 里的链接是否都存在
grep -oE "references/[a-zA-Z0-9._-]+" "$SK/SKILL.md" | sort -u | while read f; do
  [ -f "$SK/$f" ] || echo "MISS $f"
done
```
