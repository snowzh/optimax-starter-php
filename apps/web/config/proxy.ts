/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  // 本地开发：/api/** → apps/api Laravel（php artisan serve 或 Sail）
  dev: {
    '/api/': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  },
  // E2E / 联调测试环境：/api/** → 本地全栈 compose 的入口 nginx（见根 compose.yaml）
  test: {
    '/api/': {
      target: 'http://127.0.0.1:8080',
      changeOrigin: true,
    },
  },
};
