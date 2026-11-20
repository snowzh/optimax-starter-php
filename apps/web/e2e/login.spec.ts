import { expect, test } from '@playwright/test';

/**
 * 登录关键流程（真实 API，禁 mock）：
 * 种子账号见根 compose 环境默认值：admin/admin123、demo/demo123456、alice/demo123456
 */
test.describe('登录页', () => {
  test('登录表单可见（用户名 + 密码 + 提交按钮）', async ({ page }) => {
    await page.goto('/user/login');

    await expect(page.getByPlaceholder('用户名', { exact: false })).toBeVisible(
      { timeout: 30_000 },
    );
    await expect(page.getByPlaceholder('密码', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeEnabled();
  });

  test('正确凭据登录成功并进入欢迎页', async ({ page }) => {
    await page.goto('/user/login');

    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();

    // 登录成功后跳转（默认回 /welcome）
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    // 欢迎页的当前登录卡片含显示名（与布局头像名重复，取首个命中）
    await expect(page.getByText('系统管理员').first()).toBeVisible();
  });

  test('错误密码行内提示且停留登录页（4001）', async ({ page }) => {
    await page.goto('/user/login');

    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page
      .getByPlaceholder('密码', { exact: false })
      .fill('wrong-password');
    await page.getByRole('button', { name: /登\s*录/ }).click();

    // 后端 4001：展示统一中文提示，不发生跳转
    await expect(page.getByText('用户名或密码错误').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/user\/login/);
  });

  test('登出后回到登录页且 token 失效', async ({ page }) => {
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });

    // 头像菜单（antd dropdown trigger）→ 退出登录
    await page
      .locator('.ant-dropdown-trigger:has-text("系统管理员")')
      .first()
      .click();
    await page.getByText('退出登录').click();

    await expect(page).toHaveURL(/\/user\/login/, { timeout: 30_000 });

    // token 已清除：受保护页面自动重定向回登录页
    await page.goto('/system/user');
    await expect(page).toHaveURL(/\/user\/login/);
  });
});
