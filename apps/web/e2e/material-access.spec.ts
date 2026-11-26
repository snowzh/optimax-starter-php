import { expect, test } from '@playwright/test';
import { loginViaUi } from './helpers';

/**
 * 物料域越权 E2E（spec material-mgmt 测试矩阵 22 页面列）：
 * alice（种子无任何物料权限）登录 → 物料管理父菜单展开后子项不渲染、
 * 直达路由被 access 拦截跳转。后端 403/2003 由 Pest 各域用例覆盖。
 */
test.describe('物料越权', () => {
  test('无物料权限账号：菜单子项不渲染、直达路由被拦截', async ({ page }) => {
    await loginViaUi(page, 'alice', 'demo123456');

    // 展开父菜单：子项按权限过滤不渲染
    await page.getByText('物料管理', { exact: true }).first().click();
    await expect(
      page.getByRole('menuitem', { name: '产品型号' }),
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.getByRole('menuitem', { name: '库存台账' }),
    ).toHaveCount(0);

    // 直达任一物料路由 → unAccessible 自动跳首个可访问页
    // （含发起生产独立页：写操作路由按 material.production.manage 收口）
    for (const route of [
      '/material/product',
      '/material/stock',
      '/material/production/create',
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    }
  });
});
