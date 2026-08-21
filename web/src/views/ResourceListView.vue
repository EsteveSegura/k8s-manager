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
import { InboxIcon, RefreshCwIcon, XIcon, ArrowLeftIcon } from '@lucide/vue'
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
}

async function refreshNow() {
  try {
    await store.loadResources(context.value, { force: true })
  } catch {
    // el error se muestra vía store.resourcesError
  }
  store.loadMetrics(context.value, { force: true })
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

const filteredItems = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  if (!text) return items.value
  return items.value.filter((item: any) => {
    const haystack = `${item.metadata?.namespace}/${item.metadata?.name}`.toLowerCase()
    return haystack.includes(text)
  })
})

function isSelected(item: any) {
  return (
    store.selectedResource?.kind === props.kind &&
    store.selectedResource?.namespace === item.metadata?.namespace &&
    store.selectedResource?.name === item.metadata?.name
  )
}

function selectRow(item: any) {
  router.push(`/${context.value}/${props.kind}/${item.metadata.namespace}/${item.metadata.name}`)
}

function deploymentReady(item: any) {
  const ready = item.status?.readyReplicas || 0
  const desired = item.spec?.replicas ?? 0
  return `${ready}/${desired}`
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
          <ResizablePanel :default-size="60" :min-size="30" class="min-w-0">
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
                    <TableHead v-if="kind === 'deployments'">{{ $t('resourceList.columns.replicas') }}</TableHead>
                    <TableHead v-if="kind === 'services'">{{ $t('resourceList.columns.type') }}</TableHead>
                    <TableHead v-if="kind === 'services'">{{ $t('resourceList.columns.ports') }}</TableHead>
                    <TableHead v-if="kind === 'pods'">{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead v-if="kind === 'pods'">{{ $t('resourceList.columns.node') }}</TableHead>
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
                    <TableCell class="text-muted-foreground">{{ item.metadata.namespace }}</TableCell>
                    <TableCell class="font-medium">{{ item.metadata.name }}</TableCell>
                    <TableCell v-if="kind === 'deployments'">{{ deploymentReady(item) }}</TableCell>
                    <TableCell v-if="kind === 'services'">{{ serviceExposure(item).type }}</TableCell>
                    <TableCell v-if="kind === 'services'">{{ serviceExposure(item).ports }}</TableCell>
                    <TableCell v-if="kind === 'pods'">
                      <Badge :variant="podPhaseVariant(podPhase(item))">{{ podPhase(item) }}</Badge>
                    </TableCell>
                    <TableCell v-if="kind === 'pods'" class="text-muted-foreground">{{ item.spec?.nodeName }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ResizablePanel>

          <ResizableHandle with-handle />

          <ResizablePanel :default-size="40" :min-size="25" class="min-w-0">
            <DescribePanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
