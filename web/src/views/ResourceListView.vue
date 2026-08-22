<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import AppSidebar from '@/components/AppSidebar.vue'
import AppBreadcrumb from '@/components/AppBreadcrumb.vue'
import DescribePanel from '@/components/describe/DescribePanel.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { InboxIcon, RefreshCwIcon, XIcon, ArrowLeftIcon, ShieldAlertIcon } from '@lucide/vue'
import { formatDateTime } from '@/lib/format'
import { jobStatusLabel, jobStatusVariant } from '@/lib/job-status'
import { resourcePath } from '@/lib/resource-kinds'
import { parseCpu, parseMemory, formatCpu, formatMemory, percentOf } from '@/lib/k8s-quantities'
import type { ResourceKind } from '@/stores/cluster'

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
  if (!text) return items.value
  return items.value.filter((item: any) => {
    const namespace = item.metadata?.namespace
    const haystack = `${namespace ? namespace + '/' : ''}${item.metadata?.name}`.toLowerCase()
    return haystack.includes(text)
  })
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
  <SidebarProvider class="h-svh">
    <AppSidebar />
    <SidebarInset class="min-w-0 min-h-0">
      <header class="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" :aria-label="$t('common.changeCluster')" @click="changeCluster">
          <ArrowLeftIcon />
        </Button>
        <Separator orientation="vertical" class="my-2" />
        <AppBreadcrumb />
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 min-h-0">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <InputGroup class="max-w-sm">
            <InputGroupInput v-model="filterText" :placeholder="$t('resourceList.filterPlaceholder')" />
            <InputGroupAddon v-if="filterText" align="inline-end">
              <InputGroupButton size="icon-xs" :aria-label="$t('common.clearFilter')" @click="filterText = ''">
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <Button variant="outline" size="sm" :disabled="store.isRefreshing" @click="refreshNow">
            <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': store.isRefreshing }" />
            {{ $t('common.refresh') }}
          </Button>

          <span v-if="settings.autoRefresh" class="shrink-0 text-xs text-muted-foreground">
            {{ $t('common.autoRefreshActive') }}
          </span>

          <span v-if="lastUpdatedLabel" class="shrink-0 text-xs text-muted-foreground">
            {{ $t('common.updatedAt', { time: lastUpdatedLabel }) }}
          </span>
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
                    <TableHead>Namespace</TableHead>
                    <TableHead>{{ $t('resourceList.columns.name') }}</TableHead>
                    <TableHead v-if="kind === 'deployments' || kind === 'statefulsets'">{{ $t('resourceList.columns.replicas') }}</TableHead>
                    <TableHead v-if="kind === 'daemonsets'">{{ $t('resourceList.columns.ready') }}</TableHead>
                    <TableHead v-if="kind === 'jobs'">{{ $t('resourceList.columns.completions') }}</TableHead>
                    <TableHead v-if="kind === 'jobs'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'cronjobs'">{{ $t('resourceList.columns.schedule') }}</TableHead>
                    <TableHead v-if="kind === 'cronjobs'">{{ $t('resourceList.columns.suspended') }}</TableHead>
                    <TableHead v-if="kind === 'cronjobs'">{{ $t('resourceList.columns.lastSchedule') }}</TableHead>
                    <TableHead v-if="kind === 'services'">{{ $t('resourceList.columns.type') }}</TableHead>
                    <TableHead v-if="kind === 'services'">{{ $t('resourceList.columns.ports') }}</TableHead>
                    <TableHead v-if="kind === 'ingresses'">{{ $t('resourceList.columns.hosts') }}</TableHead>
                    <TableHead v-if="kind === 'ingresses'">{{ $t('resourceList.columns.class') }}</TableHead>
                    <TableHead v-if="kind === 'pods'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'pods'">{{ $t('resourceList.columns.node') }}</TableHead>
                    <TableHead v-if="kind === 'pods'">{{ $t('resourceList.columns.created') }}</TableHead>
                    <TableHead v-if="kind === 'configmaps'">{{ $t('resourceList.columns.keys') }}</TableHead>
                    <TableHead v-if="kind === 'secrets'">{{ $t('resourceList.columns.type') }}</TableHead>
                    <TableHead v-if="kind === 'secrets'">{{ $t('resourceList.columns.keys') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'">{{ $t('resourceList.columns.capacity') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumeclaims'">{{ $t('resourceList.columns.storageClass') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'">{{ $t('resourceList.columns.capacity') }}</TableHead>
                    <TableHead v-if="kind === 'persistentvolumes'">{{ $t('resourceList.columns.storageClass') }}</TableHead>
                    <TableHead v-if="kind === 'nodes'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'nodes'">{{ $t('resourceList.columns.roles') }}</TableHead>
                    <TableHead v-if="kind === 'nodes'">CPU</TableHead>
                    <TableHead v-if="kind === 'nodes'">{{ $t('usage.memory') }}</TableHead>
                    <TableHead v-if="kind === 'nodes'">{{ $t('resourceList.columns.pods') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="item in filteredItems"
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
                <Button variant="ghost" size="icon-sm" :aria-label="$t('common.close')" @click="closeDescribePanel">
                  <XIcon />
                </Button>
              </div>
              <div class="min-h-0 flex-1">
                <DescribePanel />
              </div>
            </ResizablePanel>
          </template>
        </ResizablePanelGroup>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
