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
 * 权限清单与直授权限（真实 API，禁 mock）：
 * - 清单页只读：全部权限码可见且无操作入口
 * - 直授抽屉：UI 勾选保存 → 用户菜单即时出现；撤销后消失（新会话验证）。
 *   探针用户自建自清（不用种子 alice，避免与 system.spec 的 alice 用例并发竞争直授状态）
 */

/** 全部种子权限码（apps/api PermissionSeeder 契约） */
const ALL_PERMISSION_CODES = [
  'system.user.view',
  'system.user.manage',
  'system.role.view',
  'system.role.manage',
  'system.permission.view',
];

test.describe('权限清单', () => {
  test('只读展示全部权限码，无操作入口', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '权限清单', /\/system\/permission$/);

    for (const code of ALL_PERMISSION_CODES) {
      await expect(
        page.locator('tr', { hasText: code }),
      ).toBeVisible({ timeout: 15_000 });
    }

    // 只读页：无新建按钮、无操作列
    await expect(page.getByRole('button', { name: /新建/ })).toHaveCount(0);
    await expect(page.getByText('操作', { exact: true })).toHaveCount(0);
  });
});

test.describe('直授权限', () => {
  test('抽屉勾选保存后用户菜单即时生效，撤销后消失', async ({
    page,
    request,
  }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');

    // 自建探针用户（无角色无直授）：不触碰种子 alice（并发用例竞争）
    const username = `e2e-drawer-${Date.now()}`;
    const password = 'probe-pass-123';
    const created = await apiJson(request, adminToken, 'POST', '/api/v1/users', {
      username,
      name: 'E2E 直授抽屉用户',
      password,
      password_confirmation: password,
      status: 1,
      role_ids: [],
    });
    const userId = created.data.id as number;

    try {
      // 1) admin 经 UI 抽屉为探针用户勾选「查看用户」
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      const probeRow = page.locator('tr', { hasText: username });
      await probeRow.getByText('调整权限', { exact: true }).click();
      const drawer = page.getByRole('dialog', {
        name: `调整权限：${username}`,
      });
      await drawer.getByRole('checkbox', { name: '查看用户' }).click();
      await drawer.getByRole('button', { name: /保\s*存/ }).click();
      await expect(page.getByText('权限已更新').first()).toBeVisible({
        timeout: 15_000,
      });

      // 2) 探针用户新会话：可见用户管理菜单
      await logoutViaUi(page, '系统管理员');
      await loginViaUi(page, username, password);
      await page.getByText('系统管理', { exact: true }).first().click();
      await expect(
        page.getByRole('menuitem', { name: '用户管理' }),
      ).toBeVisible();

      // 3) admin 撤销直授：探针用户菜单随之消失
      await logoutViaUi(page, 'E2E 直授抽屉用户');
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);
      await page
        .locator('tr', { hasText: username })
        .getByText('调整权限', { exact: true })
        .click();
      const drawer2 = page.getByRole('dialog', {
        name: `调整权限：${username}`,
      });
      await drawer2.getByRole('checkbox', { name: '查看用户' }).click();
      await drawer2.getByRole('button', { name: /保\s*存/ }).click();
      await expect(page.getByText('权限已更新').first()).toBeVisible({
        timeout: 15_000,
      });

      await logoutViaUi(page, '系统管理员');
      await loginViaUi(page, username, password);
      // 撤销后：展开系统管理，用户管理子菜单项不渲染（父项体验层入口保留）
      await page.getByText('系统管理', { exact: true }).first().click();
      await expect(
        page.getByRole('menuitem', { name: '用户管理' }),
      ).toHaveCount(0, { timeout: 15_000 });
    } finally {
      // 探针用户整体删除，直授随之消失，种子零污染
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${userId}`);
    }
  });
});
