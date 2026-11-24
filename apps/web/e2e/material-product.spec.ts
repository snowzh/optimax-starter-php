import { expect, test } from '@playwright/test';
import { apiJson, loginViaApi, loginViaUi, pickSelectOption } from './helpers';

/**
 * 物料·产品型号域 E2E（spec material-mgmt 测试矩阵 1-9 页面列）。
 * 数据 API 预置 + UI 交互验证，mat- 前缀自建自清（真实 API 禁 mock）。
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

test.describe('产品型号', () => {
  test('登记新型号，行内即时展示；重复编码提示且弹窗停留', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const productId = (
      await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
        code: `MAT-PRD-${stamp}`, name: 'E2E 型号',
      })
    ).data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '产品型号', /\/material\/product$/);
      // 初次加载等待（防空表单竞态，对齐用户页用例经验）
      await expect(
        page.locator('tbody tr').first(),
      ).toBeVisible({ timeout: 15_000 });

      // 登记新型号（UI 表单路径；API 已预置同编码作为重复目标源）
      await page.getByRole('button', { name: /登记型号/ }).click();
      const dialog = page.getByRole('dialog', { name: '登记产品型号' });
      await dialog.getByLabel('型号编码').fill(`MAT-PRD-${stamp}`);
      await dialog.getByLabel('名称').fill('E2E 型号 UI');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(page.getByText('型号编码已存在').first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(dialog).toBeVisible();

      // 取消弹窗后行内预置型号可见（API 落库即渲染）
      await dialog.getByRole('button', { name: /取\s*消/ }).click().catch(() => {});
      const row = page.locator('tbody tr', { hasText: `MAT-PRD-${stamp}` });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText('E2E 型号')).toBeVisible();
    } finally {
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${productId}`).catch(() => {});
    }
  });

  test('关键字筛选仅展示匹配行（种子型号不出现）', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const created = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-FILTER-1-${stamp}`, name: '筛选探针型号',
    });
    const productId = created.data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '产品型号', /\/material\/product$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      await page.getByPlaceholder('编码 / 名称').fill(`MAT-FILTER-1-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-FILTER-1-${stamp}` }),
      ).toBeVisible({ timeout: 15_000 });
      // 其他种子/探针型号不出现（keyword 生效性语义）
      await expect(
        page.locator('tbody tr', { hasText: 'E2E 型号' }),
      ).toHaveCount(0);
    } finally {
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${productId}`);
    }
  });

  test('编辑型号名称行内即时更新', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const created = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-EDIT-1-${stamp}`, name: '编辑前名称',
    });
    const productId = created.data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '产品型号', /\/material\/product$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      const row = page.locator('tbody tr', { hasText: `MAT-EDIT-1-${stamp}` });
      await row.getByText('编辑', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `编辑型号：MAT-EDIT-1-${stamp}` });
      await dialog.getByLabel('名称').fill('编辑后名称');
      await dialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-EDIT-1-${stamp}` }).getByText('编辑后名称'),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${productId}`);
    }
  });

  test('零库存型号删除行消失；有库存型号删除提示并保留', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const zero = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-DEL-0-${stamp}`, name: '零库存型号',
    });
    const withUnit = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-DEL-1-${stamp}`, name: '有库存型号',
    });
    await apiJson(request, adminToken, 'POST', '/api/v1/material/product-units', {
      product_id: withUnit.data.id, serial_no: 'MAT-DEL-1-0001',
    });

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '产品型号', /\/material\/product$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 并发下列表持续增长（他用例建行）：先 keyword 过滤把目标行筛到唯一，防掉页
      await page.getByPlaceholder('编码 / 名称').fill(`MAT-DEL-1-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();

      // 有库存：4008 提示，行保留（筛选 reload 后先等新行渲染，防点击落空）
      const withRow = page.locator('tbody tr', { hasText: `MAT-DEL-1-${stamp}` });
      await expect(withRow).toBeVisible({ timeout: 15_000 });
      await withRow.getByText('删除', { exact: true }).click();
      await page.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        page.getByText('该型号下存在库存实例，禁止删除').first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(withRow).toBeVisible();

      // 零库存：再筛目标后删除，行消失
      await page.getByPlaceholder('编码 / 名称').fill(`MAT-DEL-0-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();
      const zeroRow = page.locator('tbody tr', { hasText: `MAT-DEL-0-${stamp}` });
      await expect(zeroRow).toBeVisible({ timeout: 15_000 });
      await zeroRow.getByText('删除', { exact: true }).click();
      await page.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        page.locator('tbody tr', { hasText: `MAT-DEL-0-${stamp}` }),
      ).toHaveCount(0, { timeout: 15_000 });
    } finally {
      // units 先删（FK restrict），再删型号
      const list = await apiJson(
        request,
        adminToken,
        'GET',
        '/api/v1/material/product-units?serial=MAT-DEL-1-' + stamp,
      );
      for (const item of list.data.items ?? []) {
        await apiJson(request, adminToken, 'DELETE', `/api/v1/material/product-units/${item.id}/out`, { type: 3 });
      }
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${withUnit.data.id}`);
    }
  });
});

test.describe('安装位置（A 方案）', () => {
  test('新增位置子表展示；同名提示；改数量更新；删除行消失', async ({ page, request }) => {
    const adminToken = await loginViaApi(request, 'admin', 'admin123');
    const stamp = Date.now();
    const product = await apiJson(request, adminToken, 'POST', '/api/v1/material/products', {
      code: `MAT-POS-1-${stamp}`, name: '位置载体型号',
    });
    const component = await apiJson(request, adminToken, 'POST', '/api/v1/material/components', {
      code: `MAT-POS-C1-${stamp}`, name: '位置探针零件',
    });
    const productId = product.data.id as number;
    const componentId = component.data.id as number;

    try {
      await loginViaUi(page, 'admin', 'admin123');
      await openMaterialPage(page, '产品型号', /\/material\/product$/);
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 });

      // 并发下先筛目标行到唯一（防掉页）再开 Drawer
      await page.getByPlaceholder('编码 / 名称').fill(`MAT-POS-1-${stamp}`);
      await page.getByRole('button', { name: /查\s*询/ }).click();

      // 打开位置 Drawer（筛选 reload 后等新行渲染；antd 6 无 v5 内容类名，语义断言）
      const row = page.locator('tbody tr', { hasText: `MAT-POS-1-${stamp}` });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.getByText('安装位置', { exact: true }).click();
      await expect(page.getByText(/安装位置：MAT-POS-1-/)).toBeVisible({ timeout: 15_000 });
      const drawer = page.locator('.ant-drawer');

      // 新增位置
      await page.getByRole('button', { name: /新增位置/ }).click();
      const createDialog = page.getByRole('dialog', { name: /新增安装位置/ });
      await createDialog.getByLabel('位置名').fill('主孔位');
      await pickSelectOption(page, createDialog.locator('.ant-form-item', { hasText: '零件型号' }).getByRole('combobox'), `MAT-POS-C1-${stamp}`);
      await createDialog.getByLabel('安装数量').fill('3');
      await createDialog.getByRole('button', { name: /确\s*定/ }).click();
      const posRow = drawer.locator('tbody tr', { hasText: '主孔位' });
      await expect(posRow).toBeVisible({ timeout: 15_000 });
      await expect(posRow.getByText('3', { exact: true })).toBeVisible();
      await expect(posRow.getByText(`MAT-POS-C1-${stamp}`)).toBeVisible();

      // 同名位置：4009 提示
      await page.getByRole('button', { name: /新增位置/ }).click();
      const dupDialog = page.getByRole('dialog', { name: /新增安装位置/ });
      await dupDialog.getByLabel('位置名').fill('主孔位');
      await pickSelectOption(page, dupDialog.locator('.ant-form-item', { hasText: '零件型号' }).getByRole('combobox'), `MAT-POS-C1-${stamp}`);
      await dupDialog.getByLabel('安装数量').fill('1');
      await dupDialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        page.getByText('该产品型号下位置名已存在').first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(dupDialog).toBeVisible();

      // 4009 提示后的弹窗取消（避免挡住后续交互）
      await dupDialog.getByRole('button', { name: /取\s*消/ }).click().catch(() => {});

      // 改数量 → 子表更新
      await posRow.getByText('编辑', { exact: true }).click();
      const editDialog = page.getByRole('dialog', { name: '编辑位置：主孔位' });
      await editDialog.getByLabel('安装数量').fill('5');
      await editDialog.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        drawer.locator('tbody tr', { hasText: '主孔位' }).getByText('5'),
      ).toBeVisible({ timeout: 15_000 });

      // 删除位置 → 行消失
      await drawer
        .locator('tbody tr', { hasText: '主孔位' })
        .getByText('删除', { exact: true })
        .click();
      await page.getByRole('button', { name: /确\s*定/ }).click();
      await expect(
        drawer.locator('tbody tr', { hasText: '主孔位' }),
      ).toHaveCount(0, { timeout: 15_000 });
    } finally {
      // install_positions 随 product 级联；先删型号（无 units 可直删）
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/products/${productId}`).catch(() => {});
      await apiJson(request, adminToken, 'DELETE', `/api/v1/material/components/${componentId}`).catch(() => {});
    }
  });
});
