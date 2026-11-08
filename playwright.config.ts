import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm.cmd run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
