import { ref, watch } from 'vue'
import { useClusterStore } from '@/stores/cluster'

export interface PodStatusPoint {
  timestamp: number
  restartCount: number
  phase: string
  crashLooping: boolean
}

const MAX_POINTS = 90

/**
 * Same as useMetricsHistory but for pod status: accumulates in memory
 * (lost on reload) a sample every time resources are refreshed, so we can
 * see whether the pod has restarted or entered CrashLoopBackOff in the
 * recent window, not just its current status.
 */
export function usePodStatusHistory(getStatus: () => PodStatusPoint | null) {
  const store = useClusterStore()
  const history = ref<PodStatusPoint[]>([])

  function sample() {
    const status = getStatus()
    if (!status) return
    history.value = [...history.value, status].slice(-MAX_POINTS)
  }

  watch(() => store.lastUpdatedAt, sample, { immediate: true })

  return history
}
