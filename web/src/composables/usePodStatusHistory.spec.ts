// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useClusterStore } from '@/stores/cluster'
import { withSetup } from '@/test/with-setup'
import { usePodStatusHistory, type PodStatusPoint } from './usePodStatusHistory'

const point = (timestamp: number, restartCount = 0): PodStatusPoint => ({ timestamp, restartCount, phase: 'Running', crashLooping: false })

function setup(initial: PodStatusPoint | null) {
  let status = initial
  const { result: history } = withSetup(() => usePodStatusHistory(() => status))
  const store = useClusterStore()
  return {
    history,
    refresh: async (value: PodStatusPoint | null, at: number) => {
      status = value
      store.lastUpdatedAt = at
      await nextTick()
    },
  }
}

describe('usePodStatusHistory', () => {
  it('samples immediately when a status is available', () => {
    const { history } = setup(point(1))
    expect(history.value).toEqual([point(1)])
  })

  it('appends a sample on every resource refresh and skips null statuses', async () => {
    const { history, refresh } = setup(null)
    expect(history.value).toEqual([])
    await refresh(point(1, 0), 1)
    await refresh(null, 2)
    await refresh({ timestamp: 3, restartCount: 4, phase: 'Running', crashLooping: true }, 3)
    expect(history.value).toEqual([point(1, 0), { timestamp: 3, restartCount: 4, phase: 'Running', crashLooping: true }])
  })

  it('keeps only the most recent 90 points', async () => {
    const { history, refresh } = setup(null)
    for (let i = 1; i <= 92; i++) await refresh(point(i), i)
    expect(history.value).toHaveLength(90)
    expect(history.value[0].timestamp).toBe(3)
    expect(history.value.at(-1)!.timestamp).toBe(92)
  })
})
