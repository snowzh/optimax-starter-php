import { expect, test } from '@playwright/test';
import {
  apiCall,
  apiJson,
  loginViaApi,
  loginViaUi,
  logoutViaUi,
  openSystemPage,
} from './helpers';

/**
 * 角色管理（真实 API，禁 mock）：
 * CRUD 全走 UI；矩阵变更生效链路以新登录会话验证（避开 initialState 缓存）。
 * 受保护角色删除置灰以样式断言（disabledActionStyle：pointer-events none）。
 */

/** API 创建探针角色并返回 { id, name } */
async function createProbeRole(
  request: any,
  adminToken: string,
  name: string,
  permissions: string[] = [],
) {
  const res = await apiJson(request, adminToken, 'POST', '/api/v1/roles', {
    name,
    display_name: `探针角色 ${name}`,
    permissions,
  });
  if (res.code !== 0 || !res.data?.id) {
    throw new Error(`探针角色创建失败（${name}）：${res.code} ${res.message}`);
  }
  return { id: res.data.id as number, name };
}

test.describe('角色管理', () => {
  test('超管完成角色增改删闭环（含矩阵勾选）', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '角色管理', /\/system\/role$/);

    const roleName = `e2e-role-crud-${Date.now()}`;

    // 新建角色并勾选「查看用户」
    await page.getByRole('button', { name: /新建角色/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建角色' });
    await dialog.getByLabel('角色标识').fill(roleName);
    await dialog.getByLabel('显示名').fill('E2E CRUD 角色');
    await dialog.getByRole('checkbox', { name: '查看用户' }).click();
    await dialog.getByRole('button', { name: /确\s*定/ }).click();

    // 新行出现且带权限码 Tag
    const row = page.locator('tr', { hasText: roleName });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('system.user.view')).toBeVisible();

    // 编辑显示名
    await row.getByText('编辑', { exact: true }).click();
    const editDialog = page.getByRole('dialog', {
      name: '编辑角色：E2E CRUD 角色',
    });
    await editDialog.getByLabel('显示名').fill('E2E CRUD 角色改');
    await editDialog.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.getByText('E2E CRUD 角色改')).toBeVisible({
      timeout: 15_000,
    });

    // 删除（行内 Popconfirm）
    await page
      .locator('tr', { hasText: roleName })
      .getByText('删除', { exact: true })
      .click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(page.locator('tr', { hasText: roleName })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test('受保护角色（super-admin）删除入口置灰', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '角色管理', /\/system\/role$/);

    const row = page.locator('tr', { hasText: 'super-admin' });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // disabledActionStyle：pointer-events none（后端 4006 兜底的 UI 防线）
    const deleteStyle = await row
      .getByText('删除', { exact: true })
      .getAttribute('style');
    expect(deleteStyle).toContain('pointer-events');
    expect(deleteStyle).toContain('none');
  });

  test('角色矩阵勾选后，挂载用户菜单即时生效（新会话）', async ({
    page,
    request,
  }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const role = await createProbeRole(
      request,
      adminToken,
      `e2e-role-matrix-${stamp}`,
    );
    const username = `e2e-user-matrix-${stamp}`;
    const userRes = await apiJson(request, adminToken, 'POST', '/api/v1/users', {
      username,
      name: 'E2E 矩阵用户',
      password: 'probe-pass-123',
      password_confirmation: 'probe-pass-123',
      status: 1,
      role_ids: [role.id],
    });
    const userId = userRes.data.id as number;

    try {
      // 1) 授权前：该用户登录后展开系统管理——子菜单项按权限过滤不渲染
      //    （父项为体验层入口始终可见；无权限点击子路由由 access 拦截兜底）
      await loginViaUi(page, username, 'probe-pass-123');
      await page.getByText('系统管理', { exact: true }).first().click();
      await expect(
        page.getByRole('menuitem', { name: '用户管理' }),
      ).toHaveCount(0, { timeout: 15_000 });

      // 2) admin 为角色勾选「查看用户」
      await logoutViaUi(page, 'E2E 矩阵用户');
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '角色管理', /\/system\/role$/);
      const row = page.locator('tr', { hasText: role.name });
      await row.getByText('编辑', { exact: true }).click();
      const dialog = page.getByRole('dialog', {
        name: `编辑角色：探针角色 ${role.name}`,
      });
      await dialog.getByRole('checkbox', { name: '查看用户' }).click();
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('保存成功').first()).toBeVisible({
        timeout: 15_000,
      });

      // 3) 授权后：新会话登录可见「系统管理 → 用户管理」
      await logoutViaUi(page, '系统管理员');
      await loginViaUi(page, username, 'probe-pass-123');
      await page.getByText('系统管理', { exact: true }).first().click();
      await expect(
        page.getByRole('menuitem', { name: '用户管理' }),
      ).toBeVisible();
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${userId}`);
      await apiCall(request, adminToken, 'DELETE', `/api/v1/roles/${role.id}`);
    }
  });
});
