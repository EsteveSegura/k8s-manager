import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const PORT = 47900
const KUBECONFIG = path.join(__dirname, '.kube', 'config')

export default defineConfig({
  testDir: './tests',
  // All tests share one cluster and only read from it, so they can run in parallel.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // The UI picks its language from the browser; assertions use the English strings.
    locale: 'en-US',
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } } }],
  webServer: {
    // Same production setup as `npm start`: the built UI served by the real server.
    command: 'npm run build --prefix ../web && node ../server/src/index.js',
    url: `http://127.0.0.1:${PORT}/api/contexts`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    env: {
      K8S_MANAGER_PORT: String(PORT),
      KUBECONFIG,
    },
  },
})
