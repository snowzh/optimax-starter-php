import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi, pickSelectOption } from './helpers';

/**
 * 物料·生产域 E2E（spec material-mgmt 测试矩阵 18-21 页面列）：
 * 发起生产独立页（/material/production/create）→ BOM 渲染 →
 * 消耗件弹窗列表选择（分页表格 + 多选）→ 提交 → 历史行与详情。
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
  test('完整闭环：独立页 BOM 渲染 → 弹窗列表选件 → 提交 → 历史行与详情', async ({ page, request }) => {
    // 本用例含独立页跳转 + BOM 渲染 + 弹窗列表选择 + 真实竞争 + 详情断言——放宽单用例上限
    test.setTimeout(150_000);
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

      // 发起生产 → 独立页
      await page.getByRole('button', { name: /发起生产/ }).click();
      await page.waitForURL(/\/material\/production\/create$/);

      // 选产品 → BOM 渲染（两位置行 + 瓶颈提示）
      await pickSelectOption(page, page.getByRole('combobox'), `MAT-PRD-${stamp}`);
      await expect(page.getByText('可生产数（瓶颈）：1 件')).toBeVisible({
        timeout: 15_000,
      });
      const bomTable = page.locator('tbody');
      await expect(bomTable.getByText('主孔位')).toBeVisible();
      await expect(bomTable.getByText('驱动位')).toBeVisible();
      await expect(bomTable.getByText('闭环垫片')).toBeVisible();

      // BOM 渲染后消耗件默认预选就位（每型号按用量自动勾选，免手选），
      // 已选 chips 为完整编号 label（回归护栏：曾有裸 id 渲染缺陷）
      await expect(page.getByText(/已选 4\s*件/)).toBeVisible({
        timeout: 15_000,
      });
      const washerRow = page.locator('.ant-space').filter({ has: page.getByText(new RegExp(`^MAT-WSH-${stamp}（需`)) }).last();
      await expect(washerRow.getByText(`MAT-WSH-${stamp}-0001`)).toBeVisible();

      // 产出编号：前缀锁定展示 + 默认流水预填（该型号首件 → 0001）
      await expect(page.locator('input[id="serialFlow"]')).toHaveValue(
        '0001',
        { timeout: 15_000 },
      );

      // 真实竞争：已选件被另一操作者领走，后端 4011 必须提示且页面停留。
      const unavailable = await apiJson(request, adminToken, 'POST',
        `/api/v1/material/component-units/${motorUnit.data.id}/out`, { type: 1 });
      expect(unavailable.code).toBe(0);
      await page.getByRole('button', { name: /确定生产/ }).click();
      await expect(page.getByText('所选零件不存在、不在库或不属于该产品 BOM，无法用于生产').first()).toBeVisible();
      await expect(page).toHaveURL(/\/material\/production\/create$/);

      // 用新入库的同型号件替换失效选择：页面级关闭失效 chip（按钮随已选清空
      // 切换为「选择零件」）→ 弹窗列表勾选替换件（初始勾选为空，无幽灵项）
      const replacement = await apiJson(request, adminToken, 'POST', '/api/v1/material/component-units', {
        component_id: motorId, serial_no: `MAT-MTR-${stamp}-0002`,
      });
      expect(replacement.code).toBe(0);
      const motorRow = page.locator('.ant-space').filter({ has: page.getByText(`MAT-MTR-${stamp}（需 1）`, { exact: true }) }).last();
      await motorRow.locator('.ant-tag', { hasText: `MAT-MTR-${stamp}-0001` }).locator('.anticon-close').click();
      await motorRow.getByRole('button', { name: /选择零件/ }).click();
      const picker = page.getByRole('dialog', { name: new RegExp(`选择 MAT-MTR-${stamp}`) });
      await expect(picker).toBeVisible({ timeout: 15_000 });
      const replacementRow = picker.locator('tbody tr', { hasText: `MAT-MTR-${stamp}-0002` });
      await expect(replacementRow).toBeVisible({ timeout: 15_000 });
      await replacementRow.getByRole('checkbox').check();
      await picker.getByRole('button', { name: /确\s*定/ }).click();
      await expect(motorRow.getByText(`MAT-MTR-${stamp}-0002`)).toBeVisible();

      // 提交 → 成功提示 → 跳回生产记录页
      await page.getByRole('button', { name: /确定生产/ }).click();
      await expect(page.getByText('生产完成：零件已消耗，产品已入库').first()).toBeVisible({
        timeout: 15_000,
      });
      await page.waitForURL(/\/material\/production$/);
      // 并发下历史列表增长：先 keyword 筛出目标行（防掉页）再断言（默认流水 0001）
      await page.getByPlaceholder('型号编码 / 产出编号').fill(`MAT-PRD-${stamp}-0001`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      const historyRow = page.locator('tbody tr', { hasText: `MAT-PRD-${stamp}-0001` });
      await expect(historyRow).toBeVisible({ timeout: 15_000 });
      await expect(historyRow.getByRole('cell', { name: '4', exact: true })).toBeVisible();

      // 详情 Drawer：消耗明细
      await historyRow.getByText('详情', { exact: true }).click();
      const drawer = page.getByRole('dialog', { name: /生产记录 #/ });
      await expect(drawer.getByText('消耗明细（4 件）')).toBeVisible({ timeout: 15_000 });
      await expect(drawer.getByText(`MAT-WSH-${stamp}-0001`)).toBeVisible();
      await expect(drawer.getByText(`MAT-MTR-${stamp}-0002`)).toBeVisible();
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

      await page.getByRole('button', { name: /发起生产/ }).click();
      await page.waitForURL(/\/material\/production\/create$/);
      await pickSelectOption(page, page.getByRole('combobox'), `MAT-EMPTY-${stamp}`);
      // 瓶颈警示：可生产数 0 + 缺料说明（提交侧 4010 由后端拒绝、Pest 已验证）
      await expect(page.getByText('可生产数（瓶颈）：0 件')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/零件在库量不足（4010）/)).toBeVisible();
    } finally {
      // 位置随型号级联；型号无 units 可删，零件无 units 可删
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${product.data.id}`).catch(() => {});
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${component.data.id}`).catch(() => {});
    }
  });
});
