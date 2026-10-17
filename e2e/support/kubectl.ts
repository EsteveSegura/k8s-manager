import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'

// Tests change the cluster with the admin credentials from cluster-up.sh, never
// with the app's read-only ones (and the audit check only looks at the app's).
const ADMIN_KUBECONFIG = path.join(__dirname, '..', '.kube', 'admin.config')

// Namespace reserved for resources the tests create and change (manifests/00-access.yaml).
export const LIVE_NAMESPACE = 'e2e-live'

export function kubectl(...args: string[]) {
  return execFileSync('kubectl', args, {
    encoding: 'utf8',
    env: { ...process.env, KUBECONFIG: ADMIN_KUBECONFIG },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function applyManifest(manifest: string) {
  execFileSync('kubectl', ['apply', '-f', '-'], {
    input: manifest,
    env: { ...process.env, KUBECONFIG: ADMIN_KUBECONFIG },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function deleteInLiveNamespace(kind: string, name: string) {
  try {
    kubectl('-n', LIVE_NAMESPACE, 'delete', kind, name, '--wait=false', '--ignore-not-found')
  } catch {
    // Best effort: the namespace is only used by these tests.
  }
}

// Unique per test run, so repeated or parallel runs never share resources.
export function uniqueName(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// Makes the app auto-refresh every 5 seconds (its minimum) from the first load.
export async function useFastAutoRefresh(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('settings.autoRefresh', 'true')
    localStorage.setItem('settings.refreshIntervalSeconds', '5')
  })
}
