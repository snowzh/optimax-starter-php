import { expect, test } from '@playwright/test';
import { apiCall, apiJson, loginViaApi } from './helpers';

/**
 * 认证边界（真实 API，禁 mock）：
 * - 4002 禁用登录：种子无禁用用户，用例自建→禁用→UI 断言→清理
 * - 无效 token：前端拦截器清 token 并跳登录（requestErrorConfig 2001/401 路径）
 */
test.describe('认证边界', () => {
  test('禁用用户登录提示 4002 且停留登录页', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const username = `e2e-disabled-${Date.now()}`;
    const password = 'probe-pass-123';

    // 预置：创建探针用户并禁用
    const created = await apiJson(
      request,
      adminToken,
      'POST',
      '/api/v1/users',
      {
        username,
        name: 'E2E 禁用探针',
        password,
        password_confirmation: password,
        status: 1,
        role_ids: [],
      },
    );
    const userId = created.data.id as number;
    await apiCall(request, adminToken, 'PUT', `/api/v1/users/${userId}`, {
      name: 'E2E 禁用探针',
      status: 0,
      role_ids: [],
    });

    try {
      await page.goto('/user/login');
      await page
        .getByPlaceholder('用户名', { exact: false })
        .fill(username);
      await page.getByPlaceholder('密码', { exact: false }).fill(password);
      await page.getByRole('button', { name: /登\s*录/ }).click();

      // 后端 4002：统一中文提示，不发生跳转
      await expect(page.getByText('用户已禁用').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page).toHaveURL(/\/user\/login/);
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${userId}`);
    }
  });

  test('无效 token 访问受保护页被清除并跳登录', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', 'invalid-token-e2e');
    });

    // initialState 拉取 /auth/me → 401/2001 → 清 token 跳登录（携带 redirect）
    await page.goto('/system/user');
    await expect(page).toHaveURL(/\/user\/login\?redirect=/, {
      timeout: 30_000,
    });

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
