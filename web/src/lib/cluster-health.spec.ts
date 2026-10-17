import { describe, expect, it } from 'vitest'
import {
  isDaemonSetHealthy,
  isDeploymentHealthy,
  isJobHealthy,
  isNodeReady,
  isPodHealthy,
  isStatefulSetHealthy,
  podIssueReason,
} from './cluster-health'

describe('isNodeReady', () => {
  it('is true only when the Ready condition is True', () => {
    expect(isNodeReady({ status: { conditions: [{ type: 'MemoryPressure', status: 'False' }, { type: 'Ready', status: 'True' }] } })).toBe(true)
    expect(isNodeReady({ status: { conditions: [{ type: 'Ready', status: 'False' }] } })).toBe(false)
    expect(isNodeReady({ status: { conditions: [{ type: 'Ready', status: 'Unknown' }] } })).toBe(false)
  })

  it('ignores other conditions with status True', () => {
    expect(isNodeReady({ status: { conditions: [{ type: 'DiskPressure', status: 'True' }] } })).toBe(false)
  })

  it('is false with no conditions', () => {
    expect(isNodeReady({})).toBe(false)
    expect(isNodeReady({ status: {} })).toBe(false)
  })
})

describe('isPodHealthy', () => {
  const running = (containerStatuses: any[]) => ({ status: { phase: 'Running', containerStatuses } })

  it('treats Succeeded pods as healthy', () => {
    expect(isPodHealthy({ status: { phase: 'Succeeded' } })).toBe(true)
  })

  it.each(['Pending', 'Failed', 'Unknown', undefined])('treats phase %s as unhealthy', (phase) => {
    expect(isPodHealthy({ status: { phase, containerStatuses: [{ ready: true }] } })).toBe(false)
  })

  it('requires every container to be ready', () => {
    expect(isPodHealthy(running([{ ready: true }, { ready: true }]))).toBe(true)
    expect(isPodHealthy(running([{ ready: true }, { ready: false }]))).toBe(false)
  })

  it('is unhealthy when running without container statuses', () => {
    expect(isPodHealthy(running([]))).toBe(false)
    expect(isPodHealthy({ status: { phase: 'Running' } })).toBe(false)
  })

  it('is unhealthy without status', () => {
    expect(isPodHealthy({})).toBe(false)
  })
})

describe('podIssueReason', () => {
  it('returns the phase when not Running', () => {
    expect(podIssueReason({ status: { phase: 'Pending' } })).toBe('Pending')
    expect(podIssueReason({ status: { phase: 'Failed' } })).toBe('Failed')
  })

  it('returns Unknown when there is no phase', () => {
    expect(podIssueReason({})).toBe('Unknown')
  })

  it('returns the waiting reason of the first waiting container', () => {
    const pod = {
      status: {
        phase: 'Running',
        containerStatuses: [
          { state: { running: {} } },
          { state: { waiting: { reason: 'CrashLoopBackOff' } } },
          { state: { waiting: { reason: 'ImagePullBackOff' } } },
        ],
      },
    }
    expect(podIssueReason(pod)).toBe('CrashLoopBackOff')
  })

  it('falls back to NotReady when the waiting state has no reason', () => {
    expect(podIssueReason({ status: { phase: 'Running', containerStatuses: [{ state: { waiting: {} } }] } })).toBe('NotReady')
  })

  it('skips container statuses without a state', () => {
    const pod = { status: { phase: 'Running', containerStatuses: [{}, { state: { waiting: { reason: 'ErrImagePull' } } }] } }
    expect(podIssueReason(pod)).toBe('ErrImagePull')
  })

  it('returns NotReady when running with no waiting containers', () => {
    expect(podIssueReason({ status: { phase: 'Running', containerStatuses: [{ state: { running: {} }, ready: false }] } })).toBe('NotReady')
    expect(podIssueReason({ status: { phase: 'Running' } })).toBe('NotReady')
  })
})

describe('isDeploymentHealthy / isStatefulSetHealthy', () => {
  it.each([isDeploymentHealthy, isStatefulSetHealthy])('compares ready vs desired replicas (%o)', (fn) => {
    expect(fn({ spec: { replicas: 3 }, status: { readyReplicas: 3 } })).toBe(true)
    expect(fn({ spec: { replicas: 3 }, status: { readyReplicas: 2 } })).toBe(false)
    expect(fn({ spec: { replicas: 2 }, status: { readyReplicas: 3 } })).toBe(false)
  })

  it.each([isDeploymentHealthy, isStatefulSetHealthy])('treats a scaled-to-zero workload as healthy (%o)', (fn) => {
    expect(fn({ spec: { replicas: 0 }, status: {} })).toBe(true)
    expect(fn({})).toBe(true)
  })

  it.each([isDeploymentHealthy, isStatefulSetHealthy])('is unhealthy when replicas are desired but none ready (%o)', (fn) => {
    expect(fn({ spec: { replicas: 1 }, status: {} })).toBe(false)
  })
})

describe('isDaemonSetHealthy', () => {
  it('compares numberReady vs desiredNumberScheduled', () => {
    expect(isDaemonSetHealthy({ status: { numberReady: 2, desiredNumberScheduled: 2 } })).toBe(true)
    expect(isDaemonSetHealthy({ status: { numberReady: 1, desiredNumberScheduled: 2 } })).toBe(false)
    expect(isDaemonSetHealthy({ status: { desiredNumberScheduled: 1 } })).toBe(false)
    expect(isDaemonSetHealthy({ status: { numberReady: 1 } })).toBe(false)
  })

  it('is healthy when nothing is scheduled', () => {
    expect(isDaemonSetHealthy({})).toBe(true)
  })
})

describe('isJobHealthy', () => {
  it('is unhealthy only when failed', () => {
    expect(isJobHealthy({ status: { conditions: [{ type: 'Failed', status: 'True' }] } })).toBe(false)
    expect(isJobHealthy({ status: { conditions: [{ type: 'Complete', status: 'True' }] } })).toBe(true)
    expect(isJobHealthy({ status: { active: 1 } })).toBe(true)
    expect(isJobHealthy({})).toBe(true)
  })
})
