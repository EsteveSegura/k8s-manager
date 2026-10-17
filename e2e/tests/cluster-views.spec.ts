import { test, expect } from '@playwright/test'
import { CONTEXT, NAMESPACE, openList, rowWithCell } from '../support/app'

test('helm releases are read from the cluster', async ({ page }) => {
  await page.goto(`/${CONTEXT}/helm`)

  const row = rowWithCell(page, 'e2e-release')
  await expect(row).toContainText(NAMESPACE)
  await expect(row).toContainText('e2e-chart-1.2.3')
  await expect(row).toContainText('4.5.6')
})

test('custom resource definitions list their instances', async ({ page }) => {
  await page.goto(`/${CONTEXT}/crds`)

  await rowWithCell(page, 'Widget').click()
  await expect(page.getByText('e2e.k8s-manager.dev/v1')).toBeVisible()
  await expect(page.getByRole('button', { name: /sample-widget/ })).toBeVisible()
})

test('events include the image pull failure of the broken pod', async ({ page }) => {
  await page.goto(`/${CONTEXT}/events`)
  await page.getByPlaceholder('Filter by object, reason or message').fill('broken')

  await expect(page.getByRole('row').filter({ hasText: /broken-/ }).filter({ hasText: /Failed|BackOff/ }).first()).toBeVisible()
})

test('node usage comes from metrics-server', async ({ page }) => {
  await openList(page, 'nodes')

  // e.g. "123m (4%)" and "812Mi (10%)"
  await expect(rowWithCell(page, 'k8s-manager-e2e-control-plane')).toContainText(/\d+(\.\d+)?m? \(\d+%\)/)
})
