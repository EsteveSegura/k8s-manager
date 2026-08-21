<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import UsageHistoryChart from '@/components/UsageHistoryChart.vue'
import { formatCpu, formatMemory, percentOf } from '@/lib/k8s-quantities'
import type { ResourceTotals } from '@/lib/k8s-usage'
import type { HistoryPoint } from '@/composables/useMetricsHistory'

const props = defineProps<{
  title: string
  description?: string
  totals: ResourceTotals
  metricsAvailable: boolean
  history?: HistoryPoint[]
}>()

const { t } = useI18n()

const hasUsage = computed(() => props.metricsAvailable && props.totals.podsWithUsage > 0)

const cpuHistoryPoints = computed(() => (props.history || []).map((p) => ({ timestamp: p.timestamp, value: p.cpu })))
const memHistoryPoints = computed(() => (props.history || []).map((p) => ({ timestamp: p.timestamp, value: p.mem })))

const cpuUsagePercent = computed(() => percentOf(props.totals.cpuUsage, props.totals.cpuLimits))
const memUsagePercent = computed(() => percentOf(props.totals.memUsage, props.totals.memLimits))

const coverageLabel = computed(() => {
  if (props.totals.podsTotal <= 1) return null
  return t('usage.coverage', { available: props.totals.podsWithUsage, total: props.totals.podsTotal })
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-sm">{{ title }}</CardTitle>
      <CardDescription v-if="description">{{ description }}</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-4 text-sm">
      <Empty v-if="!metricsAvailable">
        <EmptyHeader>
          <EmptyTitle>{{ $t('usage.unavailableTitle') }}</EmptyTitle>
          <EmptyDescription>{{ $t('usage.unavailableDescription') }}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="font-medium">CPU</span>
          <span v-if="hasUsage" class="text-muted-foreground text-xs">
            {{ $t('usage.inUse', { value: formatCpu(totals.cpuUsage) }) }}<span v-if="cpuUsagePercent !== null"> · {{ $t('usage.ofLimit', { percent: cpuUsagePercent }) }}</span>
          </span>
        </div>
        <Progress v-if="hasUsage && cpuUsagePercent !== null" :model-value="cpuUsagePercent" />
        <div class="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
          <span>Requests: {{ formatCpu(totals.cpuRequests) }}</span>
          <span>Limits: {{ totals.cpuLimits > 0 ? formatCpu(totals.cpuLimits) : $t('usage.noLimit') }}</span>
        </div>
        <UsageHistoryChart
          v-if="hasUsage"
          :points="cpuHistoryPoints"
          :limit="totals.cpuLimits"
          :format-value="formatCpu"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="font-medium">{{ $t('usage.memory') }}</span>
          <span v-if="hasUsage" class="text-muted-foreground text-xs">
            {{ $t('usage.inUse', { value: formatMemory(totals.memUsage) }) }}<span v-if="memUsagePercent !== null"> · {{ $t('usage.ofLimit', { percent: memUsagePercent }) }}</span>
          </span>
        </div>
        <Progress v-if="hasUsage && memUsagePercent !== null" :model-value="memUsagePercent" />
        <div class="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
          <span>Requests: {{ formatMemory(totals.memRequests) }}</span>
          <span>Limits: {{ totals.memLimits > 0 ? formatMemory(totals.memLimits) : $t('usage.noLimit') }}</span>
        </div>
        <UsageHistoryChart
          v-if="hasUsage"
          :points="memHistoryPoints"
          :limit="totals.memLimits"
          :format-value="formatMemory"
        />
      </div>

      <p v-if="coverageLabel" class="text-muted-foreground text-xs">{{ coverageLabel }}</p>
    </CardContent>
  </Card>
</template>
