import { test as base, expect } from '@playwright/test'
import { coverageEnabled, coverageReport } from './coverage'

export { expect }

interface GuardOptions {
  // Errors a test expects on purpose (e.g. a context without permissions).
  // A single RegExp: Playwright reads array values in test.use() as [value, options].
  allowedErrors: RegExp | undefined
}

// Every test fails if the page logs a console error, throws an uncaught
// exception or gets a 4xx/5xx from /api, unless the error matches the test's
// `allowedErrors`. This catches broken views that would otherwise only
// show up as a missing element, or not at all.
export const test = base.extend<GuardOptions & { errorGuard: void; coverage: void }>({
  allowedErrors: [undefined, { option: true }],

  errorGuard: [
    async ({ page, allowedErrors }, use) => {
      const errors: string[] = []
      const isAllowed = (message: string) => !!allowedErrors?.test(message)
      const record = (message: string) => {
        if (!isAllowed(message)) errors.push(message)
      }

      page.on('console', (message) => {
        if (message.type() === 'error') record(`console error: ${message.text()}`)
      })
      page.on('pageerror', (error) => record(`uncaught exception: ${error.message}`))
      page.on('response', (response) => {
        const url = new URL(response.url())
        if (url.pathname.startsWith('/api/') && response.status() >= 400) {
          record(`HTTP ${response.status()} from ${url.pathname}${url.search}`)
        }
      })

      await use()

      expect(errors, 'unexpected errors in the browser').toEqual([])
    },
    { auto: true },
  ],

  coverage: [
    async ({ page }, use) => {
      if (!coverageEnabled) {
        await use()
        return
      }
      await page.coverage.startJSCoverage({ resetOnNavigation: false })
      await use()
      await coverageReport().add(await page.coverage.stopJSCoverage())
    },
    { auto: true },
  ],
})
