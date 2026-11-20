# 第三方技能来源说明

本目录及仓库中部分 AI 资源 vendor 自第三方开源仓库，版权归原作者所有。

## Ant Design 官方资源（ant-design-cli）

- **来源仓库**：https://github.com/ant-design/ant-design-cli （MIT，Copyright (c) 2026 Ant Design）
- **快照版本**：commit `6c06bbd`（2026-11-16）

| 资源 | 位置 | 说明 |
|---|---|---|
| `antd` skill | `.agents/skills/antd/` | antd CLI 使用向导（组件查询/迁移/诊断） |
| `design.md` | 根目录 `design.md` | antd Light 主题设计语言基线，源自 https://ant.design/design.md ，可按项目定制 |
| antd MCP | `.agents/mcp.json` | `npx -y @ant-design/cli mcp`；根目录 `.mcp.json` 为 Claude Code 兼容符号链接 |

## jeffallan/claude-skills 技能集（16 个）

- **来源仓库**：https://github.com/jeffallan/claude-skills （文档站 https://jeffallan.github.io/claude-skills/ ）
- **作者**：Jeff Smolinski（@Jeffallan）
- **快照版本**：commit `67c1961`（2026-11-16）
- **许可**：MIT（全文见下）；每个技能的 `SKILL.md` frontmatter 亦带有 `license: MIT` 与作者元数据

## 已 vendor 技能清单（16 个）

| 技能 | 分类 | 用途 |
|---|---|---|
| `php-pro` | 语言 | 现代 PHP 8.3+ / PHPStan / PSR |
| `laravel-specialist` | 后端框架 | Laravel 开发（apps/api） |
| `typescript-pro` | 语言 | TypeScript 高级类型 |
| `javascript-pro` | 语言 | 现代 JavaScript |
| `react-expert` | 前端框架 | React 开发（apps/web 基座） |
| `sql-pro` | 语言 | SQL 优化、窗口函数、CTE |
| `api-designer` | API | RESTful 设计、OpenAPI、版本化 |
| `test-master` | 质量 | 测试策略（单元/集成/E2E） |
| `code-reviewer` | 质量 | 代码评审 |
| `security-reviewer` | 安全 | 安全评审、SAST、渗透测试方法 |
| `debugging-wizard` | 质量 | 系统化调试 |
| `feature-forge` | 工作流 | 新特性需求梳理与规格 |
| `playwright-expert` | 质量 | 浏览器自动化与 E2E |
| `secure-code-guardian` | 安全 | 安全编码实践 |
| `architecture-designer` | 架构 | 系统设计、ADR |
| `code-documenter` | 质量 | 内联文档与 API 文档 |

## 更新方式

上游更新后重新 vendor：浅克隆仓库 → 覆盖对应技能目录 → 更新本文件的快照版本号。

## MIT License

```
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
