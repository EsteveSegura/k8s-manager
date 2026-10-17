// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useClusterStore } from '@/stores/cluster'
import { withSetup } from '@/test/with-setup'
import { useMetricsHistory } from './useMetricsHistory'

type Totals = { cpuUsage: number; memUsage: number; podsWithUsage: number } | null

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function setup(initial: Totals) {
  let totals: Totals = initial
  const { result: history } = withSetup(() => useMetricsHistory(() => totals))
  const store = useClusterStore()
  return {
    history,
    setTotals: (value: Totals) => {
      totals = value
    },
    tick: async (at: number) => {
      vi.setSystemTime(at)
      store.metricsUpdatedAt = at
      await nextTick()
    },
  }
}

describe('useMetricsHistory', () => {
  it('samples immediately when totals are available', () => {
    const { history } = setup({ cpuUsage: 100, memUsage: 2048, podsWithUsage: 1 })
    expect(history.value).toEqual([{ timestamp: Date.parse('2026-01-01T00:00:00Z'), cpu: 100, mem: 2048 }])
  })

  it('skips samples without totals or without any pod reporting usage', async () => {
    const { history, setTotals, tick } = setup(null)
    expect(history.value).toEqual([])
    setTotals({ cpuUsage: 0, memUsage: 0, podsWithUsage: 0 })
    await tick(1000)
    expect(history.value).toEqual([])
  })

  it('appends a sample every time new metrics arrive', async () => {
    const { history, setTotals, tick } = setup(null)
    setTotals({ cpuUsage: 1, memUsage: 10, podsWithUsage: 1 })
    await tick(1000)
    setTotals({ cpuUsage: 2, memUsage: 20, podsWithUsage: 2 })
    await tick(2000)
    expect(history.value).toEqual([
      { timestamp: 1000, cpu: 1, mem: 10 },
      { timestamp: 2000, cpu: 2, mem: 20 },
    ])
  })

  it('keeps only the most recent 90 points', async () => {
    const { history, setTotals, tick } = setup(null)
    for (let i = 1; i <= 95; i++) {
      setTotals({ cpuUsage: i, memUsage: i, podsWithUsage: 1 })
      await tick(i * 1000)
    }
    expect(history.value).toHaveLength(90)
    expect(history.value[0].cpu).toBe(6)
    expect(history.value.at(-1)!.cpu).toBe(95)
  })
})
