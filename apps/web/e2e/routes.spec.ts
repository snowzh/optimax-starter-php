import { expect, test } from '@playwright/test';
import { loginViaApi } from './helpers';

/**
 * 路由直达回归（starter-scaffold 事故防线，2026-11）：
 * web nginx `try_files $uri/` 曾因 exportStatic 目录触发 301，
 * 且 Location 基于 $host（不含端口）生成——宿主浏览器经 8080 直达/刷新
 * 任意路由被弹到 80 端口连接拒绝；compose 网内（默认端口）对该缺陷免疫。
 * 此处以 redirectedFrom 断言服务端零重定向，任何 try_files/绝对重定向回归立即变红。
 */
const PUBLIC_ROUTES = ['/', '/user/login'];

// 登录态直达的受保护路由（整页 goto 模拟直达/刷新，非 SPA 内部导航）
const PROTECTED_ROUTES = [
  '/welcome',
  '/system/user',
  '/system/role',
  '/system/permission',
];

test.describe('路由直达', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`公开路由 ${route || '/'} 直达 200 且零重定向`, async ({ page }) => {
      const resp = await page.goto(route);

      expect(resp?.status()).toBe(200);
      expect(resp?.request().redirectedFrom()).toBeNull();
    });
  }

  test('登录态直达欢迎页与三管理页均零重定向', async ({ page, request }) => {
    const token = await loginViaApi(request, 'admin', 'admin123');
    await page.addInitScript((t) => {
      localStorage.setItem('token', t as string);
    }, token);

    for (const route of PROTECTED_ROUTES) {
      const resp = await page.goto(route);

      expect(resp?.status()).toBe(200);
      expect(resp?.request().redirectedFrom()).toBeNull();
    }
  });

  test('尾斜杠访问 /user/login/ 正常回退渲染登录表单', async ({ page }) => {
    const resp = await page.goto('/user/login/');

    expect(resp?.status()).toBe(200);
    expect(resp?.request().redirectedFrom()).toBeNull();
    await expect(
      page.getByPlaceholder('用户名', { exact: false }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
