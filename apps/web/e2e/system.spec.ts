import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * 系统管理关键流程（真实 API，禁 mock）。
 * 辅助函数 loginViaApi：服务端登录获取 token（供用例内做权限预置/清理）。
 */
async function loginViaApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<string> {
  const res = await request.post('/api/v1/auth/login', {
    data: { username, password },
  });
  const body = await res.json();
  return body.data.token as string;
}

/** 以指定用户执行任意 API（幂等预置场景用） */
async function apiCall(
  request: APIRequestContext,
  token: string,
  method: string,
  path: string,
  data?: unknown,
) {
  return request.fetch(path, {
    method,
    data: data as object,
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('用户管理', () => {
  test('超管完成用户增改删闭环', async ({ page }) => {
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });

    // 菜单 → 用户管理（menuitem 角色定位，避免与页面标题文案歧义）
    await page.getByText('系统管理', { exact: true }).first().click();
    await page.getByRole('menuitem', { name: '用户管理' }).click();
    await expect(page).toHaveURL(/\/system\/user/);
    await expect(page.getByText('admin').first()).toBeVisible({
      timeout: 15_000,
    });

    // 新建用户（ModalForm）
    await page.getByRole('button', { name: /新建用户/ }).click();
    await page.getByLabel('用户名').fill('e2e-temp-user');
    await page.getByLabel('显示名').fill('E2E 临时用户');
    await page
      .getByLabel('密码', { exact: false })
      .first()
      .fill('e2e-password-123');
    await page
      .getByLabel('确认密码', { exact: false })
      .first()
      .fill('e2e-password-123');
    await page.getByRole('button', { name: /确 定/ }).click();

    // 新行出现
    await expect(page.getByText('E2E 临时用户').first()).toBeVisible({
      timeout: 15_000,
    });

    // 删除该用户（行内 Popconfirm）
    const row = page.locator('tr', { hasText: 'e2e-temp-user' });
    await row.getByText('删除', { exact: true }).click();
    await page.getByRole('button', { name: /确 定/ }).click();

    await expect(page.getByText('E2E 临时用户')).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});

test.describe('权限边界', () => {
  test('无角色用户访问管理页自动跳转欢迎页', async ({ page, request }) => {
    // 防御性预清理：撤销历史可能遗留的 alice 直授权限，保证用例幂等
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    await apiCall(request, adminToken, 'PUT', '/api/v1/users/3/permissions', {
      permissions: [],
    });

    // alice：无任何角色/权限（种子默认）
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('alice');
    await page.getByPlaceholder('密码', { exact: false }).fill('demo123456');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });

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

      await page.goto('/user/login');
      await page.getByPlaceholder('用户名', { exact: false }).fill('alice');
      await page.getByPlaceholder('密码', { exact: false }).fill('demo123456');
      await page.getByRole('button', { name: /登\s*录/ }).click();
      await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });

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
