<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForStatefulSet } from '@/lib/k8s-relations'
import { resourceTotalsForPods } from '@/lib/k8s-usage'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { formatDateTime } from '@/lib/format'
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
const updateStrategy = computed(() => spec.value.updateStrategy || {})
const containers = computed(() => spec.value.template?.spec?.containers || [])

const relatedPods = computed(() => podsForStatefulSet(props.resource, store.pods))
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
        <CardTitle class="text-sm">{{ $t('describe.statefulset.replicasTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.statefulset.replicasDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-4 text-sm">
        <div><span class="text-muted-foreground">{{ $t('describe.statefulset.desired') }}</span>{{ spec.replicas ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.statefulset.ready') }}</span>{{ status.readyReplicas || 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.statefulset.current') }}</span>{{ status.currentReplicas || 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.statefulset.updated') }}</span>{{ status.updatedReplicas || 0 }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.statefulset.strategyTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant="outline">{{ updateStrategy.type || 'RollingUpdate' }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.statefulset.serviceTitle') }}: </span>{{ spec.serviceName || '-' }}</div>
      </CardContent>
    </Card>

    <ResourceUsageCard
      :title="$t('describe.statefulset.usageTitle')"
      :description="$t('describe.statefulset.usageDescription')"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.statefulset.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.statefulset.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.statefulset.noPodsDescription') }}</EmptyDescription>
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
      :description="`StatefulSet ${resource.metadata.name}`"
      :pods="logTargets"
    />
  </div>
</template>
