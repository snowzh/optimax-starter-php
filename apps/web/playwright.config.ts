import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-out/test-results',
  reporter: [['html', { outputFolder: 'e2e-out/playwright-report' }]],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 长链路用例（多轮登录/登出 + 抽屉/矩阵交互）远超默认 30s，统一放宽到 90s
  timeout: 90_000,
  use: {
    // 全栈 compose 入口（根 compose.yaml：nginx 8080 分流 web/api）
    // 运行前需先 docker compose up -d（CI 由 e2e job 拉起）
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
