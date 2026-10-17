import { test, expect } from '@playwright/test'
import { CONTEXT, NAMESPACE, openDrawer, openResource } from '../support/app'

// Values stored in the app-secret fixture, in plain text and base64.
const SECRET_VALUES = ['e2e-super-secret-value', 'e2e-super-secret-token']
const FORBIDDEN = [...SECRET_VALUES, ...SECRET_VALUES.map((value) => Buffer.from(value).toString('base64'))]

test('the API never returns secret values', async ({ request }) => {
  const response = await request.get(`/api/${CONTEXT}/resources`)
  expect(response.ok()).toBeTruthy()
  const body = await response.text()

  expect(body).toContain('app-secret')
  for (const value of FORBIDDEN) expect(body).not.toContain(value)
})

test('a secret shows its keys but not its values, also in the YAML view', async ({ page }) => {
  await openResource(page, 'secrets', NAMESPACE, 'app-secret')

  await expect(page.getByText('password', { exact: true })).toBeVisible()
  await expect(page.getByText('api-token', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'View YAML' }).click()
  const yaml = openDrawer(page).locator('pre')
  await expect(yaml).toContainText('kind: Secret')

  const content = await page.content()
  for (const value of FORBIDDEN) expect(content).not.toContain(value)
})
