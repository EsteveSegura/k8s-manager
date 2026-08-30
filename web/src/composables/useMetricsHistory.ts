import { ref, watch } from 'vue'
import { useClusterStore } from '@/stores/cluster'

export interface HistoryPoint {
  timestamp: number
  cpu: number
  mem: number
}

const MAX_POINTS = 90

/**
 * Accumulates in memory (lost on reload) a sample every time new metrics
 * arrive from the metrics-server snapshot, so a recent window can be
 * charted without depending on any external history backend.
 */
export function useMetricsHistory(getTotals: () => { cpuUsage: number; memUsage: number; podsWithUsage: number } | null) {
  const store = useClusterStore()
  const history = ref<HistoryPoint[]>([])

  function sample() {
    const totals = getTotals()
    if (!totals || totals.podsWithUsage === 0) return
    history.value = [...history.value, { timestamp: Date.now(), cpu: totals.cpuUsage, mem: totals.memUsage }].slice(
      -MAX_POINTS,
    )
  }

  watch(() => store.metricsUpdatedAt, sample, { immediate: true })

  return history
}
