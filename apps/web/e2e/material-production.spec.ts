import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi, pickSelectOption } from './helpers';

/**
 * 物料·生产域 E2E（spec material-mgmt 测试矩阵 18-21 页面列）：
 * BOM 渲染与瓶颈警示 → 工单提交闭环 → 历史详情消耗明细。
 * 数据 API 预置（型号/位置/零件入库），UI 走完整工单交互。
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

test.describe('生产工单', () => {
  test('完整闭环：BOM 渲染 → 选消耗件 → 提交 → 历史行与详情', async ({ page, request }) => {
    // 本用例含 BOM 渲染 + 4 轮编号搜索多选 + 详情断言，交互重——放宽单用例上限
    test.setTimeout(240_000);
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();

    // 预置：产品（两位置：垫片×3 + 电机×1）+ 零件入库
    const product = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-PRD-${stamp}`, name: '生产闭环产品',
    });
    const washer = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-WSH-${stamp}`, name: '闭环垫片',
    });
    const motor = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-MTR-${stamp}`, name: '闭环电机',
    });
    const productId = product.data.id as number;
    const washerId = washer.data.id as number;
    const motorId = motor.data.id as number;

    await apiJson(request, adminToken, 'POST', `/api/v1/material/products/${productId}/positions`, {
      name: '主孔位', component_id: washerId, quantity: 3,
    });
    await apiJson(request, adminToken, 'POST', `/api/v1/material/products/${productId}/positions`, {
      name: '驱动位', component_id: motorId, quantity: 1,
    });

    const washerUnits: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const u = await apiJson(request, adminToken, 'POST', '/api/v1/material/component-units', {
        component_id: washerId, serial_no: `MAT-WSH-${stamp}-000${i}`,
      });
      washerUnits.push(u.data.id as number);
    }
    const motorUnit = await apiJson(request, adminToken, 'POST', '/api/v1/material/component-units', {
      component_id: motorId, serial_no: `MAT-MTR-${stamp}-0001`,
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '生产工单', /\/material\/production$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 发起生产 → 选型号 → BOM 渲染（两位置行 + 瓶颈提示）
      await page.getByRole('button', { name: /发起生产/ }).click();
      const dialog = page.getByRole('dialog', { name: '发起生产（零件 → 产品）' });
      await pickSelectOption(page, dialog.locator('.ant-form-item', { hasText: '产品型号' }).getByRole('combobox'), `MAT-PRD-${stamp}`);
      await expect(dialog.getByText('可生产数（瓶颈）：1 件')).toBeVisible({
        timeout: 15_000,
      });
      const bomTable = dialog.locator('tbody');
      await expect(bomTable.getByText('主孔位')).toBeVisible();
      await expect(bomTable.getByText('驱动位')).toBeVisible();
      await expect(bomTable.getByText('闭环垫片')).toBeVisible();

      // 选消耗件：垫片 3 + 电机 1（完整编号整串搜索——逐键序列会触发多次
      // onSearch 请求且响应乱序，慢环境下选项不可靠，实测教训）
      const pickUnits = async (code: string, serials: string[]) => {
        for (const serial of serials) {
          const select = dialog.getByPlaceholder(`搜索 ${code} 的在库编号`);
          await select.click();
          await select.fill(serial);
          const option = page
            .locator('.ant-select-dropdown:visible .ant-select-item-option', {
              hasText: serial,
            })
            .first();
          await option.waitFor({ state: 'visible', timeout: 15_000 });
          await option.click();
        }
        await page.keyboard.press('Escape');
      };
      await pickUnits(`MAT-WSH-${stamp}`, [
        `MAT-WSH-${stamp}-0001`,
        `MAT-WSH-${stamp}-0002`,
        `MAT-WSH-${stamp}-0003`,
      ]);
      await pickUnits(`MAT-MTR-${stamp}`, [`MAT-MTR-${stamp}-0001`]);
      await expect(dialog.getByText('已选 4 件')).toBeVisible();

      // 产出编号（预填前缀 型号编码-）
      await dialog
        .getByLabel('产出件编号')
        .locator('input')
        .fill(`MAT-PRD-${stamp}-OUT1`);

      // 提交 → 成功提示 + 历史新行
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('生产完成：零件已消耗，产品已入库').first()).toBeVisible({
        timeout: 15_000,
      });
      // 并发下历史列表增长：先 keyword 筛出目标行（防掉页）再断言
      await page.getByPlaceholder('型号编码 / 产出编号').fill(`MAT-PRD-${stamp}-OUT1`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      const historyRow = page.locator('tbody tr', { hasText: `MAT-PRD-${stamp}-OUT1` });
      await expect(historyRow).toBeVisible({ timeout: 15_000 });
      await expect(historyRow.getByText('4')).toBeVisible();

      // 详情 Drawer：消耗明细
      await historyRow.getByText('详情', { exact: true }).click();
      const drawer = page.locator('.ant-drawer-content');
      await expect(drawer.getByText('消耗明细（4 件）')).toBeVisible({ timeout: 15_000 });
      await expect(drawer.getByText(`MAT-WSH-${stamp}-0001`)).toBeVisible();
      await expect(drawer.getByText(`MAT-MTR-${stamp}-0001`)).toBeVisible();
    } finally {
      // 清理：产出入库件报废出库；消耗件已是终态；生产记录保留（append-only，
      // 型号/零件删除会被 4008/外键拒，无害失败由 catch 吞）
      const produced = await apiJson(
        request,
        adminToken,
        'GET',
        `/api/v1/material/product-units?serial=MAT-PRD-${stamp}`,
      );
      for (const item of produced.data.items ?? []) {
        if (item.status === 1) {
          await apiJson(request, adminToken, 'POST', `/api/v1/material/product-units/${item.id}/out`, { type: 3 }).catch(() => {});
        }
      }
      void washerUnits;
      void motorUnit;
    }
  });

  test('零库存 BOM 警示可生产数为 0', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();

    const product = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-EMPTY-${stamp}`, name: '缺料产品',
    });
    const component = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-EMP-C-${stamp}`, name: '缺料零件',
    });
    await apiJson(request, adminToken, 'POST', `/api/v1/material/products/${product.data.id}/positions`, {
      name: '主孔位', component_id: component.data.id, quantity: 2,
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '生产工单', /\/material\/production$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: /发起生产/ }).click();
      const dialog = page.getByRole('dialog', { name: '发起生产（零件 → 产品）' });
      await pickSelectOption(page, dialog.locator('.ant-form-item', { hasText: '产品型号' }).getByRole('combobox'), `MAT-EMPTY-${stamp}`);
      // 瓶颈警示：可生产数 0 + 缺料说明（提交侧 4010 由后端拒绝、Pest 已验证）
      await expect(dialog.getByText('可生产数（瓶颈）：0 件')).toBeVisible({
        timeout: 15_000,
      });
      await expect(dialog.getByText('零件在库量不足（4010）')).toBeVisible();
    } finally {
      // 位置随型号级联；型号无 units 可删，零件无 units 可删
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${product.data.id}`).catch(() => {});
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${component.data.id}`).catch(() => {});
    }
  });
});
