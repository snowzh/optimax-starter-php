import { expect, test } from '@playwright/test';
import {
  apiCall,
  apiJson,
  loginEnvelope,
  loginViaApi,
  loginViaUi,
  openSystemPage,
} from './helpers';

/**
 * 用户管理细化用例（真实 API，禁 mock）：
 * 增改删闭环自 system.spec.ts 迁入；新增角色分配/编辑/重置密码/启停/
 * 唯一性冲突/密码校验/筛选。测试数据一律 e2e- 前缀 + finally 清理。
 */

/** API 创建探针用户并返回 { id, username }（预置场景便捷封装） */
async function createProbeUser(
  request: any,
  adminToken: string,
  username: string,
  options: { status?: number; roleIds?: number[] } = {},
) {
  const password = 'probe-pass-123';
  const res = await apiJson(request, adminToken, 'POST', '/api/v1/users', {
    username,
    name: `探针 ${username}`,
    password,
    password_confirmation: password,
    status: options.status ?? 1,
    role_ids: options.roleIds ?? [],
  });
  // 创建失败显式抛错：避免静默传导成误导性的表格断言超时
  if (res.code !== 0 || !res.data?.id) {
    throw new Error(`探针用户创建失败（${username}）：${res.code} ${res.message}`);
  }
  return { id: res.data.id as number, username, password };
}

test.describe('用户管理', () => {
  test('超管完成用户增改删闭环', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '用户管理', /\/system\/user$/);
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
    await page.getByRole('button', { name: /确\s*定/ }).click();

    // 新行出现
    await expect(page.getByText('E2E 临时用户').first()).toBeVisible({
      timeout: 15_000,
    });

    // 删除该用户（行内 Popconfirm）
    const row = page.locator('tr', { hasText: 'e2e-temp-user' });
    await row.getByText('删除', { exact: true }).click();
    await page.getByRole('button', { name: /确\s*定/ }).click();

    await expect(page.getByText('E2E 临时用户')).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test('创建用户含角色分配，行内展示角色 Tag', async ({
    page,
    request,
  }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const roleName = `e2e-role-assign-${Date.now()}`;
    // 用户名受 2-32 位校验约束，用短随机串（user-of-<角色名> 会超长触发行内拦截）
    const username = `user-assign-${Date.now()}`;
    const role = await apiJson(request, adminToken, 'POST', '/api/v1/roles', {
      name: roleName,
      display_name: 'E2E 分配角色',
      permissions: [],
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      await page.getByRole('button', { name: /新建用户/ }).click();
      const dialog = page.getByRole('dialog', { name: '新建用户' });
      await dialog.getByLabel('用户名').fill(username);
      await dialog.getByLabel('显示名').fill('E2E 挂角色用户');
      await dialog
        .getByLabel('密码', { exact: false })
        .first()
        .fill('probe-pass-123');
      await dialog
        .getByLabel('确认密码', { exact: false })
        .first()
        .fill('probe-pass-123');

      // 角色多选：展开后勾选预置角色（antd 自定义选项无 option 角色，以 class 定位）
      await dialog
        .getByLabel('角色（可多选，单用户多角色）')
        .click();
      await page
        .locator('.ant-select-item-option', { hasText: 'E2E 分配角色' })
        .click();
      await page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();

      const row = page.locator('tr', { hasText: username });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText('E2E 分配角色')).toBeVisible();
    } finally {
      // 清理：搜出该用户并删除，再删角色
      const list = await apiJson(
        request,
        adminToken,
        'GET',
        `/api/v1/users?keyword=${encodeURIComponent(username)}`,
      );
      for (const item of list.data.items ?? []) {
        await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${item.id}`);
      }
      await apiCall(request, adminToken, 'DELETE', `/api/v1/roles/${role.data.id}`);
    }
  });

  test('编辑用户显示名，行内即时更新', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const probe = await createProbeUser(
      request,
      adminToken,
      `e2e-edit-${Date.now()}`,
    );

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      const row = page.locator('tr', { hasText: probe.username });
      await row.getByText('编辑', { exact: true }).click();

      const dialog = page.getByRole('dialog', {
        name: `编辑用户：${probe.username}`,
      });
      await dialog.getByLabel('显示名').fill('E2E 编辑后显示名');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();

      await expect(
        page.locator('tr', { hasText: probe.username }).getByText('E2E 编辑后显示名'),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${probe.id}`);
    }
  });

  test('编辑重置密码后旧密码失效、新密码可登录', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const probe = await createProbeUser(
      request,
      adminToken,
      `e2e-pass-${Date.now()}`,
    );

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      const row = page.locator('tr', { hasText: probe.username });
      await row.getByText('编辑', { exact: true }).click();

      const dialog = page.getByRole('dialog', {
        name: `编辑用户：${probe.username}`,
      });
      await dialog.getByLabel(/重置密码/).fill('new-pass-45678');
      await dialog
        .getByLabel('确认密码', { exact: false })
        .first()
        .fill('new-pass-45678');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('保存成功').first()).toBeVisible({
        timeout: 15_000,
      });

      // API 断言：旧密码 4001、新密码 code 0
      const oldLogin = await loginEnvelope(request, probe.username, probe.password);
      expect(oldLogin.code).toBe(4001);
      const newLogin = await loginEnvelope(
        request,
        probe.username,
        'new-pass-45678',
      );
      expect(newLogin.code).toBe(0);
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${probe.id}`);
    }
  });

  test('切换用户启停开关，状态列即时更新', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const probe = await createProbeUser(
      request,
      adminToken,
      `e2e-status-${Date.now()}`,
    );

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      const row = page.locator('tr', { hasText: probe.username });
      const toggle = row.locator('.ant-switch');
      await expect(toggle).toBeVisible({ timeout: 15_000 });

      // 禁用
      await toggle.click();
      await expect(page.getByText('已禁用').first()).toBeVisible();
      await expect(toggle).not.toHaveClass(/ant-switch-checked/);

      // 恢复启用
      await toggle.click();
      await expect(page.getByText('已启用').first()).toBeVisible();
      await expect(toggle).toHaveClass(/ant-switch-checked/);
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${probe.id}`);
    }
  });

  test('创建已存在用户名提示 3002 且弹窗不关闭', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '用户管理', /\/system\/user$/);

    // 以种子用户 admin 为重复目标：无需预置与清理
    await page.getByRole('button', { name: /新建用户/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建用户' });
    await dialog.getByLabel('用户名').fill('admin');
    await dialog.getByLabel('显示名').fill('E2E 重复探针');
    await dialog
      .getByLabel('密码', { exact: false })
      .first()
      .fill('probe-pass-123');
    await dialog
      .getByLabel('确认密码', { exact: false })
      .first()
      .fill('probe-pass-123');
    await dialog.getByRole('button', { name: /确\s*定/ }).click();

    // 后端 3002 唯一性冲突：统一提示且弹窗停留
    await expect(page.getByText('用户名已存在').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog).toBeVisible();
  });

  test('两次密码不一致，行内校验拦截且不提交', async ({ page }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '用户管理', /\/system\/user$/);

    await page.getByRole('button', { name: /新建用户/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建用户' });
    await dialog.getByLabel('用户名').fill(`e2e-mismatch-${Date.now()}`);
    await dialog.getByLabel('显示名').fill('E2E 密码不一致探针');
    await dialog
      .getByLabel('密码', { exact: false })
      .first()
      .fill('probe-pass-123');
    await dialog
      .getByLabel('确认密码', { exact: false })
      .first()
      .fill('different-pass-456');
    await dialog.getByRole('button', { name: /确\s*定/ }).click();

    // 前端行内校验：不发出请求、弹窗停留
    await expect(page.getByText('两次输入的密码不一致').first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByText('创建成功')).toHaveCount(0);
  });

  test('受保护角色在下拉中置灰不可选（后端 4006 兜底的体验层防线）', async ({
    page,
  }) => {
    await loginViaUi(page, 'admin', 'admin123');
    await openSystemPage(page, '用户管理', /\/system\/user$/);

    await page.getByRole('button', { name: /新建用户/ }).click();
    const dialog = page.getByRole('dialog', { name: '新建用户' });
    await dialog.getByLabel('角色（可多选，单用户多角色）').click();

    // super-admin 为受保护角色：选项禁用（此前用户可选中，提交才被 4006 拒绝）
    const protectedOpt = page.locator('.ant-select-item-option', {
      hasText: '超级管理员',
    });
    await expect(protectedOpt).toBeVisible({ timeout: 15_000 });
    await expect(protectedOpt).toHaveClass(/ant-select-item-option-disabled/);

    // 普通角色不受影响（下拉整体可用，只读访客可选）
    const normalOpt = page.locator('.ant-select-item-option', {
      hasText: '只读访客',
    });
    await normalOpt.click();

    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: /取\s*消/ }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('关键字筛选仅展示匹配用户', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const probe = await createProbeUser(
      request,
      adminToken,
      `e2e-filter-${Date.now()}`,
    );

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      // 关键字唯一前缀：结果只剩探针一行
      await page
        .getByPlaceholder('用户名 / 显示名')
        .fill(probe.username);
      await page.getByRole('button', { name: /查\s*询/ }).click();

      await expect(
        page.locator('tbody tr', { hasText: probe.username }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('tbody tr')).toHaveCount(1, {
        timeout: 15_000,
      });
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${probe.id}`);
    }
  });

  test('状态筛选禁用仅展示禁用用户', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const probe = await createProbeUser(
      request,
      adminToken,
      `e2e-off-${Date.now()}`,
      { status: 0 },
    );

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openSystemPage(page, '用户管理', /\/system\/user$/);

      await page.getByRole('combobox', { name: '状态筛选' }).click();
      await page
        .locator('.ant-select-item-option', { hasText: '禁用' })
        .click();
      await page.getByRole('button', { name: /查\s*询/ }).click();

      await expect(
        page.locator('tbody tr', { hasText: probe.username }),
      ).toBeVisible({ timeout: 15_000 });
      // 种子用户均为启用：禁用视图下不应出现 admin
      await expect(
        page.locator('tbody tr', { hasText: '系统管理员' }),
      ).toHaveCount(0);
    } finally {
      await apiCall(request, adminToken, 'DELETE', `/api/v1/users/${probe.id}`);
    }
  });
});
