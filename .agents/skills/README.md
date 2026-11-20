# 项目级 Skills

本目录是本仓库技能的**唯一内容源**。每个技能是一个子目录，含 `SKILL.md`（YAML frontmatter + 正文）：

```
.agents/skills/
├── claude-md-improver/     # 内置：AGENTS.md/CLAUDE.md 质量审计（衍生自官方插件，Apache-2.0）
│   ├── SKILL.md / LICENSE / references/
├── antd/                   # 内置：antd CLI 使用向导（Ant Design 官方，MIT）
├── THIRD-PARTY-NOTES.md    # 第三方技能来源与许可说明
├── php-pro/ ... 等 16 个   # vendor 自 jeffallan/claude-skills（MIT），见 THIRD-PARTY-NOTES.md
└── <skill-name>/           # 新增技能照此结构
    └── SKILL.md
```

**内置第三方技能速览**（完整说明见 [THIRD-PARTY-NOTES.md](THIRD-PARTY-NOTES.md)）：

- 后端栈：`php-pro`、`laravel-specialist`、`sql-pro`、`api-designer`
- 前端栈：`typescript-pro`、`javascript-pro`、`react-expert`、`antd`（Ant Design 官方）
- 质量安全：`test-master`、`code-reviewer`、`security-reviewer`、`secure-code-guardian`、`debugging-wizard`、`playwright-expert`、`code-documenter`
- 架构工作流：`architecture-designer`、`feature-forge`

## 三端发现机制

| 工具 | 读取路径 | 说明 |
|---|---|---|
| ZCode | `.agents/skills/` | 工作区原生扫描 |
| Claude Code | `.claude/skills` → `../.agents/skills` | 符号链接 |
| 其他 agents 系工具（Codex 等） | `.agents/skills/` | 开放约定 |

- 同名技能：用户级（`~/.zcode/skills/`、`~/.agents/skills/`）优先于本目录，用户级已存在的技能在本仓库会被遮蔽。
- 新增技能后无需任何注册，放入即被发现（可能需要新会话生效）。

## Windows 协作者注意

仓库中的符号链接（`CLAUDE.md`、`.claude/skills`）在 Windows 检出时需要开启符号链接支持：系统开启开发者模式，并执行 `git config core.symlinks true`；否则链接会检出为包含路径文本的普通文件。
