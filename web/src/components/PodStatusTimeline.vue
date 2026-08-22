<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime } from '@/lib/format'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { PodStatusPoint } from '@/composables/usePodStatusHistory'

const props = defineProps<{
  history: PodStatusPoint[]
  resource: any
}>()

const containerStatuses = computed(() => props.resource.status?.containerStatuses || [])

const totalRestarts = computed(() => podRestartCount(props.resource))
const crashLoopingNow = computed(() => podCrashLooping(props.resource))

const lastRestart = computed(() => {
  const terminations = containerStatuses.value
    .map((cs: any) => (cs.lastState?.terminated ? { container: cs.name, ...cs.lastState.terminated } : null))
    .filter(Boolean) as { container: string; reason?: string; exitCode?: number; finishedAt?: string }[]
  if (terminations.length === 0) return null
  return terminations.sort((a, b) => new Date(b.finishedAt || 0).getTime() - new Date(a.finishedAt || 0).getTime())[0]
})

function tickVariant(point: PodStatusPoint) {
  if (point.crashLooping || point.phase === 'Failed') return 'bg-destructive'
  if (point.phase === 'Pending' || point.phase === 'Unknown') return 'bg-muted-foreground/40'
  return 'bg-emerald-500'
}

function isRestartTick(point: PodStatusPoint, index: number) {
  const previous = props.history[index - 1]
  return !!previous && point.restartCount > previous.restartCount
}

const restartsInWindow = computed(() => props.history.filter((point, i) => isRestartTick(point, i)).length)
</script>

<template>
  <div class="flex flex-col gap-3 text-sm">
    <div class="flex flex-wrap items-center gap-4">
      <div><span class="text-muted-foreground">{{ $t('describe.pod.totalRestarts') }}</span>{{ totalRestarts }}</div>
      <Badge v-if="crashLoopingNow" variant="destructive">CrashLoopBackOff</Badge>
    </div>

    <Empty v-if="history.length < 2">
      <EmptyHeader>
        <EmptyTitle>{{ $t('chart.collectingTitle') }}</EmptyTitle>
        <EmptyDescription>{{ $t('chart.collectingDescription') }}</EmptyDescription>
      </EmptyHeader>
    </Empty>

    <template v-else>
      <div class="flex items-center gap-0.5">
        <span
          v-for="(point, i) in history"
          :key="point.timestamp"
          :title="`${point.phase} · ${new Date(point.timestamp).toLocaleTimeString()}${isRestartTick(point, i) ? ' · restart' : ''}`"
          :class="[
            'h-4 w-1.5 shrink-0 rounded-full',
            tickVariant(point),
            isRestartTick(point, i) ? 'ring-2 ring-destructive ring-offset-1 ring-offset-background' : '',
          ]"
        />
      </div>
      <p class="text-muted-foreground text-xs">{{ $t('describe.pod.restartsInWindow', { count: restartsInWindow }) }}</p>
    </template>

    <div v-if="lastRestart" class="flex flex-col gap-1 rounded-md border p-2 text-xs">
      <span class="font-medium">{{ $t('describe.pod.lastRestart') }}</span>
      <span class="text-muted-foreground">{{ lastRestart.container }} · {{ lastRestart.reason || 'Unknown' }} (exit {{ lastRestart.exitCode }})</span>
      <span v-if="lastRestart.finishedAt" class="text-muted-foreground">{{ formatDateTime(lastRestart.finishedAt) }}</span>
    </div>
  </div>
</template>
