import { test, expect } from '../support/fixtures'
import { CONTEXT, issueRow, logLines, openDrawer, rowWithCell, waitForDescribePanel } from '../support/app'
import { LIVE_NAMESPACE, applyManifest, deleteInLiveNamespace, kubectl, uniqueName, useFastAutoRefresh } from '../support/kubectl'

// These tests change the cluster while the app is open and expect the UI to
// catch up through auto-refresh alone (every 5 s), without reloading the page.
test.describe.configure({ timeout: 120_000 })
const LIVE_TIMEOUT = { timeout: 60_000 }

function deployment(name: string, replicas: number, script: string) {
  return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${LIVE_NAMESPACE}
spec:
  replicas: ${replicas}
  selector:
    matchLabels: { app: ${name} }
  template:
    metadata:
      labels: { app: ${name} }
    spec:
      terminationGracePeriodSeconds: 0
      containers:
        - name: main
          image: busybox:1.37
          command: [sh, -c, '${script}']
`
}

test.beforeEach(async ({ page }) => {
  await useFastAutoRefresh(page)
})

test('a deployment that appears, scales and disappears is followed by the list', async ({ page }) => {
  const name = uniqueName('live')
  try {
    await page.goto(`/${CONTEXT}/deployments`)
    await page.getByPlaceholder('Filter by name').fill(name)
    await expect(page.getByText('No results')).toBeVisible()

    applyManifest(deployment(name, 1, 'exec sleep 3600'))
    await expect(rowWithCell(page, name)).toContainText('1/1', LIVE_TIMEOUT)

    kubectl('-n', LIVE_NAMESPACE, 'scale', 'deployment', name, '--replicas=2')
    await expect(rowWithCell(page, name)).toContainText('2/2', LIVE_TIMEOUT)

    kubectl('-n', LIVE_NAMESPACE, 'delete', 'deployment', name, '--wait=false')
    await expect(rowWithCell(page, name)).toHaveCount(0, LIVE_TIMEOUT)
  } finally {
    deleteInLiveNamespace('deployment', name)
  }
})

test('a crash-looping deployment shows up on the dashboard', async ({ page }) => {
  const name = uniqueName('crash')
  try {
    await page.goto(`/${CONTEXT}/dashboard`)
    await expect(page.getByText('Issues detected')).toBeVisible()

    applyManifest(deployment(name, 1, 'echo boom; exit 1'))

    const deploymentIssue = issueRow(page, 'Deployment', `${LIVE_NAMESPACE}/${name}`)
    await expect(deploymentIssue).toContainText('0/1 replicas ready', LIVE_TIMEOUT)
    const podIssue = issueRow(page, 'Pod', `${LIVE_NAMESPACE}/${name}-`)
    await expect(podIssue).toContainText(/CrashLoopBackOff|NotReady|Error/, LIVE_TIMEOUT)

    // The pod's describe panel counts the restarts.
    await podIssue.click()
    await waitForDescribePanel(page)
    await expect(page.getByText(/Restarts: [1-9]/)).toBeVisible(LIVE_TIMEOUT)
  } finally {
    deleteInLiveNamespace('deployment', name)
  }
})

test('a failed job is reported on the dashboard', async ({ page }) => {
  const name = uniqueName('failing-job')
  try {
    await page.goto(`/${CONTEXT}/dashboard`)
    await expect(page.getByText('Issues detected')).toBeVisible()

    applyManifest(`
apiVersion: batch/v1
kind: Job
metadata:
  name: ${name}
  namespace: ${LIVE_NAMESPACE}
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: main
          image: busybox:1.37
          command: [sh, -c, 'exit 3']
`)

    const jobIssue = issueRow(page, 'Job', `${LIVE_NAMESPACE}/${name}`)
    await expect(jobIssue).toContainText('Job failed', LIVE_TIMEOUT)
  } finally {
    deleteInLiveNamespace('job', name)
  }
})

test('open pod logs keep following new output', async ({ page }) => {
  const name = uniqueName('ticker')
  try {
    applyManifest(deployment(name, 1, 'i=0; while true; do i=$((i+1)); echo "tick $i"; sleep 1; done'))
    kubectl('-n', LIVE_NAMESPACE, 'rollout', 'status', 'deployment', name, '--timeout=60s')
    const pod = kubectl('-n', LIVE_NAMESPACE, 'get', 'pods', '-l', `app=${name}`, '-o', 'jsonpath={.items[0].metadata.name}').trim()

    await page.goto(`/${CONTEXT}/pods/${LIVE_NAMESPACE}/${pod}`)
    await waitForDescribePanel(page)
    await page.getByRole('button', { name: 'View logs' }).click()

    const drawer = openDrawer(page)
    const firstLines = await logLines(drawer)
    const lastTick = Number(firstLines.at(-1)?.replace('tick ', ''))
    expect(lastTick).toBeGreaterThan(0)

    // Auto-refresh brings in lines the pod printed after the drawer opened.
    await expect(drawer.locator('pre')).toContainText(`tick ${lastTick + 5}`, LIVE_TIMEOUT)
  } finally {
    deleteInLiveNamespace('deployment', name)
  }
})
