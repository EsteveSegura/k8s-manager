import { test, expect } from '../support/fixtures'
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

  // CPU as "123m (4%)" or "1.08 cores (27%)", memory as "747 MiB (13%)".
  const row = rowWithCell(page, 'k8s-manager-e2e-control-plane')
  await expect(row).toContainText(/\d+(\.\d+)?(m| cores?) \(\d+%\)/)
  await expect(row).toContainText(/\d+(\.\d+)? (Ki|Mi|Gi)B \(\d+%\)/)
})
