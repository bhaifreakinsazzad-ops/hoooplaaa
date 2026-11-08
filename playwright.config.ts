import { defineConfig } from '@playwright/test';

const isWin = process.platform === 'win32';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3456',
    channel: process.env.CI ? undefined : isWin ? 'msedge' : undefined,
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: isWin ? 'npx.cmd next start -p 3456' : 'npx next start -p 3456',
    url: 'http://localhost:3456',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      SUPABASE_TEST_BRIDGE: 'true',
      PORT: '3456',
    },
  },
});
