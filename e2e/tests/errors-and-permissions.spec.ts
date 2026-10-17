import { test, expect } from '../support/fixtures'
import { CONTEXT, NAMESPACE, openList, rowWithCell } from '../support/app'

// Contexts written by scripts/cluster-up.sh next to the main one.
const LIMITED = `${CONTEXT}-limited`
const INVALID_TOKEN = `${CONTEXT}-invalid-token`
const UNREACHABLE = `${CONTEXT}-unreachable`

// Endpoints that fail as a whole (metrics, CRDs, Helm, events) answer 502,
// and the browser logs every failed request as a console error.
const EXPECTED_API_FAILURES = /HTTP 502 from \/api\/|Failed to load resource: the server responded with a status of 502/

test('every kubeconfig context is listed', async ({ page }) => {
  await page.goto('/')
  for (const context of [CONTEXT, LIMITED, INVALID_TOKEN, UNREACHABLE]) {
    await expect(page.getByText(context, { exact: true })).toBeVisible()
  }
})

test.describe('with partial permissions', () => {
  test.use({ allowedErrors: EXPECTED_API_FAILURES })

  test('the dashboard lists the kinds that could not be loaded and why', async ({ page }) => {
    await page.goto(`/${LIMITED}/dashboard`)

    const alert = page.getByRole('alert').filter({ hasText: 'Some resources failed to load' })
    await expect(alert).toContainText('secrets')
    await expect(alert).toContainText('nodes')
    await expect(alert).toContainText('forbidden')
    // Kinds the identity can read are not reported.
    await expect(alert).not.toContainText('deployments')
  })

  test('allowed kinds still load', async ({ page }) => {
    await page.goto(`/${LIMITED}/deployments`)
    await expect(page.getByRole('table')).toBeVisible()
    await expect(rowWithCell(page, 'web').filter({ hasText: NAMESPACE })).toContainText('2/2')
  })

  test('a forbidden kind shows a permission error instead of an empty list', async ({ page }) => {
    await page.goto(`/${LIMITED}/secrets`)
    await expect(page.getByText('No permission to view this resource')).toBeVisible()
    await expect(page.getByText('secrets is forbidden')).toBeVisible()
  })

  test('a failed alert can be dismissed', async ({ page }) => {
    await page.goto(`/${LIMITED}/dashboard`)
    const alert = page.getByRole('alert').filter({ hasText: 'Some resources failed to load' })
    await expect(alert).toBeVisible()

    await alert.getByRole('button').click()
    await expect(alert).toHaveCount(0)
  })
})

test.describe('with a token the cluster rejects', () => {
  test.use({ allowedErrors: EXPECTED_API_FAILURES })

  test('the dashboard reports the authentication failure', async ({ page }) => {
    await page.goto(`/${INVALID_TOKEN}/dashboard`)

    const alert = page.getByRole('alert').filter({ hasText: 'Some resources failed to load' })
    await expect(alert).toContainText('Unauthorized')
    await expect(alert).toContainText('deployments')
  })

  test('lists explain that the resources could not be read', async ({ page }) => {
    await page.goto(`/${INVALID_TOKEN}/pods`)
    await expect(page.getByText('No permission to view this resource')).toBeVisible()
    await expect(page.getByText(/Unauthorized/).first()).toBeVisible()
  })
})

test.describe('with an API server that does not answer', () => {
  test.use({ allowedErrors: EXPECTED_API_FAILURES })

  test('the dashboard reports the connection failure', async ({ page }) => {
    await page.goto(`/${UNREACHABLE}/dashboard`)

    const alert = page.getByRole('alert').filter({ hasText: 'Some resources failed to load' })
    await expect(alert).toContainText('fetch failed')
  })

  test('other views show their error state', async ({ page }) => {
    await page.goto(`/${UNREACHABLE}/helm`)
    await expect(page.getByText('Failed to load releases')).toBeVisible()

    await page.goto(`/${UNREACHABLE}/crds`)
    await expect(page.getByText('Failed to load CRDs')).toBeVisible()

    await page.goto(`/${UNREACHABLE}/events`)
    await expect(page.getByText('Failed to load events')).toBeVisible()
  })
})

test('switching back to a healthy context loads its data', async ({ page }) => {
  test.info().annotations.push({ type: 'note', description: 'guards against state leaking between contexts' })
  await openList(page, 'deployments')
  await expect(rowWithCell(page, 'web')).toBeVisible()

  await page.getByRole('button', { name: 'Change cluster' }).click()
  await expect(page).toHaveURL('/')
  await page.getByText(CONTEXT, { exact: true }).click()
  await expect(page).toHaveURL(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Some resources failed to load')).toHaveCount(0)
})
