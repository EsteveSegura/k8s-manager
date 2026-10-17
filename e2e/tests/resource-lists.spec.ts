import { test, expect } from '../support/fixtures'
import { NAMESPACE, openList, rowWithCell } from '../support/app'

// One known fixture per list view (see manifests/10-workloads.yaml), with
// values from its columns that come straight from the cluster (a value may
// appear in more than one column).
const LISTS: { kind: string; name: string; cells: string[] }[] = [
  { kind: 'deployments', name: 'web', cells: ['2/2'] },
  { kind: 'statefulsets', name: 'db', cells: ['1/1'] },
  { kind: 'daemonsets', name: 'agent', cells: ['1/1'] },
  { kind: 'jobs', name: 'migrate', cells: ['1/1', 'Complete'] },
  { kind: 'cronjobs', name: 'report', cells: ['0 3 1 1 *', 'Active'] },
  { kind: 'services', name: 'web', cells: ['2/2', 'ClusterIP', '80'] },
  { kind: 'ingresses', name: 'web', cells: ['web.e2e.local'] },
  { kind: 'configmaps', name: 'app-config', cells: ['2'] },
  { kind: 'secrets', name: 'app-secret', cells: ['Opaque', '2'] },
  { kind: 'persistentvolumeclaims', name: 'data-db-0', cells: ['Bound', '1Gi', 'standard'] },
  { kind: 'horizontalpodautoscalers', name: 'web', cells: ['Deployment/web', '2'] },
  { kind: 'resourcequotas', name: 'e2e-quota', cells: ['2'] },
  { kind: 'limitranges', name: 'e2e-limits', cells: ['1'] },
  { kind: 'networkpolicies', name: 'web-ingress', cells: ['Ingress', '2'] },
  { kind: 'endpoints', name: 'web', cells: ['2', '0'] },
  { kind: 'poddisruptionbudgets', name: 'web', cells: ['1', '2/2'] },
]

for (const { kind, name, cells } of LISTS) {
  test(`${kind} list shows ${NAMESPACE}/${name}`, async ({ page }) => {
    await openList(page, kind)
    await page.getByPlaceholder('Filter by name').fill(name)

    const row = rowWithCell(page, name).filter({ has: page.getByRole('cell', { name: NAMESPACE, exact: true }) })
    await expect(row).toHaveCount(1)
    for (const cell of cells) {
      await expect(row.getByRole('cell', { name: cell, exact: true }).first()).toBeVisible()
    }
  })
}

test('pods list shows both web replicas running and the broken pod pending', async ({ page }) => {
  await openList(page, 'pods')
  await page.getByPlaceholder('Filter by name').fill('web-')
  await expect(page.getByRole('row').filter({ hasText: /web-/ }).filter({ hasText: 'Running' })).toHaveCount(2)

  await page.getByPlaceholder('Filter by name').fill('broken-')
  await expect(page.getByRole('row').filter({ hasText: /broken-/ })).toContainText('Pending')
})

test('cluster-scoped lists show the node, the namespace and the bound volume', async ({ page }) => {
  await openList(page, 'nodes')
  await expect(rowWithCell(page, 'k8s-manager-e2e-control-plane')).toContainText('Ready')

  await openList(page, 'namespaces')
  await expect(rowWithCell(page, NAMESPACE)).toContainText('Active')

  await openList(page, 'persistentvolumes')
  await expect(page.getByRole('row').filter({ hasText: 'Bound' }).filter({ hasText: '1Gi' }).first()).toBeVisible()
})

test('the name filter narrows the list', async ({ page }) => {
  await openList(page, 'deployments')
  await expect(rowWithCell(page, 'web')).toBeVisible()
  await expect(rowWithCell(page, 'broken')).toBeVisible()

  await page.getByPlaceholder('Filter by name').fill('brok')
  await expect(rowWithCell(page, 'broken')).toBeVisible()
  await expect(rowWithCell(page, 'web')).toHaveCount(0)
})
