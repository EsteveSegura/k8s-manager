<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import DescribePanel from '@/components/describe/DescribePanel.vue'
import NamespaceFilter from '@/components/NamespaceFilter.vue'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { InboxIcon, RefreshCwIcon, XIcon, ArrowLeftIcon, ShieldAlertIcon, ScrollTextIcon, ArrowUpIcon, ArrowDownIcon } from '@lucide/vue'
import { formatDateTime } from '@/lib/format'
import { jobStatusLabel, jobStatusVariant } from '@/lib/job-status'
import { resourcePath } from '@/lib/resource-kinds'
import { parseCpu, parseMemory, formatCpu, formatMemory, percentOf } from '@/lib/k8s-quantities'
import type { ResourceKind } from '@/stores/cluster'

const LOG_CAPABLE_KINDS: ResourceKind[] = ['pods', 'deployments', 'statefulsets', 'daemonsets', 'jobs', 'services']
const NAMESPACE_FILTERABLE_KINDS: ResourceKind[] = [
  'deployments',
  'services',
  'pods',
  'statefulsets',
  'daemonsets',
  'jobs',
  'cronjobs',
  'ingresses',
  'configmaps',
  'secrets',
  'persistentvolumeclaims',
]

const props = defineProps<{ kind: ResourceKind }>()

const store = useClusterStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()

const filterText = computed({
  get: () => store.filterText,
  set: (value: string) => store.setFilterText(value),
})

const context = computed(() => String(route.params.context))

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}

async function ensureLoaded() {
  store.loadNamespaceFilter(context.value)
  try {
    await store.loadResources(context.value)
  } catch {
    // el error se muestra vía store.resourcesError
  }
  store.loadMetrics(context.value)
  store.loadNodeMetrics(context.value)
}

async function refreshNow() {
  try {
    await store.loadResources(context.value, { force: true })
  } catch {
    // el error se muestra vía store.resourcesError
  }
  store.loadMetrics(context.value, { force: true })
  store.loadNodeMetrics(context.value, { force: true })
}

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(refreshNow, () => settings.refreshIntervalMs, {
  immediate: false,
})

watch(
  () => settings.autoRefresh,
  (enabled) => {
    if (enabled) resumeAutoRefresh()
    else pauseAutoRefresh()
  },
  { immediate: true },
)

const lastUpdatedLabel = computed(() => {
  if (!store.lastUpdatedAt) return null
  return new Date(store.lastUpdatedAt).toLocaleTimeString()
})

onMounted(ensureLoaded)
watch(context, ensureLoaded)

watch(
  () => route.params,
  (params) => {
    if (params.namespace && params.name && params.kind) {
      store.selectResource(params.kind as ResourceKind, String(params.namespace), String(params.name))
    }
  },
  { immediate: true },
)

const items = computed(() => store.resourcesByKind(props.kind))
const permissionError = computed(() => store.resourceErrors[props.kind] || null)

const filteredItems = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  return items.value.filter((item: any) => {
    if (!store.isNamespaceVisible(item.metadata?.namespace)) return false
    if (!text) return true
    return String(item.metadata?.name || '').toLowerCase().includes(text)
  })
})

const showNamespaceFilter = computed(() => NAMESPACE_FILTERABLE_KINDS.includes(props.kind))

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

watch(
  () => props.kind,
  () => {
    sortKey.value = null
    sortDir.value = 'asc'
  },
)

function setSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIcon(key: string) {
  if (sortKey.value !== key) return null
  return sortDir.value === 'asc' ? ArrowUpIcon : ArrowDownIcon
}

function compareValues(a: any, b: any): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

function nodeCpuUsageValue(item: any) {
  const metric = store.nodeMetrics[item.metadata?.name]
  return metric ? parseCpu(metric.usage?.cpu) : -1
}

function nodeMemoryUsageValue(item: any) {
  const metric = store.nodeMetrics[item.metadata?.name]
  return metric ? parseMemory(metric.usage?.memory) : -1
}

const sortAccessors = computed<Record<string, (item: any) => any>>(() => {
  const base: Record<string, (item: any) => any> = {
    namespace: (item) => item.metadata?.namespace || '',
    name: (item) => item.metadata?.name || '',
  }
  switch (props.kind) {
    case 'deployments':
    case 'statefulsets':
      return { ...base, replicas: (item) => item.status?.readyReplicas ?? -1 }
    case 'daemonsets':
      return { ...base, ready: (item) => item.status?.numberReady ?? -1 }
    case 'jobs':
      return {
        ...base,
        completions: (item) => item.status?.succeeded ?? -1,
        status: (item) => jobStatusLabel(item),
      }
    case 'cronjobs':
      return {
        ...base,
        schedule: (item) => item.spec?.schedule || '',
        suspended: (item) => (item.spec?.suspend ? 1 : 0),
        lastSchedule: (item) => item.status?.lastScheduleTime || '',
      }
    case 'services':
      return {
        ...base,
        type: (item) => item.spec?.type || '',
        ports: (item) => serviceExposure(item).ports,
      }
    case 'ingresses':
      return {
        ...base,
        hosts: (item) => ingressHostsLabel(item),
        class: (item) => item.spec?.ingressClassName || '',
      }
    case 'pods':
      return {
        ...base,
        status: (item) => podPhase(item),
        node: (item) => item.spec?.nodeName || '',
        created: (item) => item.metadata?.creationTimestamp || '',
      }
    case 'configmaps':
      return { ...base, keys: (item) => configMapKeysCount(item) }
    case 'secrets':
      return {
        ...base,
        type: (item) => item.type || 'Opaque',
        keys: (item) => item.dataKeys?.length || 0,
      }
    case 'persistentvolumeclaims':
      return {
        ...base,
        status: (item) => item.status?.phase || '',
        capacity: (item) => parseMemory(item.status?.capacity?.storage),
        storageClass: (item) => item.spec?.storageClassName || '',
      }
    case 'persistentvolumes':
      return {
        ...base,
        status: (item) => item.status?.phase || '',
        capacity: (item) => parseMemory(item.spec?.capacity?.storage),
        storageClass: (item) => item.spec?.storageClassName || '',
      }
    case 'nodes':
      return {
        ...base,
        status: (item) => (nodeReadyVariant(item) === 'secondary' ? 1 : 0),
        roles: (item) => nodeRoles(item),
        cpu: (item) => nodeCpuUsageValue(item),
        memory: (item) => nodeMemoryUsageValue(item),
        pods: (item) => nodePodCount(item),
      }
    default:
      return base
  }
})

const sortedItems = computed(() => {
  const list = filteredItems.value
  if (!sortKey.value) return list
  const accessor = sortAccessors.value[sortKey.value]
  if (!accessor) return list
  const sorted = [...list].sort((a, b) => compareValues(accessor(a), accessor(b)))
  return sortDir.value === 'desc' ? sorted.reverse() : sorted
})

function isSelected(item: any) {
  return (
    store.selectedResource?.kind === props.kind &&
    store.selectedResource?.name === item.metadata?.name &&
    (item.metadata?.namespace == null || store.selectedResource?.namespace === item.metadata?.namespace)
  )
}

function selectRow(item: any) {
  router.push(resourcePath(context.value, props.kind, item.metadata.namespace, item.metadata.name))
}

function closeDescribePanel() {
  store.clearSelection()
  router.push({ name: props.kind, params: { context: context.value } })
}

const describePanelRef = ref<InstanceType<typeof DescribePanel> | null>(null)
const canViewLogs = computed(() => !!store.selectedResource && LOG_CAPABLE_KINDS.includes(store.selectedResource.kind))

function openLogs() {
  describePanelRef.value?.openLogs()
}

function readyReplicasLabel(item: any) {
  const ready = item.status?.readyReplicas || 0
  const desired = item.spec?.replicas ?? 0
  return `${ready}/${desired}`
}

function daemonSetReadyLabel(item: any) {
  const ready = item.status?.numberReady || 0
  const desired = item.status?.desiredNumberScheduled || 0
  return `${ready}/${desired}`
}

function jobCompletionsLabel(item: any) {
  const succeeded = item.status?.succeeded || 0
  const completions = item.spec?.completions ?? 1
  return `${succeeded}/${completions}`
}

function cronJobLastScheduleLabel(item: any) {
  return formatDateTime(item.status?.lastScheduleTime) || '-'
}

function ingressHostsLabel(item: any) {
  const hosts = (item.spec?.rules || []).map((rule: any) => rule.host || '*')
  return hosts.length ? hosts.join(', ') : '-'
}

function podPhase(item: any) {
  return item.status?.phase || 'Unknown'
}

function podPhaseVariant(phase: string) {
  if (phase === 'Running') return 'secondary'
  if (phase === 'Pending') return 'outline'
  return 'destructive'
}

function serviceExposure(item: any) {
  const type = item.spec?.type || 'ClusterIP'
  const ports = (item.spec?.ports || []).map((p: any) => p.port).join(', ')
  return { type, ports }
}

function configMapKeysCount(item: any) {
  return Object.keys(item.data || {}).length + Object.keys(item.binaryData || {}).length
}

function pvcPhaseVariant(phase: string) {
  if (phase === 'Bound') return 'secondary'
  if (phase === 'Pending') return 'outline'
  return 'destructive'
}

function pvPhaseVariant(phase: string) {
  if (phase === 'Bound' || phase === 'Available') return 'secondary'
  if (phase === 'Released') return 'outline'
  return 'destructive'
}

function nodeReadyVariant(item: any) {
  const ready = (item.status?.conditions || []).find((c: any) => c.type === 'Ready')
  return ready?.status === 'True' ? 'secondary' : 'destructive'
}

function nodeRoles(item: any) {
  const labels = item.metadata?.labels || {}
  const roles = Object.keys(labels)
    .filter((key) => key.startsWith('node-role.kubernetes.io/'))
    .map((key) => key.replace('node-role.kubernetes.io/', ''))
  return roles.length ? roles.join(', ') : '-'
}

function nodePodCount(item: any) {
  const nodeName = item.metadata?.name
  return store.pods.filter((pod: any) => pod.spec?.nodeName === nodeName).length
}

function nodeCpuLabel(item: any) {
  const metric = store.nodeMetrics[item.metadata?.name]
  if (!metric) return '-'
  const usage = parseCpu(metric.usage?.cpu)
  const allocatable = parseCpu(item.status?.allocatable?.cpu)
  const percent = percentOf(usage, allocatable)
  return percent === null ? formatCpu(usage) : `${formatCpu(usage)} (${percent}%)`
}

function nodeMemoryLabel(item: any) {
  const metric = store.nodeMetrics[item.metadata?.name]
  if (!metric) return '-'
  const usage = parseMemory(metric.usage?.memory)
  const allocatable = parseMemory(item.status?.allocatable?.memory)
  const percent = percentOf(usage, allocatable)
  return percent === null ? formatMemory(usage) : `${formatMemory(usage)} (${percent}%)`
}
</script>

<template>
      <header class="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" :aria-label="$t('common.changeCluster')" @click="changeCluster">
          <ArrowLeftIcon />
        </Button>
        <Separator orientation="vertical" class="my-2" />
        <AppBreadcrumb />
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 min-h-0">
        <div class="@container flex min-w-0 flex-wrap items-center gap-3">
          <InputGroup class="max-w-sm">
            <InputGroupInput v-model="filterText" :placeholder="$t('resourceList.filterPlaceholder')" />
            <InputGroupAddon v-if="filterText" align="inline-end">
              <InputGroupButton size="icon-xs" :aria-label="$t('common.clearFilter')" @click="filterText = ''">
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <Button variant="outline" size="sm" class="hidden shrink-0 @lg:inline-flex" :disabled="store.isRefreshing" @click="refreshNow">
            <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': store.isRefreshing }" />
            {{ $t('common.refresh') }}
          </Button>

          <span v-if="settings.autoRefresh" class="hidden shrink-0 text-xs text-muted-foreground @xl:inline">
            {{ $t('common.autoRefreshActive') }}
          </span>

          <span v-if="lastUpdatedLabel" class="hidden shrink-0 text-xs text-muted-foreground @2xl:inline">
            {{ $t('common.updatedAt', { time: lastUpdatedLabel }) }}
          </span>

          <NamespaceFilter v-if="showNamespaceFilter" />
        </div>

        <ResizablePanelGroup direction="horizontal" class="flex-1 rounded-lg border min-h-0">
          <ResizablePanel :default-size="store.selectedResource ? 60 : 100" :min-size="30" class="min-w-0">
            <div class="h-full min-w-0 overflow-auto">
              <template v-if="store.resourcesStatus === 'loading'">
                <div class="flex flex-col gap-2 p-4">
                  <Skeleton class="h-10 w-full" v-for="i in 8" :key="i" />
                </div>
              </template>

              <Empty v-else-if="store.resourcesStatus === 'error'">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('resourceList.loadErrorTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ store.resourcesError }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Empty v-else-if="permissionError">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><ShieldAlertIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('resourceList.permissionErrorTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ permissionError }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Empty v-else-if="filteredItems.length === 0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('resourceList.emptyTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ $t('resourceList.emptyDescription') }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead class="cursor-pointer select-none hover:text-foreground" @click="setSort('namespace')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.namespace') }}<component :is="sortIcon('namespace')" v-if="sortIcon('namespace')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead class="cursor-pointer select-none hover:text-foreground" @click="setSort('name')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.name') }}<component :is="sortIcon('name')" v-if="sortIcon('name')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'deployments' || kind === 'statefulsets'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('replicas')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.replicas') }}<component :is="sortIcon('replicas')" v-if="sortIcon('replicas')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'daemonsets'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('ready')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.ready') }}<component :is="sortIcon('ready')" v-if="sortIcon('ready')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'jobs'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('completions')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.completions') }}<component :is="sortIcon('completions')" v-if="sortIcon('completions')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'jobs'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('status')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.status') }}<component :is="sortIcon('status')" v-if="sortIcon('status')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'cronjobs'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('schedule')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.schedule') }}<component :is="sortIcon('schedule')" v-if="sortIcon('schedule')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'cronjobs'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('suspended')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.suspended') }}<component :is="sortIcon('suspended')" v-if="sortIcon('suspended')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'cronjobs'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('lastSchedule')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.lastSchedule') }}<component :is="sortIcon('lastSchedule')" v-if="sortIcon('lastSchedule')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'services'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('type')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.type') }}<component :is="sortIcon('type')" v-if="sortIcon('type')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'services'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('ports')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.ports') }}<component :is="sortIcon('ports')" v-if="sortIcon('ports')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'ingresses'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('hosts')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.hosts') }}<component :is="sortIcon('hosts')" v-if="sortIcon('hosts')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'ingresses'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('class')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.class') }}<component :is="sortIcon('class')" v-if="sortIcon('class')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'pods'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('status')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.status') }}<component :is="sortIcon('status')" v-if="sortIcon('status')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'pods'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('node')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.node') }}<component :is="sortIcon('node')" v-if="sortIcon('node')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'pods'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('created')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.created') }}<component :is="sortIcon('created')" v-if="sortIcon('created')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'configmaps'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('keys')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.keys') }}<component :is="sortIcon('keys')" v-if="sortIcon('keys')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'secrets'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('type')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.type') }}<component :is="sortIcon('type')" v-if="sortIcon('type')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'secrets'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('keys')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.keys') }}<component :is="sortIcon('keys')" v-if="sortIcon('keys')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('status')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.status') }}<component :is="sortIcon('status')" v-if="sortIcon('status')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('capacity')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.capacity') }}<component :is="sortIcon('capacity')" v-if="sortIcon('capacity')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('storageClass')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.storageClass') }}<component :is="sortIcon('storageClass')" v-if="sortIcon('storageClass')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('status')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.status') }}<component :is="sortIcon('status')" v-if="sortIcon('status')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('capacity')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.capacity') }}<component :is="sortIcon('capacity')" v-if="sortIcon('capacity')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('storageClass')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.storageClass') }}<component :is="sortIcon('storageClass')" v-if="sortIcon('storageClass')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'nodes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('status')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.status') }}<component :is="sortIcon('status')" v-if="sortIcon('status')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'nodes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('roles')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.roles') }}<component :is="sortIcon('roles')" v-if="sortIcon('roles')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'nodes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('cpu')">
                      <span class="inline-flex items-center gap-1">CPU<component :is="sortIcon('cpu')" v-if="sortIcon('cpu')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'nodes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('memory')">
                      <span class="inline-flex items-center gap-1">{{ $t('usage.memory') }}<component :is="sortIcon('memory')" v-if="sortIcon('memory')" class="size-3.5" /></span>
                    </TableHead>
                    <TableHead v-if="kind === 'nodes'" class="cursor-pointer select-none hover:text-foreground" @click="setSort('pods')">
                      <span class="inline-flex items-center gap-1">{{ $t('resourceList.columns.pods') }}<component :is="sortIcon('pods')" v-if="sortIcon('pods')" class="size-3.5" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="item in sortedItems"
                    :key="`${item.metadata.namespace}/${item.metadata.name}`"
                    class="cursor-pointer"
                    :data-state="isSelected(item) ? 'selected' : undefined"
                    @click="selectRow(item)"
                  >
                    <TableCell class="text-muted-foreground">{{ item.metadata.namespace || '-' }}</TableCell>
                    <TableCell class="font-medium">{{ item.metadata.name }}</TableCell>
                    <TableCell v-if="kind === 'deployments' || kind === 'statefulsets'">{{ readyReplicasLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'daemonsets'">{{ daemonSetReadyLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'jobs'">{{ jobCompletionsLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'jobs'">
                      <Badge :variant="jobStatusVariant(jobStatusLabel(item))">{{ jobStatusLabel(item) }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'cronjobs'" class="font-mono text-xs">{{ item.spec?.schedule }}</TableCell>
                    <TableCell v-if="kind === 'cronjobs'">
                      <Badge :variant="item.spec?.suspend ? 'destructive' : 'secondary'">
                        {{ item.spec?.suspend ? $t('describe.cronjob.suspended') : $t('describe.cronjob.active') }}
                      </Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'cronjobs'" class="text-muted-foreground">{{ cronJobLastScheduleLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'services'">{{ serviceExposure(item).type }}</TableCell>
                    <TableCell v-if="kind === 'services'">{{ serviceExposure(item).ports }}</TableCell>
                    <TableCell v-if="kind === 'ingresses'" class="text-muted-foreground">{{ ingressHostsLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'ingresses'">{{ item.spec?.ingressClassName || '-' }}</TableCell>
                    <TableCell v-if="kind === 'pods'">
                      <Badge :variant="podPhaseVariant(podPhase(item))">{{ podPhase(item) }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'pods'" class="text-muted-foreground">{{ item.spec?.nodeName }}</TableCell>
                    <TableCell v-if="kind === 'pods'" class="text-muted-foreground whitespace-nowrap">{{ formatDateTime(item.metadata?.creationTimestamp) || '-' }}</TableCell>
                    <TableCell v-if="kind === 'configmaps'">{{ configMapKeysCount(item) }}</TableCell>
                    <TableCell v-if="kind === 'secrets'" class="font-mono text-xs">{{ item.type || 'Opaque' }}</TableCell>
                    <TableCell v-if="kind === 'secrets'">{{ item.dataKeys?.length || 0 }}</TableCell>
                    <TableCell v-if="kind === 'persistentvolumeclaims'">
                      <Badge :variant="pvcPhaseVariant(item.status?.phase)">{{ item.status?.phase || 'Unknown' }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'persistentvolumeclaims'">{{ item.status?.capacity?.storage || '-' }}</TableCell>
                    <TableCell v-if="kind === 'persistentvolumeclaims'" class="text-muted-foreground">{{ item.spec?.storageClassName || '-' }}</TableCell>
                    <TableCell v-if="kind === 'persistentvolumes'">
                      <Badge :variant="pvPhaseVariant(item.status?.phase)">{{ item.status?.phase || 'Unknown' }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'persistentvolumes'">{{ item.spec?.capacity?.storage || '-' }}</TableCell>
                    <TableCell v-if="kind === 'persistentvolumes'" class="text-muted-foreground">{{ item.spec?.storageClassName || '-' }}</TableCell>
                    <TableCell v-if="kind === 'nodes'">
                      <Badge :variant="nodeReadyVariant(item)">{{ nodeReadyVariant(item) === 'secondary' ? 'Ready' : 'NotReady' }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'nodes'" class="text-muted-foreground">{{ nodeRoles(item) }}</TableCell>
                    <TableCell v-if="kind === 'nodes'" class="text-muted-foreground">{{ nodeCpuLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'nodes'" class="text-muted-foreground">{{ nodeMemoryLabel(item) }}</TableCell>
                    <TableCell v-if="kind === 'nodes'">{{ nodePodCount(item) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ResizablePanel>

          <template v-if="store.selectedResource">
            <ResizableHandle with-handle />

            <ResizablePanel :default-size="40" :min-size="25" class="flex min-w-0 min-h-0 flex-col">
              <div class="flex shrink-0 items-center justify-between gap-2 border-b p-2">
                <span class="min-w-0 truncate text-sm font-medium">{{ store.selectedResource?.name }}</span>
                <div class="flex shrink-0 items-center gap-1">
                  <Button v-if="canViewLogs" variant="ghost" size="sm" @click="openLogs">
                    <ScrollTextIcon data-icon="inline-start" />
                    {{ $t('describe.viewLogs') }}
                  </Button>
                  <Button variant="ghost" size="icon-sm" :aria-label="$t('common.close')" @click="closeDescribePanel">
                    <XIcon />
                  </Button>
                </div>
              </div>
              <div class="min-h-0 flex-1">
                <DescribePanel ref="describePanelRef" />
              </div>
            </ResizablePanel>
          </template>
        </ResizablePanelGroup>
      </div>
</template>
