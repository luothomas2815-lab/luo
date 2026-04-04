import { defineConfig, devices } from "@playwright/test";

const port = 3101;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: `${baseURL}/app/coach`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      E2E_COACH_FIXTURE: "1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
