import { test, expect } from '../support/fixtures'
import { NAMESPACE, describePanel, openDrawer, openResource } from '../support/app'

// Every describe panel opens on a known fixture and shows data that can only
// come from that object in the cluster. Combined with the error guard, this
// also catches panels that crash or log errors for real-world objects.
const PANELS: { kind: string; namespace: string; name: string; texts: (string | RegExp)[]; yamlKind: string }[] = [
  { kind: 'deployments', namespace: NAMESPACE, name: 'web', texts: ['RollingUpdate', 'busybox:1.37'], yamlKind: 'Deployment' },
  { kind: 'services', namespace: NAMESPACE, name: 'web', texts: ['ClusterIP', 'http', '8080', 'TCP', /web-[a-z0-9]+-[a-z0-9]+/], yamlKind: 'Service' },
  { kind: 'statefulsets', namespace: NAMESPACE, name: 'db', texts: ['RollingUpdate', 'db-0'], yamlKind: 'StatefulSet' },
  { kind: 'daemonsets', namespace: NAMESPACE, name: 'agent', texts: ['RollingUpdate', /agent-[a-z0-9]+/], yamlKind: 'DaemonSet' },
  { kind: 'jobs', namespace: NAMESPACE, name: 'migrate', texts: ['Complete', /migrate-[a-z0-9]+/, 'Succeeded'], yamlKind: 'Job' },
  { kind: 'cronjobs', namespace: NAMESPACE, name: 'report', texts: ['0 3 1 1 *', 'Allow', 'busybox:1.37'], yamlKind: 'CronJob' },
  { kind: 'ingresses', namespace: NAMESPACE, name: 'web', texts: ['web.e2e.local', /web:80/], yamlKind: 'Ingress' },
  { kind: 'configmaps', namespace: NAMESPACE, name: 'app-config', texts: ['LOG_LEVEL', 'search,export', /web-[a-z0-9]+-[a-z0-9]+/], yamlKind: 'ConfigMap' },
  { kind: 'persistentvolumeclaims', namespace: NAMESPACE, name: 'data-db-0', texts: ['Bound', '1Gi', 'standard', 'ReadWriteOnce', /pvc-[0-9a-f-]+/, 'db-0'], yamlKind: 'PersistentVolumeClaim' },
  { kind: 'horizontalpodautoscalers', namespace: NAMESPACE, name: 'web', texts: ['Deployment', 'cpu'], yamlKind: 'HorizontalPodAutoscaler' },
  { kind: 'namespaces', namespace: '_', name: NAMESPACE, texts: ['Active', 'e2e-quota', 'e2e-limits'], yamlKind: 'Namespace' },
  { kind: 'resourcequotas', namespace: NAMESPACE, name: 'e2e-quota', texts: ['pods', '50', 'configmaps'], yamlKind: 'ResourceQuota' },
  { kind: 'limitranges', namespace: NAMESPACE, name: 'e2e-limits', texts: ['Container', '1Gi'], yamlKind: 'LimitRange' },
  { kind: 'networkpolicies', namespace: NAMESPACE, name: 'web-ingress', texts: ['Ingress', '8080', /web-[a-z0-9]+-[a-z0-9]+/], yamlKind: 'NetworkPolicy' },
  { kind: 'endpoints', namespace: NAMESPACE, name: 'web', texts: [/10\.244\.\d+\.\d+/], yamlKind: 'Endpoints' },
  { kind: 'poddisruptionbudgets', namespace: NAMESPACE, name: 'web', texts: [/web-[a-z0-9]+-[a-z0-9]+/], yamlKind: 'PodDisruptionBudget' },
  { kind: 'nodes', namespace: '_', name: 'k8s-manager-e2e-control-plane', texts: ['control-plane', 'Ready', /v1\.\d+\.\d+/, 'containerd'], yamlKind: 'Node' },
]

for (const { kind, namespace, name, texts, yamlKind } of PANELS) {
  test(`${kind} describe panel shows ${name}`, async ({ page }) => {
    await openResource(page, kind, namespace, name)

    const panel = describePanel(page)
    for (const text of texts) {
      await expect(panel.getByText(text).first()).toBeVisible()
    }

    await page.getByRole('button', { name: 'View YAML' }).click()
    const yaml = openDrawer(page).locator('pre')
    await expect(yaml).toContainText(`kind: ${yamlKind}`)
    await expect(yaml).toContainText(`name: ${name}`)
  })
}

test('persistentvolumes describe panel shows the claim bound to it', async ({ page }) => {
  await page.goto('/k8s-manager-e2e/persistentvolumes')
  await page.getByRole('row').filter({ hasText: 'Bound' }).filter({ hasText: '1Gi' }).first().click()

  const panel = describePanel(page)
  await expect(panel.getByText('data-db-0').first()).toBeVisible()
  await expect(panel.getByText('Delete').first()).toBeVisible()
})
