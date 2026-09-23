import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, FAKE_SUPABASE_URL } from "./e2e/constants";

/**
 * Browser tests for resuming the wizard after a reload.
 *
 * The app runs for real (next dev) against a fake Supabase started in global
 * setup, with DRAFT_RESUME=on and the Meta Pixel switched off. Run with
 * `npm run test:e2e`. PLAYWRIGHT_CHROMIUM_EXECUTABLE points at a local
 * Chromium where Playwright's own download is not available.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${APP_PORT}`,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/copy-ocr-assets.mjs && npx next dev --port ${APP_PORT}`,
    // 400 (no slot named) once the route is compiled and the flag is on.
    url: `http://localhost:${APP_PORT}/api/drafts/image`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NEXT_PUBLIC_META_PIXEL_ID: "",
      DRAFT_RESUME: "on",
      ANTHROPIC_API_KEY: "",
      TELEGRAM_BOT_TOKEN: "",
      WEB_PUSH_PUBLIC_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
