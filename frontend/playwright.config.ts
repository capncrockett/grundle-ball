import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Load env (repo root preferred), then allow local override inside frontend/.env if present
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const baseURL = process.env.E2E_BASE_URL ?? 'https://grundle-ball-staging.vercel.app';
const isLocalRun = /^http:\/\/(localhost|127\.0\.0\.1):5173\/?$/.test(baseURL);
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  webServer: isLocalRun
    ? {
        command: 'npm run dev -- --host 127.0.0.1',
        cwd: frontendRoot,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  fullyParallel: true,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'x-vercel-set-bypass-cookie': 'true',
        }
      : undefined,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone-12',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
