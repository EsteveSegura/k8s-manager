<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { targetForHorizontalPodAutoscaler } from '@/lib/k8s-relations'
import { formatDateTime } from '@/lib/format'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon, BoxesIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('horizontalpodautoscalers', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const target = computed(() => targetForHorizontalPodAutoscaler(props.resource, store.deployments, store.statefulsets))

const metricRows = computed(() => {
  const currentByName = new Map((status.value.currentMetrics || []).map((m: any) => [m.resource?.name || m.type, m]))
  return (spec.value.metrics || []).map((metric: any) => {
    if (metric.type !== 'Resource') {
      return { name: metric.type, targetLabel: '-', currentLabel: '-' }
    }
    const current = currentByName.get(metric.resource.name)
    const targetLabel =
      metric.resource.target?.type === 'Utilization' ? `${metric.resource.target.averageUtilization}%` : metric.resource.target?.averageValue || '-'
    const currentLabel = current
      ? current.resource.current?.averageUtilization != null
        ? `${current.resource.current.averageUtilization}%`
        : current.resource.current?.averageValue || '-'
      : '-'
    return { name: metric.resource.name, targetLabel, currentLabel }
  })
})

function conditionVariant(status: string) {
  return status === 'True' ? 'secondary' : status === 'False' ? 'destructive' : 'outline'
}

function goToTarget() {
  if (!target.value) return
  const kind = spec.value.scaleTargetRef?.kind === 'StatefulSet' ? 'statefulsets' : 'deployments'
  router.push(`/${store.currentContext}/${kind}/${target.value.metadata.namespace}/${target.value.metadata.name}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.hpa.replicasTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-4 text-sm">
        <div><span class="text-muted-foreground">{{ $t('describe.hpa.current') }}</span>{{ status.currentReplicas ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.hpa.desired') }}</span>{{ status.desiredReplicas ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.hpa.min') }}</span>{{ spec.minReplicas ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.hpa.max') }}</span>{{ spec.maxReplicas ?? 0 }}</div>
        <div v-if="status.lastScaleTime">
          <span class="text-muted-foreground">{{ $t('describe.hpa.lastScaleTime') }}</span>{{ formatDateTime(status.lastScaleTime) }}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.hpa.targetTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <button
          v-if="target"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToTarget"
        >
          <div class="flex min-w-0 items-center gap-2">
            <BoxesIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ target.metadata.name }}</span>
          </div>
          <Badge variant="outline" class="shrink-0">{{ spec.scaleTargetRef?.kind }}</Badge>
        </button>
        <div v-else class="text-muted-foreground text-xs">{{ spec.scaleTargetRef?.kind }}/{{ spec.scaleTargetRef?.name }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.hpa.metricsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <div v-for="row in metricRows" :key="row.name" class="grid grid-cols-3 gap-2">
          <div class="font-medium capitalize">{{ row.name }}</div>
          <div><span class="text-muted-foreground">{{ $t('describe.hpa.currentValue') }}</span>{{ row.currentLabel }}</div>
          <div><span class="text-muted-foreground">{{ $t('describe.hpa.targetValue') }}</span>{{ row.targetLabel }}</div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="status.conditions?.length">
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.hpa.conditionsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <div v-for="condition in status.conditions" :key="condition.type" class="flex flex-wrap items-center gap-2">
          <Badge :variant="conditionVariant(condition.status)">{{ condition.type }}</Badge>
          <span class="text-muted-foreground text-xs">{{ condition.message }}</span>
        </div>
      </CardContent>
    </Card>

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="[{ kind: 'HorizontalPodAutoscaler', name: resource.metadata.name }]" />

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
