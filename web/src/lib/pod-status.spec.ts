import { describe, expect, it } from 'vitest'
import { podCrashLooping, podRestartCount } from './pod-status'

describe('podRestartCount', () => {
  it('sums restarts across all containers', () => {
    const pod = { status: { containerStatuses: [{ restartCount: 2 }, { restartCount: 3 }, {}] } }
    expect(podRestartCount(pod)).toBe(5)
  })

  it('is 0 without container statuses', () => {
    expect(podRestartCount({})).toBe(0)
    expect(podRestartCount({ status: {} })).toBe(0)
  })
})

describe('podCrashLooping', () => {
  it('is true if any container is waiting in CrashLoopBackOff', () => {
    const pod = {
      status: {
        containerStatuses: [{ state: { running: {} } }, { state: { waiting: { reason: 'CrashLoopBackOff' } } }],
      },
    }
    expect(podCrashLooping(pod)).toBe(true)
  })

  it('is false for other waiting reasons or missing states', () => {
    const pod = { status: { containerStatuses: [{ state: { waiting: { reason: 'ImagePullBackOff' } } }, {}, { state: {} }] } }
    expect(podCrashLooping(pod)).toBe(false)
    expect(podCrashLooping({})).toBe(false)
  })
})
