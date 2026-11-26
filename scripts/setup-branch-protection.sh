#!/usr/bin/env bash
# 分支保护一键配置（本仓库作为模板被采用时执行）
# 公有仓库（免费版支持保护规则）：完整启用 main/dev 保护与合并设置
# 私有仓库（免费版不支持）：跳过并提示按 WORKFLOW.md「维护规范（文档级约束）」执行
#
# main/dev 差异化配置（spec branch-history-governance，2026-11）：
#   dev   —— squash-only + 线性历史（功能分支压平回开发线）
#   main  —— 允许 merge commit + 非线性历史（发布保留 dev 拓扑，main 恒含 dev 全历史，
#            squash-only 曾致 dev→main 每次发布产生全新 SHA 永久分叉，PR 全量冲突靠
#            「快照缝合」绕过——见 specs/branch-history-governance/）
set -euo pipefail

REPO="${1:?用法: $0 <owner/repo>   例: snowzh/optimax-starter-php}"

command -v gh >/dev/null 2>&1 || { echo "✗ 需要安装 GitHub CLI (gh) 并已登录"; exit 1; }

# 公共保护规则（PR 强制但批准数为 0，适配单人仓库；有协作者后可改为 1）
COMMON='{"dismiss_stale_reviews": true, "require_code_owner_reviews": false, "require_last_push_approval": false, "required_approving_review_count": 0}'

# dev：squash-only + 线性历史（功能分支压平的落点）
DEV_PROTECTION=$(cat <<EOF
{
  "required_pull_request_reviews": ${COMMON},
  "enforce_admins": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_status_checks": null,
  "restrictions": null
}
EOF
)

# main：允许 merge commit（dev→main 发布保留拓扑）+ 非线性历史
MAIN_PROTECTION=$(cat <<EOF
{
  "required_pull_request_reviews": ${COMMON},
  "enforce_admins": true,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_status_checks": null,
  "restrictions": null
}
EOF
)

echo "▸ 保护 ${REPO} 的 dev 分支（squash-only + 线性历史）…"
if gh api -X PUT "repos/${REPO}/branches/dev/protection" --input - >/dev/null 2>&1 <<<"$DEV_PROTECTION"; then
  echo "▸ 保护 ${REPO} 的 main 分支（允许 merge commit，非线性）…"
  if gh api -X PUT "repos/${REPO}/branches/main/protection" --input - >/dev/null 2>&1 <<<"$MAIN_PROTECTION"; then
    echo "▸ 配置仓库合并方式（Squash 供功能分支；merge commit 供 dev→main 发布）"
    gh api -X PATCH "repos/${REPO}" \
      -F allow_merge_commit=true -F allow_rebase_merge=false \
      -F allow_squash_merge=true -F delete_branch_on_merge=true \
      -F squash_merge_commit_title=PR_TITLE -F squash_merge_commit_message=PR_BODY >/dev/null
    echo "✓ 完成：main/dev 差异化保护已启用（见 specs/branch-history-governance/）"
    echo "  注：GitHub 无法硬性限定 main 的 PR 来源分支——「仅接受 dev 合并」由评审角色把关"
    exit 0
  fi
fi

cat <<'GUIDE'
⚠ 当前仓库无法启用分支保护（常见于 GitHub 私有仓库免费版）。
  分支模型改按 WORKFLOW.md「维护规范（文档级约束）」执行：
  · 禁止直推 main / dev，一切变更走开发分支 → PR
  · AI agent 收到直推指令应拒绝执行，改走 PR 流程
  · 合并方式手动约定：Squash Merge、合并后删分支
  · 团队扩张后可升级 GitHub 计划，重跑本脚本启用技术强制
GUIDE
