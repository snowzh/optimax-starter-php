import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi, pickSelectOption } from './helpers';

/**
 * 物料·库存域 E2E（spec material-mgmt 测试矩阵 11-17 页面列）：
 * 入库（预填前缀）/ 重复编号 / 出库状态翻转 / 非在库置灰 / 三 Tab / 流水筛选。
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

test.describe('库存台账', () => {
  test('零件入库（预填前缀）→ 台账在库行；重复编号提示', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    // 时间戳唯一前缀：失败轮次残留不会让下轮预置撞 3002
    const component = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-STK-C1-${stamp}`, name: '库存探针零件',
    });
    const componentId = component.data.id as number;
    // 预置一件作为重复编号目标
    const first = await apiJson(request, adminToken, 'POST', '/api/v1/material/component-units', {
      component_id: componentId, serial_no: `MAT-STK-C1-${stamp}-0001`,
    });
    const firstId = first.data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '库存台账', /\/material\/stock$/);
      // 切到零件 Tab
      await page.getByRole('tab', { name: '零件' }).click();
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 入库弹窗：预填前缀提交
      await page.getByRole('button', { name: /入库/ }).click();
      const dialog = page.getByRole('dialog', { name: '零件入库' });
      await pickSelectOption(page, dialog.locator('.ant-form-item', { hasText: '零件型号' }).getByRole('combobox'), `MAT-STK-C1-${stamp}`);
      await dialog
        .getByLabel('实例编号')
        .fill('0002');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(dialog).toBeHidden();
      await page.getByPlaceholder('编号模糊搜索').fill(`MAT-STK-C1-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      const row = page.locator('tbody tr', { hasText: `MAT-STK-C1-${stamp}-0002` });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText('在库')).toBeVisible();

      // 重复编号提示且弹窗停留
      await page.getByRole('button', { name: /入库/ }).click();
      const dupDialog = page.getByRole('dialog', { name: '零件入库' });
      await pickSelectOption(page, dupDialog.locator('.ant-form-item', { hasText: '零件型号' }).getByRole('combobox'), `MAT-STK-C1-${stamp}`);
      await dupDialog.getByLabel('实例编号').fill('0001');
      await dupDialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('库存实例编号已存在').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(dupDialog).toBeVisible();
    } finally {
      // 清理：units 报废出库置终态（append-only 台账，无删除路由）；
      // 型号删除将被 4008 拒（存在实例），无害失败由 catch 吞——mat- 前缀保证不扰他例
      const list = await apiJson(
        request,
        adminToken,
        'GET',
        '/api/v1/material/component-units?serial=MAT-STK-C1-' + stamp,
      );
      for (const item of list.data.items ?? []) {
        if (item.status === 1) {
          await apiJson(request, adminToken, 'POST', `/api/v1/material/component-units/${item.id}/out`, { type: 3 }).catch(() => {});
        }
      }
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${componentId}`).catch(() => {});
      void firstId;
    }
  });

  test('型号筛选下拉选择后表格仅剩该型号行', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    // 两个型号各一件：筛选目标 + 干扰行
    const target = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-MODEL-F1-${stamp}`, name: '筛选目标型号',
    });
    const other = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-MODEL-F2-${stamp}`, name: '干扰型号',
    });
    const targetId = target.data.id as number;
    const otherId = other.data.id as number;
    await apiJson(request, adminToken, 'POST', '/api/v1/material/product-units', {
      product_id: targetId, serial_no: `MAT-MODEL-F1-${stamp}-0001`,
    });
    await apiJson(request, adminToken, 'POST', '/api/v1/material/product-units', {
      product_id: otherId, serial_no: `MAT-MODEL-F2-${stamp}-0001`,
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '库存台账', /\/material\/stock$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 「型号筛选」必须走 Select 选 id（回归护栏：曾因缺 valueType 渲染为文本框，
      // 用户按 placeholder 误输编码文本以 product_id 直发后端 422）
      await pickSelectOption(
        page,
        page.locator('.ant-form-item', { hasText: '型号筛选' }).getByRole('combobox'),
        `MAT-MODEL-F1-${stamp}`,
      );
      await page.getByRole('button', { name: /查\s*询/ }).click();

      // 表格仅剩目标型号行，干扰型号不出现
      await expect(
        page.locator('tbody tr', { hasText: `MAT-MODEL-F1-${stamp}` }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.locator('tbody tr', { hasText: `MAT-MODEL-F2-${stamp}` }),
      ).toHaveCount(0);
    } finally {
      // 清理同前例：报废出库置终态（4008 拒删由 catch 吞），两型号各自处理
      for (const code of [`MAT-MODEL-F1-${stamp}`, `MAT-MODEL-F2-${stamp}`]) {
        const list = await apiJson(request, adminToken, 'GET', `/api/v1/material/product-units?serial=${code}`);
        for (const item of list.data.items ?? []) {
          if (item.status === 1) {
            await apiJson(request, adminToken, 'POST', `/api/v1/material/product-units/${item.id}/out`, { type: 3 }).catch(() => {});
          }
        }
      }
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${targetId}`).catch(() => {});
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${otherId}`).catch(() => {});
    }
  });

  test('出库状态列翻转；非在库行出库入口置灰', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const product = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-STK-P1-${stamp}`, name: '出库探针产品',
    });
    const productId = product.data.id as number;
    const inStock = await apiJson(request, adminToken, 'POST', '/api/v1/material/product-units', {
      product_id: productId, serial_no: `MAT-STK-P1-${stamp}-0001`,
    });
    const scrapped = await apiJson(request, adminToken, 'POST', '/api/v1/material/product-units', {
      product_id: productId, serial_no: `MAT-STK-P1-${stamp}-0002`,
    });
    await apiJson(request, adminToken, 'POST', `/api/v1/material/product-units/${scrapped.data.id}/out`, { type: 3 });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '库存台账', /\/material\/stock$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      await page.getByPlaceholder('编号模糊搜索').fill(`MAT-STK-P1-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      // 出库弹窗选领用 → 状态列翻转为已出库
      const row = page.locator('tbody tr', { hasText: `MAT-STK-P1-${stamp}-0001` });
      await row.getByText('出库', { exact: true }).click();
      const outDialog = page.getByRole('dialog', { name: `出库：MAT-STK-P1-${stamp}-0001` });
      await pickSelectOption(page, outDialog.locator('.ant-form-item', { hasText: '出库类型' }).getByRole('combobox'), '领用出库');
      await outDialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-STK-P1-${stamp}-0001` }).getByText('已出库'),
      ).toBeVisible({ timeout: 15_000 });

      // 非在库（已报废）行：出库入口置灰（UI 防线；后端 4007 由 Pest 验证）
      const deadRow = page.locator('tbody tr', { hasText: `MAT-STK-P1-${stamp}-0002` });
      await expect(deadRow.getByText('已报废')).toBeVisible();
      const deadStyle = await deadRow
        .getByText('出库', { exact: true })
        .getAttribute('style');
      expect(deadStyle).toContain('pointer-events');
      expect(deadStyle).toContain('none');
    } finally {
      // 型号下 units 为终态但仍有实例：4008 拒删由 catch 吞（mat- 前缀不扰他例）
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${productId}`).catch(() => {});
    }
  });

  test('流水 Tab 渲染方向与类型列；方向筛选仅剩出库', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const created = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-MV-C1-${stamp}`, name: '流水探针零件',
    });
    const unit = await apiJson(request, adminToken, 'POST', '/api/v1/material/component-units', {
      component_id: created.data.id, serial_no: `MAT-MV-C1-${stamp}-0001`,
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '库存台账', /\/material\/stock$/);
      await page.getByRole('tab', { name: '出入库流水' }).click();
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 最新流水（本探针入库）含方向与实例编号
      const row = page.locator('tbody tr', { hasText: `MAT-MV-C1-${stamp}-0001` }).first();
      await expect(row).toBeVisible({ timeout: 15_000 });
      // exact 匹配避免与类型列「采购入库」子串双命中
      await expect(row.getByText('入库', { exact: true })).toBeVisible();
      await expect(row.getByText('采购入库', { exact: true })).toBeVisible();

      // 方向筛选 = 出库 → 探针入库行不出现
      await pickSelectOption(page, page.locator('.ant-form-item', { hasText: '方向' }).getByRole('combobox'), '出库');
      await page.getByRole('button', { name: /查\s*询/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-MV-C1-${stamp}-0001` }),
      ).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await apiJson(request, adminToken, 'POST', `/api/v1/material/component-units/${unit.data.id}/out`, { type: 3 }).catch(() => {});
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${created.data.id}`).catch(() => {});
    }
  });
});
