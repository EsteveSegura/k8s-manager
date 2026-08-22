<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForJob } from '@/lib/k8s-relations'
import { resourceTotalsForPods } from '@/lib/k8s-usage'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { formatDateTime } from '@/lib/format'
import { jobStatusLabel, jobStatusVariant } from '@/lib/job-status'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import AggregatedLogsDrawer from '@/components/AggregatedLogsDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import { ScrollTextIcon, ContainerIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const containers = computed(() => spec.value.template?.spec?.containers || [])

const jobStatus = computed(() => jobStatusLabel(props.resource))

const startTimeLabel = computed(() => formatDateTime(status.value.startTime))
const completionTimeLabel = computed(() => formatDateTime(status.value.completionTime))

const relatedPods = computed(() => podsForJob(props.resource, store.pods))
const resourceTotals = computed(() => resourceTotalsForPods(relatedPods.value, store.podMetrics))
const resourceHistory = useMetricsHistory(() => resourceTotals.value)
const logTargets = computed(() =>
  relatedPods.value.map((pod: any) => ({
    namespace: pod.metadata.namespace,
    name: pod.metadata.name,
    containers: (pod.spec?.containers || []).map((c: any) => c.name),
  })),
)

const logsOpen = ref(false)

function goToPod(pod: any) {
  router.push(`/${store.currentContext}/pods/${pod.metadata.namespace}/${pod.metadata.name}`)
}

function podPhaseVariant(phase: string) {
  if (phase === 'Running') return 'secondary'
  if (phase === 'Pending') return 'outline'
  return 'destructive'
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold">{{ resource.metadata.name }}</h2>
        <p class="text-muted-foreground text-sm">{{ resource.metadata.namespace }}</p>
      </div>
      <Button size="sm" @click="logsOpen = true">
        <ScrollTextIcon data-icon="inline-start" />
        {{ $t('describe.viewAllLogs') }}
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.job.statusTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="jobStatusVariant(jobStatus)">{{ jobStatus }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.job.completions') }}</span>{{ status.succeeded || 0 }}/{{ spec.completions ?? 1 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.job.parallelism') }}</span>{{ spec.parallelism ?? 1 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.job.active') }}</span>{{ status.active || 0 }}</div>
        <div v-if="status.failed"><span class="text-muted-foreground">{{ $t('describe.job.failed') }}</span>{{ status.failed }}</div>
        <div v-if="startTimeLabel"><span class="text-muted-foreground">{{ $t('describe.job.startTime') }}</span>{{ startTimeLabel }}</div>
        <div v-if="completionTimeLabel"><span class="text-muted-foreground">{{ $t('describe.job.completionTime') }}</span>{{ completionTimeLabel }}</div>
      </CardContent>
    </Card>

    <ResourceUsageCard
      :title="$t('describe.job.usageTitle')"
      :description="$t('describe.job.usageDescription')"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.job.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.job.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.job.noPodsDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="pod in relatedPods"
          :key="pod.metadata.name"
          type="button"
          class="@container flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToPod(pod)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ContainerIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ pod.metadata.name }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Badge variant="outline" class="hidden @md:inline-flex whitespace-nowrap">{{ formatDateTime(pod.metadata?.creationTimestamp) }}</Badge>
            <Badge :variant="podCrashLooping(pod) ? 'destructive' : podRestartCount(pod) > 0 ? 'secondary' : 'outline'" class="hidden @sm:inline-flex">
              {{ $t('describe.pod.restartsBadge', { count: podRestartCount(pod) }) }}
            </Badge>
            <Badge :variant="podPhaseVariant(pod.status?.phase)">{{ pod.status?.phase || 'Unknown' }}</Badge>
          </div>
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Containers</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <div v-for="container in containers" :key="container.name" class="flex flex-col gap-1">
          <div class="font-medium">{{ container.name }}</div>
          <div class="text-muted-foreground font-mono text-xs break-all">{{ container.image }}</div>
          <div v-if="container.env?.length" class="flex min-w-0 flex-col gap-0.5 pl-2">
            <span class="text-muted-foreground text-xs">{{ $t('describe.envVarsLabel') }}</span>
            <div v-for="envVar in container.env" :key="envVar.name" class="break-all font-mono text-xs">
              {{ envVar.name }}={{ envVar.value ?? '(from secret/configMap)' }}
            </div>
          </div>
          <Separator class="mt-2" />
        </div>
      </CardContent>
    </Card>

    <AggregatedLogsDrawer
      v-model:open="logsOpen"
      :title="$t('logs.allLogsTitle')"
      :description="`Job ${resource.metadata.name}`"
      :pods="logTargets"
    />
  </div>
</template>
