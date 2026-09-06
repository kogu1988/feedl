import { defineConfig, devices } from "@playwright/test";

// Sprint 63w (B3) — Playwright E2E smoke. Yerelde `npm run build && npm run start`
// ya da `npm run dev` gerektirir; `webServer` otomatik başlatır (production build).
// Tarayıcıları bir kez kur: `npx playwright install chromium`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
