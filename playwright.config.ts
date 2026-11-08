import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3456',
    channel: 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npx.cmd next start -p 3456',
    url: 'http://localhost:3456',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
