import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Start the real backend (fresh in-memory DB) and the real frontend dev
  // server, then run the scenarios against them.
  webServer: [
    {
      command: 'npm start',
      cwd: '../server',
      env: { DB_PATH: ':memory:' },
      url: 'http://localhost:3000/api/owner',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      cwd: '../client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
