# skills/ · 技能存放说明

## 为什么有两份

WorkBuddy 加载技能时只认**用户级目录** `~/.workbuddy-ai/skills/<name>/SKILL.md`，不认仓库路径。
但仓库需要版本管理（改了什么、为什么改、能不能回滚）。

所以采用「**仓库为源，用户级为运行时副本**」：

```
仓库（版本管理，进 Git）              用户级（运行时，不进 Git）
WorkBuddy_Workflow/skills/            ~/.workbuddy-ai/skills/
└── WorkBuddy_Video_Workflow/    ──▶  └── WorkBuddy_Video_Workflow/
    ├── SKILL.md                          ├── SKILL.md
    └── references/                       └── references/
```

**单向同步**：永远改仓库那份，再覆盖到用户级。反向改会丢（下次同步就被覆盖）。

## 当前技能

| 技能 | 作用 | 入口 |
|---|---|---|
| `WorkBuddy_Video_Workflow` | 视频制作流程，从选题到成片提交（与项目/工具无关） | `SKILL.md` |

## 同步命令

```bash
# 仓库根目录执行
SRC="WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow"
DST="$HOME/.workbuddy-ai/skills/WorkBuddy_Video_Workflow"
mkdir -p "$DST/references"
cp "$SRC/SKILL.md" "$DST/SKILL.md"
cp "$SRC"/references/* "$DST/references/"

# 验证一致（无输出 = 一致）
diff -r "$SRC" "$DST"
```

Windows（Git Bash）下 `$HOME` 为 `C:/Users/<用户名>`，路径同样可用。

## 新增一个技能

1. 在 `skills/` 下建目录 `<SkillName>/`，写 `SKILL.md`
2. `SKILL.md` 必须带 YAML frontmatter：

```yaml
---
name: <SkillName>            # 必须与目录名一致
description: <一句话说清"什么时候该用它">   # 决定它会不会被触发，写具体场景与关键词
agent_created: true
---
```

3. 详细内容放 `references/`，`SKILL.md` 只留主干 + 指向（**加载时只读 SKILL.md，references 按需打开**）
4. 同步到用户级（上面的命令，替换目录名）

## 写作约定

| 约定 | 理由 |
|---|---|
| **SKILL.md 只写"怎么做"，不写"这个项目怎么做的"** | 技能要跨项目复用；项目细节放 references 或仓库文档 |
| **每个阶段给「做什么 / 判据 / 常见错误」三件套** | 判据是验收线，缺了就只能靠感觉 |
| **判据给具体阈值**（如"最长冻结 ≤3s"），不写"应该够短" | 模糊标准等于没有标准 |
| **踩坑写「症状 → 根因 → 修法」**，不写"注意 XX" | 只有根因能让人在新场景里举一反三 |
| **references 单文件不超过 500 行** | 太长就拆，按主题分册 |

## 维护检查

改完技能后跑这三条：

```bash
# 1. 两份是否一致
diff -r WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow ~/.workbuddy-ai/skills/WorkBuddy_Video_Workflow

# 2. 有没有残留项目特定路径（应该为 0）
grep -c "WorkBuddy_Workflow/\|remotion/\|scripts/" WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow/SKILL.md

# 3. references 里的链接是否都存在
grep -oE "references/[a-zA-Z0-9._-]+" WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow/SKILL.md | sort -u | while read f; do
  [ -f "WorkBuddy_Workflow/skills/WorkBuddy_Video_Workflow/$f" ] || echo "MISS $f"
done
```
