/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路由增加 layout 组件时使用
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置菜单的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn
 * @doc https://umijs.org/docs/guides/routes
 *
 * 权限点与后端权限码一一对应（apps/api PermissionSeeder 注册表）；
 * access 键名即权限码——前端隐藏入口仅为体验，后端最终鉴权。
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user/login',
        name: 'login',
        component: './user/login',
      },
      {
        path: '/user',
        redirect: '/user/login',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: '/welcome',
    name: 'welcome',
    icon: 'home',
    component: './Welcome',
  },
  {
    path: '/system',
    name: 'system',
    icon: 'setting',
    routes: [
      {
        path: '/system',
        redirect: '/system/user',
      },
      {
        name: 'user',
        icon: 'user',
        path: '/system/user',
        component: './system/user',
        access: 'system.user.view',
      },
      {
        name: 'role',
        icon: 'team',
        path: '/system/role',
        component: './system/role',
        access: 'system.role.view',
      },
      {
        name: 'permission',
        icon: 'safety',
        path: '/system/permission',
        component: './system/permission',
        access: 'system.permission.view',
      },
    ],
  },
  {
    // 物料管理（spec material-mgmt）：四域路由与权限一一对应
    path: '/material',
    name: 'material',
    icon: 'appstore',
    routes: [
      {
        path: '/material',
        redirect: '/material/product',
      },
      {
        name: 'product',
        icon: 'profile',
        path: '/material/product',
        component: './material/product',
        access: 'material.product.view',
      },
      {
        name: 'component',
        icon: 'tool',
        path: '/material/component',
        component: './material/component',
        access: 'material.component.view',
      },
      {
        name: 'stock',
        icon: 'database',
        path: '/material/stock',
        component: './material/stock',
        access: 'material.stock.view',
      },
      {
        name: 'production',
        icon: 'experiment',
        path: '/material/production',
        component: './material/production',
        access: 'material.production.view',
      },
    ],
  },
  {
    name: 'exception',
    icon: 'warning',
    path: '/exception',
    hideInMenu: true,
    routes: [
      {
        path: '/exception',
        redirect: '/exception/403',
      },
      {
        name: '403',
        icon: 'stop',
        path: '/exception/403',
        component: './exception/403',
      },
      {
        name: '404',
        icon: 'warning',
        path: '/exception/404',
        component: './exception/404',
      },
      {
        name: '500',
        icon: 'bug',
        path: '/exception/500',
        component: './exception/500',
      },
    ],
  },
  {
    path: '/',
    layout: false,
    redirect: '/welcome',
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
