<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClusterStore } from '@/stores/cluster'
import { resourceTotalsForPod } from '@/lib/k8s-usage'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { formatDateTime } from '@/lib/format'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { usePodStatusHistory } from '@/composables/usePodStatusHistory'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import LogsDrawer from '@/components/LogsDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import PodStatusTimeline from '@/components/PodStatusTimeline.vue'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
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

const statusHistory = usePodStatusHistory(() => ({
  timestamp: Date.now(),
  restartCount: podRestartCount(props.resource),
  phase: status.value.phase || 'Unknown',
  crashLooping: podCrashLooping(props.resource),
}))

const eventMatchers = computed(() => [{ kind: 'Pod', name: props.resource.metadata.name }])

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
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.pod.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" @click="logsOpen = true">
            <ScrollTextIcon data-icon="inline-start" />
            {{ $t('describe.viewLogs') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="phaseVariant(status.phase)">{{ status.phase || 'Unknown' }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.pod.node') }}</span>{{ spec.nodeName || '-' }}</div>
        <div><span class="text-muted-foreground">IP: </span>{{ status.podIP || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pod.created') }}</span>{{ formatDateTime(resource.metadata?.creationTimestamp) || '-' }}</div>
      </CardContent>
    </Card>

    <ResourceUsageCard
      :title="$t('describe.pod.usageTitle')"
      :description="$t('describe.pod.usageDescription')"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.pod.restartsTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.pod.restartsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <PodStatusTimeline :history="statusHistory" :resource="resource" />
      </CardContent>
    </Card>

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="eventMatchers" />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Containers</CardTitle>
        <CardDescription>{{ $t('describe.pod.containersDescription') }}</CardDescription>
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
            <span class="text-muted-foreground text-xs">{{ $t('describe.envVarsLabel') }}</span>
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
