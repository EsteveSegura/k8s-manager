<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForService } from '@/lib/k8s-relations'
import { resourceTotalsForPods } from '@/lib/k8s-usage'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { formatDateTime } from '@/lib/format'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import AggregatedLogsDrawer from '@/components/AggregatedLogsDrawer.vue'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
import { CodeIcon, ContainerIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const selectorEntries = computed(() => Object.entries(spec.value.selector || {}))

const relatedPods = computed(() => podsForService(props.resource, store.pods))
const resourceTotals = computed(() => resourceTotalsForPods(relatedPods.value, store.podMetrics))
const resourceHistory = useMetricsHistory(() => resourceTotals.value)
const logTargets = computed(() =>
  relatedPods.value.map((pod: any) => ({
    namespace: pod.metadata.namespace,
    name: pod.metadata.name,
    containers: (pod.spec?.containers || []).map((c: any) => c.name),
  })),
)
const eventMatchers = computed(() => [
  { kind: 'Service', name: props.resource.metadata.name },
  ...relatedPods.value.map((pod: any) => ({ kind: 'Pod', name: pod.metadata.name })),
])

const logsOpen = ref(false)
const { yamlOpen, yaml } = useResourceYaml('services', () => props.resource)

defineExpose({ openLogs: () => (logsOpen.value = true) })

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
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.service.networkTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.service.networkDescription') }}</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant="outline">{{ spec.type || 'ClusterIP' }}</Badge>
        <div><span class="text-muted-foreground">ClusterIP: </span>{{ spec.clusterIP || 'None' }}</div>
        <div v-if="spec.externalIPs?.length">
          <span class="text-muted-foreground">External IPs: </span>{{ spec.externalIPs.join(', ') }}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.service.portsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t('describe.service.columns.name') }}</TableHead>
              <TableHead>{{ $t('describe.service.columns.port') }}</TableHead>
              <TableHead>{{ $t('describe.service.columns.target') }}</TableHead>
              <TableHead>{{ $t('describe.service.columns.nodePort') }}</TableHead>
              <TableHead>{{ $t('describe.service.columns.protocol') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="port in spec.ports || []" :key="`${port.name}-${port.port}`">
              <TableCell>{{ port.name || '-' }}</TableCell>
              <TableCell>{{ port.port }}</TableCell>
              <TableCell>{{ port.targetPort }}</TableCell>
              <TableCell>{{ port.nodePort || '-' }}</TableCell>
              <TableCell>{{ port.protocol }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <ResourceUsageCard
      :title="$t('describe.service.usageTitle')"
      :description="$t('describe.service.usageDescription')"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.service.selectorTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex min-w-0 flex-wrap gap-2">
        <Badge
          v-for="[key, value] in selectorEntries"
          :key="key"
          variant="secondary"
          class="max-w-full whitespace-normal break-all font-mono"
        >
          {{ key }}={{ value }}
        </Badge>
        <span v-if="selectorEntries.length === 0" class="text-muted-foreground text-sm">{{ $t('describe.service.noSelector') }}</span>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.service.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.service.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.service.noPodsDescription') }}</EmptyDescription>
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

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="eventMatchers" />

    <AggregatedLogsDrawer
      v-model:open="logsOpen"
      :title="$t('logs.allLogsTitle')"
      :description="`Service ${resource.metadata.name}`"
      :pods="logTargets"
    />
    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
