<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { servicesForDeployment, podsForDeployment } from '@/lib/k8s-relations'
import { resourceTotalsForPods } from '@/lib/k8s-usage'
import { useMetricsHistory } from '@/composables/useMetricsHistory'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import AggregatedLogsDrawer from '@/components/AggregatedLogsDrawer.vue'
import ResourceUsageCard from '@/components/ResourceUsageCard.vue'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
import { ScrollTextIcon, NetworkIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const strategy = computed(() => spec.value.strategy || {})
const containers = computed(() => spec.value.template?.spec?.containers || [])

const relatedServices = computed(() => servicesForDeployment(props.resource, store.services))
const relatedPods = computed(() => podsForDeployment(props.resource, store.pods))
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
  { kind: 'Deployment', name: props.resource.metadata.name },
  ...relatedPods.value.map((pod: any) => ({ kind: 'Pod', name: pod.metadata.name })),
])

const logsOpen = ref(false)

function goToService(service: any) {
  router.push(`/${store.currentContext}/services/${service.metadata.namespace}/${service.metadata.name}`)
}

function serviceExposure(service: any) {
  const type = service.spec?.type || 'ClusterIP'
  const ports = (service.spec?.ports || []).map((p: any) => p.port).join(', ')
  return { type, ports }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.deployment.replicasTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.deployment.replicasDescription') }}</CardDescription>
        <CardAction>
          <Button size="sm" @click="logsOpen = true">
            <ScrollTextIcon data-icon="inline-start" />
            {{ $t('describe.viewAllLogs') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-4 text-sm">
        <div><span class="text-muted-foreground">{{ $t('describe.deployment.desired') }}</span>{{ spec.replicas ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.deployment.ready') }}</span>{{ status.readyReplicas || 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.deployment.available') }}</span>{{ status.availableReplicas || 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.deployment.updated') }}</span>{{ status.updatedReplicas || 0 }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.deployment.strategyTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant="outline">{{ strategy.type || 'RollingUpdate' }}</Badge>
        <div v-if="strategy.rollingUpdate">
          <span class="text-muted-foreground">maxSurge: </span>{{ strategy.rollingUpdate.maxSurge }}
        </div>
        <div v-if="strategy.rollingUpdate">
          <span class="text-muted-foreground">maxUnavailable: </span>{{ strategy.rollingUpdate.maxUnavailable }}
        </div>
      </CardContent>
    </Card>

    <ResourceUsageCard
      :title="$t('describe.deployment.usageTitle')"
      :description="$t('describe.deployment.usageDescription')"
      :totals="resourceTotals"
      :metrics-available="store.metricsStatus !== 'unavailable'"
      :history="resourceHistory"
    />

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Services</CardTitle>
        <CardDescription>{{ $t('describe.deployment.servicesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedServices.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.deployment.noServicesTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.deployment.noServicesDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="service in relatedServices"
          :key="service.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToService(service)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <NetworkIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ service.metadata.name }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{{ serviceExposure(service).type }}</Badge>
            <span>{{ serviceExposure(service).ports }}</span>
          </div>
        </button>
      </CardContent>
    </Card>

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="eventMatchers" />

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
      :description="`Deployment ${resource.metadata.name}`"
      :pods="logTargets"
    />
  </div>
</template>
