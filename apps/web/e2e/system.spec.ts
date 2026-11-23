import { expect, test } from '@playwright/test';
import { apiCall, loginViaApi, loginViaUi } from './helpers';

/**
 * 权限边界（真实 API，禁 mock）：
 * 用户 CRUD 闭环已迁至 user.spec.ts；本文件保留路由 access 边界。
 */
test.describe('权限边界', () => {
  test('无角色用户访问管理页自动跳转欢迎页', async ({ page, request }) => {
    // 防御性预清理：撤销历史可能遗留的 alice 直授权限，保证用例幂等
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    await apiCall(request, adminToken, 'PUT', '/api/v1/users/3/permissions', {
      permissions: [],
    });

    // alice：无任何角色/权限（种子默认）
    await loginViaUi(page, 'alice', 'demo123456');

    // 直接访问受权限约束的路由 → unAccessible 自动跳首个可访问页
    await page.goto('/system/user');
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
  });

  test('直授权限即时生效（角色之外追加 system.user.view）', async ({
    page,
    request,
  }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    try {
      // 以 admin 为 alice 直授 system.user.view
      const aliceId = 3; // 种子序：admin=1 demo=2 alice=3
      await apiCall(
        request,
        adminToken,
        'PUT',
        `/api/v1/users/${aliceId}/permissions`,
        { permissions: ['system.user.view'] },
      );

      await loginViaUi(page, 'alice', 'demo123456');

      // alice 现在可见系统管理 → 用户管理（直授权限生效）
      await page.getByText('系统管理', { exact: true }).first().click();
      await page.getByRole('menuitem', { name: '用户管理' }).click();
      await expect(page).toHaveURL(/\/system\/user/);
      await expect(page.getByText('admin').first()).toBeVisible();
    } finally {
      // 清理：撤回 alice 直授权限，保证用例幂等
      await apiCall(request, adminToken, 'PUT', '/api/v1/users/3/permissions', {
        permissions: [],
      });
    }
  });
});
