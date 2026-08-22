<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForNode } from '@/lib/k8s-relations'
import { parseCpu, parseMemory, formatCpu, formatMemory } from '@/lib/k8s-quantities'
import { podRestartCount, podCrashLooping } from '@/lib/pod-status'
import { formatDateTime } from '@/lib/format'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ContainerIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const nodeInfo = computed(() => status.value.nodeInfo || {})
const labels = computed(() => props.resource.metadata?.labels || {})

const STANDARD_CONDITION_TYPES = ['Ready', 'MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']

const standardConditions = computed(() => {
  const all = status.value.conditions || []
  return STANDARD_CONDITION_TYPES.map((type) => all.find((c: any) => c.type === type)).filter(Boolean)
})

const abnormalConditions = computed(() => {
  const all = status.value.conditions || []
  return all.filter((c: any) => !STANDARD_CONDITION_TYPES.includes(c.type) && c.status !== 'False')
})

function conditionVariant(type: string, conditionStatus: string) {
  const isHealthy = type === 'Ready' ? conditionStatus === 'True' : conditionStatus === 'False'
  return isHealthy ? 'secondary' : 'destructive'
}

const roles = computed(() =>
  Object.keys(labels.value)
    .filter((key) => key.startsWith('node-role.kubernetes.io/'))
    .map((key) => key.replace('node-role.kubernetes.io/', ''))
    .filter(Boolean),
)

const relatedPods = computed(() => podsForNode(props.resource, store.pods))
const nodeMetric = computed(() => store.nodeMetrics[props.resource.metadata?.name])

interface CapacityRow {
  label: string
  capacity: string
  allocatable: string
  usage: string
}

const capacityRows = computed<CapacityRow[]>(() => {
  const capacity = status.value.capacity || {}
  const allocatable = status.value.allocatable || {}
  const usage = nodeMetric.value?.usage
  return [
    {
      label: 'CPU',
      capacity: formatCpu(parseCpu(capacity.cpu)),
      allocatable: formatCpu(parseCpu(allocatable.cpu)),
      usage: usage ? formatCpu(parseCpu(usage.cpu)) : '-',
    },
    {
      label: 'Memory',
      capacity: formatMemory(parseMemory(capacity.memory)),
      allocatable: formatMemory(parseMemory(allocatable.memory)),
      usage: usage ? formatMemory(parseMemory(usage.memory)) : '-',
    },
    {
      label: 'Ephemeral storage',
      capacity: formatMemory(parseMemory(capacity['ephemeral-storage'])),
      allocatable: formatMemory(parseMemory(allocatable['ephemeral-storage'])),
      usage: '-',
    },
    { label: 'Pods', capacity: capacity.pods || '-', allocatable: allocatable.pods || '-', usage: String(relatedPods.value.length) },
  ]
})

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
    <p class="text-muted-foreground text-sm">{{ roles.length ? roles.join(', ') : $t('describe.node.noRoles') }}</p>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.node.statusTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <div class="flex flex-wrap gap-2">
          <Badge v-for="condition in standardConditions" :key="condition.type" :variant="conditionVariant(condition.type, condition.status)">
            {{ condition.type }}
          </Badge>
        </div>
        <div v-if="abnormalConditions.length" class="flex flex-wrap gap-2">
          <Badge v-for="condition in abnormalConditions" :key="condition.type" variant="destructive">
            {{ condition.type }}
          </Badge>
        </div>
        <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span v-if="nodeInfo.kubeletVersion">kubelet {{ nodeInfo.kubeletVersion }}</span>
          <span v-if="nodeInfo.osImage">{{ nodeInfo.osImage }}</span>
          <span v-if="nodeInfo.containerRuntimeVersion">{{ nodeInfo.containerRuntimeVersion }}</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.node.capacityTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.node.capacityDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-4 gap-2 text-sm">
          <div class="text-muted-foreground text-xs uppercase"></div>
          <div class="text-muted-foreground text-xs uppercase">{{ $t('describe.node.capacity') }}</div>
          <div class="text-muted-foreground text-xs uppercase">{{ $t('describe.node.allocatable') }}</div>
          <div class="text-muted-foreground text-xs uppercase">{{ $t('describe.node.usage') }}</div>
          <template v-for="row in capacityRows" :key="row.label">
            <div class="font-medium">{{ row.label }}</div>
            <div>{{ row.capacity }}</div>
            <div>{{ row.allocatable }}</div>
            <div>{{ row.usage }}</div>
          </template>
        </div>
        <p v-if="store.nodeMetricsStatus === 'unavailable'" class="text-muted-foreground mt-2 text-xs">{{ $t('usage.unavailableTitle') }}</p>
      </CardContent>
    </Card>

    <Card v-if="spec.taints?.length">
      <CardHeader>
        <CardTitle class="text-sm">Taints</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-2">
        <Badge v-for="(taint, i) in spec.taints" :key="i" variant="outline" class="font-mono">
          {{ taint.key }}{{ taint.value ? `=${taint.value}` : '' }}:{{ taint.effect }}
        </Badge>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.node.labelsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex min-w-0 flex-wrap gap-2">
        <Badge
          v-for="[key, value] in Object.entries(labels)"
          :key="key"
          variant="secondary"
          class="max-w-full whitespace-normal break-all font-mono"
        >
          {{ key }}={{ value }}
        </Badge>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.node.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.node.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.node.noPodsDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="pod in relatedPods"
          :key="`${pod.metadata.namespace}/${pod.metadata.name}`"
          type="button"
          class="@container flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToPod(pod)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ContainerIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ pod.metadata.namespace }}/{{ pod.metadata.name }}</span>
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
  </div>
</template>
