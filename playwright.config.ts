import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    // All authenticated suites can capture passwords, cookies and private invitation URLs.
    trace: 'off',
    launchOptions: {
      args: [
        '--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessPermissionPrompt',
      ],
    },
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /auth\.spec\.ts|event-editor\.spec\.ts/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 360, height: 800 } },
    },
    {
      name: 'desktop',
      testIgnore: /auth\.spec\.ts|event-editor\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'editor',
      testMatch: /event-editor\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1050 }, trace: 'off' },
    },
    {
      name: 'editor-mobile',
      testMatch: /event-editor\.spec\.ts/,
      use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, trace: 'off' },
    },
    {
      name: 'auth',
      testMatch: /auth\.spec\.ts/,
      // Auth traces capture passwords, session cookies and refresh tokens.
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 }, trace: 'off' },
    },
  ],
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      EMAIL_TRANSPORT: 'stub',
      SUPABASE_TARGET: 'test',
      SITE_URL: 'https://invitation-test.example',
      BREVO_API_KEY: 'stub-not-a-real-key',
      BREVO_SENDER_EMAIL: 'sender@invitation-test.example',
      BREVO_SENDER_NAME: 'Thu moi test',
    },
  },
});
