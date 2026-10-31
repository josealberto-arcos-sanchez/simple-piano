import { defineConfig } from '@playwright/test';

const PORT = 8080;

export default defineConfig({
  testDir: './tests',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://127.0.0.1:${PORT}/test.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
