/**
 * @name 权限定义
 * @description 权限码与后端注册表一一对应（apps/api PermissionSeeder），
 * 路由/菜单 access 键名即权限码。前端隐藏入口仅为体验，后端最终鉴权。
 * @see https://umijs.org/docs/max/access
 * */
export default function access(
  initialState: { currentUser?: API.CurrentUserResource } | undefined,
) {
  const { currentUser } = initialState ?? {};
  const permissions = new Set(currentUser?.permissions ?? []);

  return {
    'system.user.view': permissions.has('system.user.view'),
    'system.user.manage': permissions.has('system.user.manage'),
    'system.role.view': permissions.has('system.role.view'),
    'system.role.manage': permissions.has('system.role.manage'),
    'system.permission.view': permissions.has('system.permission.view'),
    // 物料管理四域（spec material-mgmt，与 PermissionSeeder 一一对应）
    'material.product.view': permissions.has('material.product.view'),
    'material.product.manage': permissions.has('material.product.manage'),
    'material.component.view': permissions.has('material.component.view'),
    'material.component.manage': permissions.has('material.component.manage'),
    'material.stock.view': permissions.has('material.stock.view'),
    'material.stock.manage': permissions.has('material.stock.manage'),
    'material.production.view': permissions.has('material.production.view'),
    'material.production.manage': permissions.has('material.production.manage'),
  };
}
