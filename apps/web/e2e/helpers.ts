import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * E2E 共享工具（真实 API，禁 mock）：
 * - loginEnvelope：登录并返回完整信封（需断言 code 的场景）
 * - loginViaApi：服务端登录换 token，供用例做权限预置/清理
 * - apiCall：以任意 token 执行任意 API（幂等预置/清理场景）
 * - loginViaUi：走登录页 UI 登录，断言进入欢迎页（交互主路径）
 * - openSystemPage：展开系统管理菜单并进入指定子页
 */

/** 登录并返回完整信封 {code, message, data}（4001/4002 等业务码断言用） */
export async function loginEnvelope(
  request: APIRequestContext,
  username: string,
  password: string,
) {
  const res = await request.post('/api/v1/auth/login', {
    data: { username, password },
  });
  return (await res.json()) as {
    code: number;
    message: string;
    data: { token?: string };
  };
}

export async function loginViaApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<string> {
  const body = await loginEnvelope(request, username, password);
  return body.data.token as string;
}

/** 以指定用户执行任意 API */
export async function apiCall(
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

/** 以任意 token 执行 API 并解析信封 JSON（预置场景便捷封装） */
export async function apiJson(
  request: APIRequestContext,
  token: string,
  method: string,
  path: string,
  data?: unknown,
) {
  const res = await apiCall(request, token, method, path, data);
  return (await res.json()) as {
    code: number;
    message: string;
    data: any;
  };
}

/** UI 登录：登录页填表提交并等待进入欢迎页 */
export async function loginViaUi(
  page: Page,
  username: string,
  password: string,
) {
  await page.goto('/user/login');
  await page
    .getByPlaceholder('用户名', { exact: false })
    .fill(username);
  await page.getByPlaceholder('密码', { exact: false }).fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
}

/** 展开系统管理菜单并进入指定子页（menuitem 定位，避免与标题文案歧义） */
export async function openSystemPage(
  page: Page,
  menuItem: string,
  urlPattern: RegExp,
) {
  await page.getByText('系统管理', { exact: true }).first().click();
  await page.getByRole('menuitem', { name: menuItem }).click();
  await expect(page).toHaveURL(urlPattern);
}

/** 登出 UI 会话：头像菜单 → 退出登录（换会话验证权限即时生效用） */
export async function logoutViaUi(page: Page, displayName: string) {
  await page
    .locator(`.ant-dropdown-trigger:has-text("${displayName}")`)
    .first()
    .click();
  await page.getByText('退出登录').click();
  await expect(page).toHaveURL(/\/user\/login/, { timeout: 30_000 });
}
