const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8080',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx http-server -p 8080',
    url: 'http://localhost:8080',
    timeout: 10000,
    reuseExistingServer: !process.env.CI,
  },
});
