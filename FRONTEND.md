# 前端开发流程（apps/web · Ant Design Pro）

> 衍生自团队基座 `wherexml/optimax-starter` 与 `wherexml/optimax-team/spec` 规范库（团队内部资料），按本项目技术栈（UmiJS 4 + ProComponents）改写。骨架落地前作为规范契约，落地后随实现校准。

## 技术栈事实卡（骨架落地时校准）

| 项 | 约定 |
|---|---|
| 框架 | Ant Design Pro（UmiJS 4，React 18+） |
| 组件 | ProComponents 优先（ProTable / ProForm / ModalForm） |
| 请求 | 统一 request 封装（app 运行时配置） |
| 状态 | 服务端数据走查询缓存（useRequest 等）；全局态克制 |
| 包管理 | pnpm |

## 开发流程（需求 → 合并）

1. **接任务**：确认目标、完成标准、影响面、验收方式；需求从 `WORKFLOW.md` spec 流程进入——先读 `specs/<slug>/requirements.md` 的 EARS 验收标准与 `design.md` 接口契约
2. **建分支**：`feat/<slug>` / `fix/<slug>`，尽早开 Draft PR
3. **实现**：薄路由层 + feature 模块；新页面同步接线 route 配置与 access 权限点
4. **联调**：直连真实 API（dev 代理转发），**禁 mock**；接口变更同步类型、调用方、错误处理与 E2E
5. **自验**：lint（Biome + antd 规则）+ 构建 + 关键页面浏览器实操走查（五状态）
6. **PR → 合并 → 收尾**：按 `WORKFLOW.md` 协作通用流程执行（Draft PR → AI Review → Squash Merge → 收尾检查）

## 工程红线

- **请求**：一律走统一 request 封装（401 自动跳登录、错误信息统一截断为可读提示）；禁止裸调 fetch/axios，禁止组件内拼 URL / token
- **权限**：启动时拉取实时 permissions，无权限自动跳转首个可访问页；**前端隐藏入口 ≠ 权限，后端最终鉴权**（对齐 AGENTS.md 安全基线）
- **导航**：路由 / 菜单 / 权限码集中于单一注册表（路由配置 + access），不散落硬编码
- **状态**：服务端数据查询缓存的 key 携带账户上下文，mutation 后定向失效；筛选 / 分页 / Tab 由 URL 承载（可分享、可刷新恢复）
- **generated-service**：自动生成的 service 代码不手改，以重新生成覆盖
- **组件**：ProComponents 优先，不手写重复 CRUD；弹窗表单实现未保存拦截

## 验收门禁（五状态 + E2E 证据）

每个页面必须覆盖五种状态：**loading / empty / error / disabled / permission denied**。

E2E 是默认行为验收方式（实现前先写用例；不提倡实现后补写单测）；证据格式统一见 `WORKFLOW.md` converge 节（只有 PASS 才能表述为已验收）。

## CI 前端门禁（骨架落地时配置）

lint → 类型检查 → 构建 → 关键页面 E2E（真实浏览器）→ 路由 / 权限 / 空态 / 错态检查；固定名称的汇总门禁；PR 并发自动取消节省额度；AI Review 先以评论方式引入，稳定后再转门禁。
