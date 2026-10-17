import { test, expect } from '@playwright/test'
import { CONTEXT, NAMESPACE, rowWithCell } from '../support/app'

test('lists the kubeconfig context and opens its dashboard', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(`kind-${CONTEXT}`)).toBeVisible()
  await page.getByText(CONTEXT, { exact: true }).click()

  await expect(page).toHaveURL(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()
})

test('dashboard reports the broken deployment and its pod', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)

  const deploymentIssue = rowWithCell(page, `${NAMESPACE}/broken`).filter({ hasText: 'Deployment' })
  await expect(deploymentIssue).toContainText('0/1 replicas ready')

  const podIssue = page.getByRole('row').filter({ hasText: 'Pod' }).filter({ hasText: /broken-/ })
  await expect(podIssue).toContainText('Pending')

  // Healthy fixtures must not be reported.
  await expect(rowWithCell(page, `${NAMESPACE}/web`)).toHaveCount(0)
})

test('the read-only identity can list every resource kind', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()
  await expect(page.getByText('Some resources failed to load')).toHaveCount(0)
})
