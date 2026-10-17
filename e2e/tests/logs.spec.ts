import { test, expect } from '../support/fixtures'
import { NAMESPACE, logLines, openDrawer, openList, openResource, waitForDescribePanel } from '../support/app'

// Each web pod's "app" container prints "app line 1".."app line 500" and its
// "sidecar" container "sidecar line 1".."sidecar line 50" (manifests/10-workloads.yaml).

test('pod logs show the last 200 lines of the first container', async ({ page }) => {
  await openList(page, 'pods')
  await page.getByPlaceholder('Filter by name').fill('web-')
  const podName = (await page.getByRole('row').filter({ hasText: /web-/ }).first().getByRole('cell').nth(1).innerText()).trim()
  await openResource(page, 'pods', NAMESPACE, podName)

  await page.getByRole('button', { name: 'View logs' }).click()
  const drawer = openDrawer(page)
  await expect(drawer).toContainText(`Logs for ${podName}`)

  const lines = await logLines(drawer)
  expect(lines).toHaveLength(200)
  expect(lines[0]).toBe('app line 301')
  expect(lines.at(-1)).toBe('app line 500')
})

test('pod logs can switch to another container', async ({ page }) => {
  await openList(page, 'pods')
  await page.getByPlaceholder('Filter by name').fill('web-')
  await page.getByRole('row').filter({ hasText: /web-/ }).first().click()
  await waitForDescribePanel(page)
  await page.getByRole('button', { name: 'View logs' }).click()

  const drawer = openDrawer(page)
  await expect(drawer.locator('pre')).toContainText('app line 500')

  await drawer.getByRole('combobox').click()
  await page.getByRole('option', { name: 'sidecar' }).click()

  await expect(drawer.locator('pre')).toContainText('sidecar line 50')
  const lines = await logLines(drawer)
  expect(lines).toHaveLength(50)
  expect(lines[0]).toBe('sidecar line 1')
})

test('service logs merge the logs of every pod behind it', async ({ page }) => {
  await openResource(page, 'services', NAMESPACE, 'web')
  await page.getByRole('button', { name: 'View logs' }).click()

  const drawer = openDrawer(page)
  await expect(drawer).toContainText('Service web · 2 pods')

  const lines = await logLines(drawer)
  // Last 200 lines from each of the two replicas, prefixed with "<time> [<pod>]".
  expect(lines).toHaveLength(400)
  const pods = new Set(lines.map((line) => line.match(/\[(web-[^\]]+)\]/)?.[1]))
  expect(pods.size).toBe(2)
  expect(lines.filter((line) => line.endsWith('] app line 500'))).toHaveLength(2)
  expect(lines.some((line) => line.endsWith('] app line 300'))).toBe(false)
})

test('log search highlights matches', async ({ page }) => {
  await openResource(page, 'services', NAMESPACE, 'web')
  await page.getByRole('button', { name: 'View logs' }).click()

  const drawer = openDrawer(page)
  await expect(drawer.locator('pre')).toContainText('app line 500')
  await drawer.getByPlaceholder('Search the logs').fill('app line 450')

  await expect(drawer.locator('mark')).toHaveCount(2)
  await expect(drawer.getByText('1/2', { exact: true })).toBeVisible()
})
