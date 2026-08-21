import { ref, watch } from 'vue'
import { useClusterStore } from '@/stores/cluster'

export interface HistoryPoint {
  timestamp: number
  cpu: number
  mem: number
}

const MAX_POINTS = 90

/**
 * Acumula en memoria (se pierde al recargar) una muestra cada vez que llegan
 * métricas nuevas del snapshot de metrics-server, para poder graficar una
 * ventana reciente sin depender de ningún backend de histórico externo.
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
