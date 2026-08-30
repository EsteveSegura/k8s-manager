import { jobStatusLabel } from '@/lib/job-status'

export function isNodeReady(node: any): boolean {
  const condition = (node.status?.conditions || []).find((c: any) => c.type === 'Ready')
  return condition?.status === 'True'
}

export function isPodHealthy(pod: any): boolean {
  const phase = pod.status?.phase
  if (phase === 'Succeeded') return true
  if (phase !== 'Running') return false
  const statuses = pod.status?.containerStatuses || []
  if (statuses.length === 0) return false
  return statuses.every((cs: any) => cs.ready)
}

// Technical reason exactly as `kubectl get pods` would expose it: phase if not
// yet Running, or the reason of the waiting container (CrashLoopBackOff, ImagePullBackOff...).
export function podIssueReason(pod: any): string {
  const phase = pod.status?.phase
  if (phase !== 'Running') return phase || 'Unknown'
  const waiting = (pod.status?.containerStatuses || []).find((cs: any) => cs.state?.waiting)
  if (waiting) return waiting.state.waiting.reason || 'NotReady'
  return 'NotReady'
}

export function isDeploymentHealthy(item: any): boolean {
  return (item.status?.readyReplicas || 0) === (item.spec?.replicas ?? 0)
}

export function isStatefulSetHealthy(item: any): boolean {
  return (item.status?.readyReplicas || 0) === (item.spec?.replicas ?? 0)
}

export function isDaemonSetHealthy(item: any): boolean {
  return (item.status?.numberReady || 0) === (item.status?.desiredNumberScheduled || 0)
}

export function isJobHealthy(item: any): boolean {
  return jobStatusLabel(item) !== 'Failed'
}
