import { test, expect } from '../support/fixtures'
import fs from 'node:fs'
import { CONTEXT, NAMESPACE, describePanel, openDrawer, openList, openResource, rowWithCell } from '../support/app'

test.describe('settings', () => {
  test('the language can be switched to Spanish and is remembered', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('dialog').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Español' }).click()
    await page.keyboard.press('Escape')

    await expect(page.getByText('Selecciona un contexto de kubeconfig para explorar el clúster.')).toBeVisible()

    await page.goto(`/${CONTEXT}/dashboard`)
    await expect(page.getByText('Problemas detectados')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Issues detected')).toHaveCount(0)
  })

  test('dark mode can be turned off and stays off after a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('switch', { name: 'Dark mode' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('the refresh interval is kept within its limits', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings' }).click()
    const interval = page.getByRole('spinbutton', { name: 'Refresh interval' })

    await interval.fill('1')
    await interval.press('Enter')
    await expect(interval).toHaveValue('5')

    await interval.fill('99999')
    await interval.press('Enter')
    await expect(interval).toHaveValue('600')

    await interval.fill('42')
    await interval.press('Enter')
    await page.reload()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('spinbutton', { name: 'Refresh interval' })).toHaveValue('42')
  })

  test('turning auto-refresh off disables the interval and hides the indicator', async ({ page }) => {
    await openList(page, 'deployments')
    await expect(page.getByText('Auto-refresh active').first()).toBeVisible()

    await page.keyboard.press('ControlOrMeta+k')
    await page.getByRole('dialog').getByRole('option', { name: /Settings/ }).click()
    await page.getByRole('switch', { name: 'Auto-refresh' }).click()
    await expect(page.getByRole('spinbutton', { name: 'Refresh interval' })).toBeDisabled()
    await page.keyboard.press('Escape')

    await expect(page.getByText('Auto-refresh active')).toHaveCount(0)
  })
})

test.describe('lists', () => {
  test('the namespace filter hides other namespaces', async ({ page }) => {
    await openList(page, 'deployments')
    await expect(rowWithCell(page, 'coredns')).toBeVisible()

    await page.getByRole('button', { name: 'All namespaces' }).click()
    // Clearing "All namespaces" and ticking only e2e.
    await page.getByRole('menu').getByText('All namespaces').click()
    await page.getByRole('menu').getByText(NAMESPACE, { exact: true }).click()
    await page.keyboard.press('Escape')

    await expect(rowWithCell(page, 'web')).toBeVisible()
    await expect(rowWithCell(page, 'coredns')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^1\/\d+ namespaces$/ })).toBeVisible()
  })

  test('columns sort ascending and descending', async ({ page }) => {
    await openList(page, 'deployments')
    const names = async () => page.getByRole('row').locator('td:nth-child(2)').allInnerTexts()

    await page.getByRole('columnheader', { name: 'Name', exact: true }).click()
    const ascending = await names()
    expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })))

    await page.getByRole('columnheader', { name: 'Name', exact: true }).click()
    expect(await names()).toEqual([...ascending].reverse())
  })

  test('a kind pinned to the sidebar stays pinned after a reload', async ({ page }) => {
    await page.goto(`/${CONTEXT}/dashboard`)
    const sidebar = page.locator('[data-sidebar="sidebar"]')
    const configMapLinks = sidebar.getByRole('button', { name: 'ConfigMaps', exact: true })
    await expect(configMapLinks).toHaveCount(1)

    // The pin action only shows on hover, but it is always in the DOM.
    const configMapItem = sidebar.locator('li').filter({ has: page.getByRole('button', { name: 'ConfigMaps', exact: true }) })
    await configMapItem.hover()
    await configMapItem.getByRole('button', { name: 'Pin to Main' }).click()
    await expect(configMapLinks).toHaveCount(2)

    await page.reload()
    await expect(configMapLinks).toHaveCount(2)
    await configMapLinks.first().click()
    await expect(page).toHaveURL(`/${CONTEXT}/configmaps`)
  })
})

test.describe('downloads', () => {
  test('pod logs download exactly what is shown', async ({ page }) => {
    await openList(page, 'pods')
    await page.getByPlaceholder('Filter by name').fill('web-')
    const podName = (await page.getByRole('row').filter({ hasText: /web-/ }).first().locator('td').nth(1).innerText()).trim()
    await openResource(page, 'pods', NAMESPACE, podName)
    await page.getByRole('button', { name: 'View logs' }).click()
    const drawer = openDrawer(page)
    await expect(drawer.locator('pre')).toContainText('app line 500')

    const downloadPromise = page.waitForEvent('download')
    await drawer.getByRole('button', { name: 'Download' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe(`${NAMESPACE}-${podName}-app.log`)
    const lines = fs.readFileSync(await download.path(), 'utf8').split('\n').filter(Boolean)
    expect(lines).toHaveLength(200)
    expect(lines.at(-1)).toBe('app line 500')
  })

  test('the YAML view downloads the object', async ({ page }) => {
    await openResource(page, 'configmaps', NAMESPACE, 'app-config')
    await describePanel(page).getByRole('button', { name: 'View YAML' }).click()

    const downloadPromise = page.waitForEvent('download')
    await openDrawer(page).getByRole('button', { name: 'Download' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('app-config.yaml')
    const yaml = fs.readFileSync(await download.path(), 'utf8')
    expect(yaml).toContain('kind: ConfigMap')
    expect(yaml).toContain('LOG_LEVEL: info')
  })
})

test('a helm release lists the resources it installed and links to them', async ({ page }) => {
  // Known bug: the chart's ConfigMap has no metadata.namespace (Helm applies it
  // with -n), so the app can't match the release resource to the cluster object
  // and renders it as plain text instead of a link. Remove once fixed.
  test.fail()
  await page.goto(`/${CONTEXT}/helm`)
  await rowWithCell(page, 'e2e-release').click()

  const resource = page.getByRole('button', { name: /e2e-release-settings\s*ConfigMap/ })
  await expect(resource).toBeVisible()
  await resource.click()
  await expect(page).toHaveURL(`/${CONTEXT}/configmaps/${NAMESPACE}/e2e-release-settings`)
  await expect(describePanel(page).getByText('hello from helm')).toBeVisible()
})
