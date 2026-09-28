import { defineConfig } from '@playwright/test';
const port = Number(process.env.CLASSICALLIMIT_PORT || 5178);
export default defineConfig({
  testDir: './tests', testMatch: '**/*browser.spec.js', workers: 1, timeout: 120000,
  use: {
    baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath: process.env.CLASSICALLIMIT_BROWSER || undefined, args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
    screenshot: 'only-on-failure',
  },
  webServer: { command: `node server.mjs --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: true },
});
