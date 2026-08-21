<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForService } from '@/lib/k8s-relations'
import { resourceTotalsForPods } from '@/lib/k8s-usage'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import AggregatedLogsDrawer from '@/components/AggregatedLogsDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import { ScrollTextIcon, ContainerIcon } from '@lucide/vue'

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
        Ver logs de todos los pods
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Exposición de red</CardTitle>
        <CardDescription>Tipo, IP y puertos del Service</CardDescription>
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
        <CardTitle class="text-sm">Puertos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Puerto</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>NodePort</TableHead>
              <TableHead>Protocolo</TableHead>
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
      title="Recursos (agregado)"
      description="Suma de CPU y memoria de todos los pods de este Service"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Selector</CardTitle>
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
        <span v-if="selectorEntries.length === 0" class="text-muted-foreground text-sm">Sin selector (Service manual/externo)</span>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>Pods a los que enruta este Service</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>Sin pods</EmptyTitle>
            <EmptyDescription>Ningún pod activo coincide con el selector de este Service.</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="pod in relatedPods"
          :key="pod.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToPod(pod)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ContainerIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ pod.metadata.name }}</span>
          </div>
          <Badge :variant="podPhaseVariant(pod.status?.phase)" class="shrink-0">{{ pod.status?.phase || 'Unknown' }}</Badge>
        </button>
      </CardContent>
    </Card>

    <AggregatedLogsDrawer
      v-model:open="logsOpen"
      title="Logs de todos los pods"
      :description="`Service ${resource.metadata.name}`"
      :pods="logTargets"
    />
  </div>
</template>
