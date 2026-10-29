# skills/ · 按平台分类的技能

同一个技能，不同 AI 编程工具的**加载路径与元信息格式不同**，所以按平台分目录存放。

```
skills/
├── WorkBuddy_Skills/        ← WorkBuddy 的技能
│   └── WorkBuddy_Video_Workflow/
│       ├── SKILL.md
│       └── references/
├── Codex_Skills/            ← Codex 的技能
├── Qoder_Skills/            ← Qoder 的技能
└── Zcode_Skills/            ← Zcode 的技能
```

## 为什么分平台

| 工具 | 加载路径 | 元信息 |
|---|---|---|
| **WorkBuddy** | `~/.workbuddy-ai/skills/<name>/SKILL.md` | YAML frontmatter：`name` / `description` / `agent_created` |
| Codex | 待填（各版本不同） | 待填 |
| Qoder | 待填 | 待填 |
| Zcode | 待填 | 待填 |

**只有 WorkBuddy 的路径是实测验证过的**，其余三处等你用起来再补——不确定的东西不写进文档，免得下次照着做踩空。

## 双份机制（WorkBuddy）

WorkBuddy 只认用户级目录，不认仓库路径；但仓库要管版本。所以：

```
仓库（进 Git，版本管理）                用户级（运行时，不进 Git）
skills/WorkBuddy_Skills/              ~/.workbuddy-ai/skills/
└── WorkBuddy_Video_Workflow/    ──▶  └── WorkBuddy_Video_Workflow/
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

| 平台 | 技能 | 作用 |
|---|---|---|
| WorkBuddy | `WorkBuddy_Video_Workflow` | 视频制作流程：选题 → 脚本 → 分镜 → 素材 → 剪辑合成 → 质检 → 交付 → 发布复盘 |

## 新增一个技能

1. 在对应平台目录下建 `<SkillName>/`，写 `SKILL.md`
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
grep -c "WorkBuddy_Workflow/\|remotion/\|scripts/" "$SK/SKILL.md"

# 3. references 里的链接是否都存在
grep -oE "references/[a-zA-Z0-9._-]+" "$SK/SKILL.md" | sort -u | while read f; do
  [ -f "$SK/$f" ] || echo "MISS $f"
done
```
