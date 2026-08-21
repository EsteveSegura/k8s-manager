import { parseCpu, parseMemory } from './k8s-quantities'

export interface ResourceTotals {
  cpuRequests: number
  cpuLimits: number
  cpuUsage: number
  memRequests: number
  memLimits: number
  memUsage: number
  podsTotal: number
  podsWithUsage: number
}

function emptyTotals(): ResourceTotals {
  return { cpuRequests: 0, cpuLimits: 0, cpuUsage: 0, memRequests: 0, memLimits: 0, memUsage: 0, podsTotal: 0, podsWithUsage: 0 }
}

function podKey(pod: any) {
  return `${pod.metadata?.namespace}/${pod.metadata?.name}`
}

function podRequestsAndLimits(pod: any) {
  const containers = pod.spec?.containers || []
  let cpuRequests = 0
  let cpuLimits = 0
  let memRequests = 0
  let memLimits = 0
  for (const container of containers) {
    cpuRequests += parseCpu(container.resources?.requests?.cpu)
    cpuLimits += parseCpu(container.resources?.limits?.cpu)
    memRequests += parseMemory(container.resources?.requests?.memory)
    memLimits += parseMemory(container.resources?.limits?.memory)
  }
  return { cpuRequests, cpuLimits, memRequests, memLimits }
}

function podUsage(pod: any, metricsByPodKey: Record<string, any>) {
  const metric = metricsByPodKey[podKey(pod)]
  if (!metric) return null
  let cpuUsage = 0
  let memUsage = 0
  for (const container of metric.containers || []) {
    cpuUsage += parseCpu(container.usage?.cpu)
    memUsage += parseMemory(container.usage?.memory)
  }
  return { cpuUsage, memUsage }
}

export function resourceTotalsForPod(pod: any, metricsByPodKey: Record<string, any>): ResourceTotals {
  const { cpuRequests, cpuLimits, memRequests, memLimits } = podRequestsAndLimits(pod)
  const usage = podUsage(pod, metricsByPodKey)
  return {
    cpuRequests,
    cpuLimits,
    memRequests,
    memLimits,
    cpuUsage: usage?.cpuUsage || 0,
    memUsage: usage?.memUsage || 0,
    podsTotal: 1,
    podsWithUsage: usage ? 1 : 0,
  }
}

export function resourceTotalsForPods(pods: any[], metricsByPodKey: Record<string, any>): ResourceTotals {
  const totals = emptyTotals()
  for (const pod of pods) {
    const podTotals = resourceTotalsForPod(pod, metricsByPodKey)
    totals.cpuRequests += podTotals.cpuRequests
    totals.cpuLimits += podTotals.cpuLimits
    totals.cpuUsage += podTotals.cpuUsage
    totals.memRequests += podTotals.memRequests
    totals.memLimits += podTotals.memLimits
    totals.memUsage += podTotals.memUsage
    totals.podsTotal += 1
    totals.podsWithUsage += podTotals.podsWithUsage
  }
  return totals
}
