<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClusterStore } from '@/stores/cluster'
import { resourceTotalsForPod } from '@/lib/k8s-usage'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import LogsDrawer from '@/components/LogsDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import { ScrollTextIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const containers = computed(() => spec.value.containers || [])
const containerStatuses = computed(() => status.value.containerStatuses || [])
const containerNames = computed(() => containers.value.map((c: any) => c.name))
const resourceTotals = computed(() => resourceTotalsForPod(props.resource, store.podMetrics))
const resourceHistory = useMetricsHistory(() => resourceTotals.value)

const logsOpen = ref(false)

function statusFor(name: string) {
  return containerStatuses.value.find((cs: any) => cs.name === name) || {}
}

function phaseVariant(phase: string) {
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
        Ver logs
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Estado</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="phaseVariant(status.phase)">{{ status.phase || 'Unknown' }}</Badge>
        <div><span class="text-muted-foreground">Nodo: </span>{{ spec.nodeName || '-' }}</div>
        <div><span class="text-muted-foreground">IP: </span>{{ status.podIP || '-' }}</div>
      </CardContent>
    </Card>

    <ResourceUsageCard
      title="Recursos"
      description="CPU y memoria de este pod"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Containers</CardTitle>
        <CardDescription>Imagen, estado y variables de entorno</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <div v-for="container in containers" :key="container.name" class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ container.name }}</span>
            <Badge variant="outline">Ready: {{ statusFor(container.name).ready ?? '-' }}</Badge>
            <Badge variant="outline">Restarts: {{ statusFor(container.name).restartCount ?? 0 }}</Badge>
          </div>
          <div class="text-muted-foreground font-mono text-xs break-all">{{ container.image }}</div>
          <div v-if="container.env?.length" class="flex min-w-0 flex-col gap-0.5 pl-2">
            <span class="text-muted-foreground text-xs">Env vars:</span>
            <div v-for="envVar in container.env" :key="envVar.name" class="break-all font-mono text-xs">
              {{ envVar.name }}={{ envVar.value ?? '(from secret/configMap)' }}
            </div>
          </div>
          <Separator class="mt-2" />
        </div>
      </CardContent>
    </Card>

    <LogsDrawer
      v-model:open="logsOpen"
      :namespace="resource.metadata.namespace"
      :name="resource.metadata.name"
      :containers="containerNames"
    />
  </div>
</template>
