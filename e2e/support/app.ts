import { expect, type Locator, type Page } from '@playwright/test'

// Context name written by scripts/cluster-up.sh into .kube/config.
export const CONTEXT = 'k8s-manager-e2e'
export const NAMESPACE = 'e2e'

// The first load lists every resource kind in the cluster, which can take a
// while on a busy machine; later navigation reuses it.
export const FIRST_LOAD = { timeout: 30_000 }

export async function openList(page: Page, kind: string) {
  await page.goto(`/${CONTEXT}/${kind}`)
  await expect(page.getByRole('table')).toBeVisible(FIRST_LOAD)
}

export async function openResource(page: Page, kind: string, namespace: string, name: string) {
  await page.goto(`/${CONTEXT}/${kind}/${namespace}/${name}`)
  await waitForDescribePanel(page)
}

// The describe panel header (and its "View logs" button) shows up as soon as
// the URL selects a resource, but the panel body, which actually opens the
// logs, only mounts once the resources are loaded.
export async function waitForDescribePanel(page: Page) {
  await expect(page.getByRole('button', { name: 'View YAML' })).toBeVisible(FIRST_LOAD)
}

// The right-hand panel with the selected resource's details (not the list).
export function describePanel(page: Page) {
  return page.locator('[data-slot="resizable-panel"]').filter({ has: page.getByRole('button', { name: 'View YAML' }) })
}

// A table row whose cells include one with exactly this text.
export function rowWithCell(page: Page | Locator, text: string) {
  return page.getByRole('row').filter({ has: page.getByRole('cell', { name: text, exact: true }) })
}

// A row of the dashboard's "Issues detected" table: its kind badge and a
// resource name (or part of it).
export function issueRow(page: Page, kind: string, resource: string | RegExp) {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: kind, exact: true }) })
    .filter({ hasText: resource })
}

// The vaul drawer currently open (logs, YAML...).
export function openDrawer(page: Page) {
  return page.getByRole('dialog')
}

// Log viewers render the log text inside a single <pre>.
export async function logLines(drawer: Locator) {
  const pre = drawer.locator('pre')
  await expect(pre).toBeVisible()
  return (await pre.innerText()).split('\n').filter((line) => line.length > 0)
}
