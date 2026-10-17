import { test, expect } from '@playwright/test'
import { CONTEXT, NAMESPACE, openDrawer, openList, openResource, rowWithCell } from '../support/app'

test('clicking a deployment opens its describe panel', async ({ page }) => {
  await openList(page, 'deployments')
  await rowWithCell(page, 'web').click()

  await expect(page).toHaveURL(`/${CONTEXT}/deployments/${NAMESPACE}/web`)
  await expect(page.getByText('busybox:1.37').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'View logs' })).toBeVisible()
})

test('a deployment links to the service that selects its pods', async ({ page }) => {
  await openResource(page, 'deployments', NAMESPACE, 'web')

  await page.getByRole('button', { name: /^web\s+ClusterIP/ }).click()
  await expect(page).toHaveURL(`/${CONTEXT}/services/${NAMESPACE}/web`)
})

test('the YAML view shows the object as stored in the cluster', async ({ page }) => {
  await openResource(page, 'deployments', NAMESPACE, 'web')
  await page.getByRole('button', { name: 'View YAML' }).click()

  const yaml = openDrawer(page).locator('pre')
  await expect(yaml).toContainText('apiVersion: apps/v1')
  await expect(yaml).toContainText('kind: Deployment')
  await expect(yaml).toContainText('replicas: 2')
  await expect(yaml).toContainText('image: busybox:1.37')
})

test('a pod lists its containers', async ({ page }) => {
  await openList(page, 'pods')
  await page.getByPlaceholder('Filter by name').fill('web-')
  await page.getByRole('row').filter({ hasText: /web-/ }).first().click()

  await expect(page.getByText('Containers', { exact: true })).toBeVisible()
  await expect(page.getByText('app', { exact: true })).toBeVisible()
  await expect(page.getByText('sidecar', { exact: true })).toBeVisible()
})
