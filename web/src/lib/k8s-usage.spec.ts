import { describe, expect, it } from 'vitest'
import { resourceTotalsForPod, resourceTotalsForPods } from './k8s-usage'

const MiB = 1024 ** 2

const pod = (name: string, containers: any[], namespace = 'default') => ({
  metadata: { name, namespace },
  spec: { containers },
})
const container = (requests?: Record<string, string>, limits?: Record<string, string>) => ({ resources: { requests, limits } })
const metric = (...containers: Array<{ cpu?: string; memory?: string }>) => ({ containers: containers.map((usage) => ({ usage })) })

describe('resourceTotalsForPod', () => {
  it('sums requests and limits across containers', () => {
    const p = pod('a', [
      container({ cpu: '100m', memory: '128Mi' }, { cpu: '1', memory: '256Mi' }),
      container({ cpu: '250m', memory: '64Mi' }, { cpu: '500m' }),
    ])
    expect(resourceTotalsForPod(p, {})).toEqual({
      cpuRequests: 350,
      cpuLimits: 1500,
      memRequests: 192 * MiB,
      memLimits: 256 * MiB,
      cpuUsage: 0,
      memUsage: 0,
      podsTotal: 1,
      podsWithUsage: 0,
    })
  })

  it('adds usage from the metrics keyed by namespace/name', () => {
    const p = pod('a', [container()], 'prod')
    const metrics = {
      'default/a': metric({ cpu: '999m', memory: '1Gi' }),
      'prod/a': metric({ cpu: '50m', memory: '10Mi' }, { cpu: '25000000n', memory: '5Mi' }),
    }
    const totals = resourceTotalsForPod(p, metrics)
    expect(totals.cpuUsage).toBeCloseTo(75)
    expect(totals.memUsage).toBe(15 * MiB)
    expect(totals.podsWithUsage).toBe(1)
  })

  it('counts a pod with an empty metric entry as having usage', () => {
    const totals = resourceTotalsForPod(pod('a', []), { 'default/a': {} })
    expect(totals.podsWithUsage).toBe(1)
    expect(totals.cpuUsage).toBe(0)
  })

  it('tolerates pods with no spec, containers without resources and metrics without usage', () => {
    expect(resourceTotalsForPod({ metadata: { name: 'x', namespace: 'n' } }, { 'n/x': { containers: [{}] } })).toEqual({
      cpuRequests: 0,
      cpuLimits: 0,
      memRequests: 0,
      memLimits: 0,
      cpuUsage: 0,
      memUsage: 0,
      podsTotal: 1,
      podsWithUsage: 1,
    })
    expect(resourceTotalsForPod(pod('y', [{}]), {}).cpuRequests).toBe(0)
    expect(resourceTotalsForPod({ spec: { containers: [container({ cpu: '1' })] } }, {}).cpuRequests).toBe(1000)
    expect(resourceTotalsForPod({}, { 'undefined/undefined': metric({ cpu: '1m' }) }).podsWithUsage).toBe(1)
  })
})

describe('resourceTotalsForPods', () => {
  it('returns zeros for an empty list', () => {
    expect(resourceTotalsForPods([], {})).toEqual({
      cpuRequests: 0,
      cpuLimits: 0,
      cpuUsage: 0,
      memRequests: 0,
      memLimits: 0,
      memUsage: 0,
      podsTotal: 0,
      podsWithUsage: 0,
    })
  })

  it('aggregates every field across pods', () => {
    const pods = [
      pod('a', [container({ cpu: '100m', memory: '100Mi' }, { cpu: '200m', memory: '200Mi' })]),
      pod('b', [container({ cpu: '300m', memory: '300Mi' }, { cpu: '400m', memory: '400Mi' })]),
      pod('c', [container({ cpu: '1m' }, { memory: '1Mi' })]),
    ]
    const metrics = {
      'default/a': metric({ cpu: '10m', memory: '10Mi' }),
      'default/b': metric({ cpu: '20m', memory: '20Mi' }),
    }
    expect(resourceTotalsForPods(pods, metrics)).toEqual({
      cpuRequests: 401,
      cpuLimits: 600,
      cpuUsage: 30,
      memRequests: 400 * MiB,
      memLimits: 601 * MiB,
      memUsage: 30 * MiB,
      podsTotal: 3,
      podsWithUsage: 2,
    })
  })
})
