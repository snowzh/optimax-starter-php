import { expect, test } from '@playwright/test';

/**
 * 验收证据生成器：对关键页面截图，产物落 e2e-out/screenshots
 * （converge 证据表引用，重跑即刷新；CI 中随 artifact 上传）
 */
const shots = 'e2e-out/screenshots';

test.describe('验收证据截图', () => {
  test('登录页', async ({ page }) => {
    await page.goto('/user/login');
    await expect(page.getByPlaceholder('用户名', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${shots}/01-login.png`, fullPage: true });
  });

  test('欢迎页（admin 登录态）', async ({ page }) => {
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    await page.screenshot({ path: `${shots}/02-welcome.png`, fullPage: true });
  });

  test('用户管理页（admin）', async ({ page }) => {
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    await page.goto('/system/user');
    await expect(page.getByText('admin').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${shots}/03-system-user.png`, fullPage: true });
  });

  test('角色管理页（admin，含受保护角色置灰）', async ({ page }) => {
    await page.goto('/user/login');
    await page.getByPlaceholder('用户名', { exact: false }).fill('admin');
    await page.getByPlaceholder('密码', { exact: false }).fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
    await page.goto('/system/role');
    await expect(page.getByText('超级管理员').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${shots}/04-system-role.png`, fullPage: true });
  });
});
