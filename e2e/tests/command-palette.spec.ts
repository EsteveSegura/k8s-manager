import { test, expect } from '@playwright/test'
import { CONTEXT, NAMESPACE } from '../support/app'

test('the command palette jumps to a resource by name', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await palette.getByPlaceholder('Search deployments, services or pods').fill('app-config')
  await palette.getByRole('option', { name: `${NAMESPACE}/app-config` }).click()

  await expect(page).toHaveURL(`/${CONTEXT}/configmaps/${NAMESPACE}/app-config`)
  await expect(page.getByText('LOG_LEVEL').first()).toBeVisible()
})

test('the command palette opens app pages', async ({ page }) => {
  await page.goto(`/${CONTEXT}/dashboard`)
  await expect(page.getByText('Issues detected')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('dialog').getByRole('option', { name: /Helm/ }).click()

  await expect(page).toHaveURL(`/${CONTEXT}/helm`)
})
