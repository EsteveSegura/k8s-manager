import { test, expect } from '../support/fixtures'
import { CONTEXT, NAMESPACE, issueRow } from '../support/app'

test('lists the kubeconfig context and opens its dashboard', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(`kind-${CONTEXT}`).first()).toBeVisible()
  await page.getByText(CONTEXT, { exact: true }).click()

  await expect(page).toHaveURL(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()
})

test('dashboard reports the broken deployment and its pod', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)

  await expect(issueRow(page, 'Deployment', `${NAMESPACE}/broken`)).toContainText('0/1 replicas ready')
  await expect(issueRow(page, 'Pod', `${NAMESPACE}/broken-`)).toContainText('Pending')

  // Healthy fixtures must not be reported.
  await expect(page.getByRole('row').filter({ hasText: `${NAMESPACE}/web` })).toHaveCount(0)
})

test('the read-only identity can list every resource kind', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()
  await expect(page.getByText('Some resources failed to load')).toHaveCount(0)
})
