import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi } from './helpers';

/**
 * 物料·零件型号域 E2E（spec material-mgmt 测试矩阵 10 页面列）：
 * 与产品域同构语义，覆盖登记/重复/筛选三要点。
 */

/** 展开物料管理菜单并进入子页 */
async function openMaterialPage(
  page: import('@playwright/test').Page,
  menuItem: string,
  urlPattern: RegExp,
) {
  await page.getByText('物料管理', { exact: true }).first().click();
  await page.getByRole('menuitem', { name: menuItem }).click();
  await expect(page).toHaveURL(urlPattern);
}

test.describe('零件型号', () => {
  test('登记行内展示；重复编码提示且弹窗停留；关键字筛选', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const componentId = (
      await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
        code: `MAT-CMP-${stamp}`, name: '零件探针',
      })
    ).data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '零件型号', /\/material\/component$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 重复编码提示且弹窗停留（预置件为重复目标）
      await page.getByRole('button', { name: /登记型号/ }).click();
      const dialog = page.getByRole('dialog', { name: '登记零件型号' });
      await dialog.getByLabel('型号编码').fill(`MAT-CMP-${stamp}`);
      await dialog.getByLabel('名称').fill('重复零件');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('型号编码已存在').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /取\s*消/ }).click().catch(() => {});

      // 预置行可见
      const row = page.locator('tbody tr', { hasText: `MAT-CMP-${stamp}` });
      await expect(row).toBeVisible();
      await expect(row.getByText('零件探针')).toBeVisible();

      // 关键字筛选：仅剩探针行
      await page.getByPlaceholder('编码 / 名称').fill('零件探针');
      await page.getByRole('button', { name: /查\s*询/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-CMP-${stamp}` }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('tbody tr', { hasText: 'E2E 型号' }),
      ).toHaveCount(0);
    } finally {
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${componentId}`).catch(() => {});
    }
  });
});
