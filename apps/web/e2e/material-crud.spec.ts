import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi, pickSelectOption } from './helpers';

// 两个型号域与两个库存域分别走真实页面写操作，避免 API 预置代替 UI 验收。
for (const kind of ['product', 'component'] as const) {
  const label = kind === 'product' ? '产品' : '零件';
  const resource = `${kind}s`;
  test(`${label}型号 UI 登记、编辑、删除闭环`, async ({ page, request }) => {
    const token = await loginViaApi(request, 'admin', 'admin123');
    const code = `MAT-CRUD-${kind}-${Date.now()}`;
    let id: number | undefined;
    try {
      await loginViaUi(page, 'admin', 'admin123');
      await page.goto(`/material/${kind}`);
      await page.getByRole('button', { name: /登记型号/ }).click();
      const dialog = page.getByRole('dialog', { name: `登记${label}型号` });
      await dialog.getByLabel('型号编码').fill(code);
      await dialog.getByLabel('名称').fill('页面登记探针');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(dialog).toBeHidden();
      const list = await apiJson(request, token, 'GET', `/api/v1/material/${resource}?keyword=${code}`);
      expect(list.data.total).toBe(1);
      id = list.data.items[0].id;
      await page.getByPlaceholder('编码 / 名称').fill(code);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      const row = page.locator('tbody tr', { hasText: code });
      await expect(row.getByText('页面登记探针')).toBeVisible();
      await row.getByText('编辑', { exact: true }).click();
      const edit = page.getByRole('dialog', { name: `编辑型号：${code}` });
      await edit.getByLabel('名称').fill('页面更新探针');
      await edit.getByRole('button', { name: /确\s*定/ }).click();
      await expect(row.getByText('页面更新探针')).toBeVisible();
      await row.getByText('删除', { exact: true }).click();
      await page.getByRole('button', { name: /确\s*定/ }).click();
      await expect(row).toHaveCount(0);
    } finally {
      if (id) await apiJson(request, token, 'DELETE', `/api/v1/material/${resource}/${id}`);
    }
  });

  test(`${label} UI 入库、编号和状态筛选、出库闭环`, async ({ page, request }) => {
    const token = await loginViaApi(request, 'admin', 'admin123');
    const code = `MAT-UNIT-${kind}-${Date.now()}`;
    const model = await apiJson(request, token, 'POST', `/api/v1/material/${resource}`, { code, name: '库存闭环探针' });
    expect(model.code).toBe(0);
    await loginViaUi(page, 'admin', 'admin123');
    await page.goto('/material/stock');
    await page.getByRole('tab', { name: `${label}`, exact: true }).click();
    await page.getByRole('button', { name: /入库/ }).click();
    const dialog = page.getByRole('dialog', { name: `${label}入库` });
    await pickSelectOption(page, dialog.locator('.ant-form-item', { hasText: `${label}型号` }).getByRole('combobox'), code);
    // 选型号后前缀锁定展示（addon 不可改），默认流水预填（首件 → 0001），免手填直接提交
    await expect(dialog.locator('.ant-input-group-addon')).toHaveText(`${code}-`);
    await expect(dialog.getByLabel('实例编号')).toHaveValue('0001', {
      timeout: 15_000,
    });
    await dialog.getByRole('button', { name: /确\s*定/ }).click();
    await expect(dialog).toBeHidden();
    await page.getByLabel('编号搜索').fill(code);
    await page.getByRole('button', { name: /查\s*询/ }).click();
    const row = page.locator('tbody tr', { hasText: `${code}-0001` });
    await expect(row.getByText('在库', { exact: true })).toBeVisible();
    await row.getByText('出库', { exact: true }).click();
    const out = page.getByRole('dialog', { name: `出库：${code}-0001` });
    await pickSelectOption(page, out.locator('.ant-form-item', { hasText: '出库类型' }).getByRole('combobox'), '领用出库');
    await out.getByRole('button', { name: /确\s*定/ }).click();
    await expect(row.getByText('已出库', { exact: true })).toBeVisible();
    await page.getByText('展开', { exact: true }).click();
    await pickSelectOption(page, page.locator('.ant-form-item', { hasText: '状态筛选' }).getByRole('combobox'), '在库');
    await page.getByRole('button', { name: /查\s*询/ }).click();
    await expect(row).toHaveCount(0);
  });
}
