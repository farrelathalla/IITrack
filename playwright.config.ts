import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3111";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: process.env.CI
      ? "node .next/standalone/server.js"
      : "bun run dev --hostname 127.0.0.1 --port 3111",
    env: { HOSTNAME: "127.0.0.1", PORT: "3111" },
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
