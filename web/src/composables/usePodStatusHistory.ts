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
 * Igual que useMetricsHistory pero para el estado del pod: acumula en memoria
 * (se pierde al recargar) una muestra cada vez que se refrescan los recursos,
 * para poder ver si el pod ha reiniciado o entrado en CrashLoopBackOff en la
 * ventana reciente, no solo su estado actual.
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
