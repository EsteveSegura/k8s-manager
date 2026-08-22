<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { resourcePath } from '@/lib/resource-kinds'
import { formatDateTime } from '@/lib/format'
import { K8S_KIND_TO_RESOURCE_KIND } from '@/lib/k8s-kind-map'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { InboxIcon, ArrowLeftIcon, XIcon, ShipWheelIcon, RefreshCwIcon } from '@lucide/vue'

interface HelmResourceRef {
  kind: string
  name: string
  namespace: string | null
}

interface HelmRelease {
  name: string
  namespace: string
  revision: number
  status: string
  lastDeployed: string | null
  description: string | null
  chart: string | null
  chartVersion: string | null
  appVersion: string | null
  resources: HelmResourceRef[]
}

const store = useClusterStore()
const route = useRoute()
const router = useRouter()

const context = computed(() => String(route.params.context))

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}

const releases = ref<HelmRelease[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref('')
const filterText = ref('')

async function loadReleases() {
  status.value = 'loading'
  try {
    const res = await fetch(`/api/${encodeURIComponent(context.value)}/helm/releases`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Error ${res.status}`)
    }
    const data = await res.json()
    releases.value = data.items
    status.value = 'ready'
  } catch (err: any) {
    error.value = err.message
    status.value = 'error'
  }
}

onMounted(loadReleases)
watch(context, loadReleases)

const filteredReleases = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  if (!text) return releases.value
  return releases.value.filter((release) => {
    const haystack = `${release.namespace}/${release.name} ${release.chart}`.toLowerCase()
    return haystack.includes(text)
  })
})

const selectedRelease = ref<HelmRelease | null>(null)

function selectRelease(release: HelmRelease) {
  selectedRelease.value = release
}

function isSelected(release: HelmRelease) {
  return selectedRelease.value?.namespace === release.namespace && selectedRelease.value?.name === release.name
}

function statusVariant(value: string) {
  if (value === 'deployed') return 'secondary'
  if (value === 'failed') return 'destructive'
  return 'outline'
}

function findResource(resourceRef: HelmResourceRef) {
  const kind = K8S_KIND_TO_RESOURCE_KIND[resourceRef.kind]
  if (!kind) return null
  const list = store.resourcesByKind(kind)
  return (
    list.find(
      (item: any) =>
        item.metadata?.name === resourceRef.name && (item.metadata?.namespace == null || item.metadata?.namespace === resourceRef.namespace),
    ) || null
  )
}

function goToResource(resourceRef: HelmResourceRef) {
  const kind = K8S_KIND_TO_RESOURCE_KIND[resourceRef.kind]
  if (!kind) return
  router.push(resourcePath(context.value, kind, resourceRef.namespace, resourceRef.name))
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
        <span class="text-sm font-medium">{{ context }}</span>
        <span class="text-muted-foreground text-sm">/</span>
        <span class="text-sm font-medium">{{ $t('helm.title') }}</span>
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 min-h-0">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <InputGroup class="max-w-sm">
            <InputGroupInput v-model="filterText" :placeholder="$t('helm.filterPlaceholder')" />
            <InputGroupAddon v-if="filterText" align="inline-end">
              <InputGroupButton size="icon-xs" :aria-label="$t('common.clearFilter')" @click="filterText = ''">
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" size="sm" :disabled="status === 'loading'" @click="loadReleases">
            <RefreshCwIcon data-icon="inline-start" />
            {{ $t('common.refresh') }}
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" class="flex-1 rounded-lg border min-h-0">
          <ResizablePanel :default-size="60" :min-size="30" class="min-w-0">
            <div class="h-full min-w-0 overflow-auto">
              <template v-if="status === 'loading'">
                <div class="flex flex-col gap-2 p-4">
                  <Skeleton class="h-10 w-full" v-for="i in 8" :key="i" />
                </div>
              </template>

              <Empty v-else-if="status === 'error'">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('helm.loadErrorTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ error }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Empty v-else-if="filteredReleases.length === 0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('resourceList.emptyTitle') }}</EmptyTitle>
                </EmptyHeader>
              </Empty>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namespace</TableHead>
                    <TableHead>{{ $t('resourceList.columns.name') }}</TableHead>
                    <TableHead>Chart</TableHead>
                    <TableHead>{{ $t('helm.columns.appVersion') }}</TableHead>
                    <TableHead>{{ $t('resourceList.columns.status') }}</TableHead>
                    <TableHead>{{ $t('helm.columns.revision') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="release in filteredReleases"
                    :key="`${release.namespace}/${release.name}`"
                    class="cursor-pointer"
                    :data-state="isSelected(release) ? 'selected' : undefined"
                    @click="selectRelease(release)"
                  >
                    <TableCell class="text-muted-foreground">{{ release.namespace }}</TableCell>
                    <TableCell class="font-medium">{{ release.name }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ release.chart }}-{{ release.chartVersion }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ release.appVersion || '-' }}</TableCell>
                    <TableCell><Badge :variant="statusVariant(release.status)">{{ release.status }}</Badge></TableCell>
                    <TableCell>{{ release.revision }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ResizablePanel>

          <ResizableHandle with-handle />

          <ResizablePanel :default-size="40" :min-size="25" class="min-w-0">
            <ScrollArea class="h-full">
              <div class="p-4">
                <Empty v-if="!selectedRelease">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ShipWheelIcon /></EmptyMedia>
                    <EmptyTitle>{{ $t('helm.emptyTitle') }}</EmptyTitle>
                    <EmptyDescription>{{ $t('helm.emptyDescription') }}</EmptyDescription>
                  </EmptyHeader>
                </Empty>

                <div v-else class="flex flex-col gap-4">
                  <div>
                    <h2 class="text-lg font-semibold">{{ selectedRelease.name }}</h2>
                    <p class="text-muted-foreground text-sm">{{ selectedRelease.namespace }}</p>
                  </div>

                  <div class="flex flex-wrap items-center gap-4 text-sm">
                    <Badge :variant="statusVariant(selectedRelease.status)">{{ selectedRelease.status }}</Badge>
                    <div><span class="text-muted-foreground">{{ $t('helm.columns.revision') }}: </span>{{ selectedRelease.revision }}</div>
                    <div v-if="formatDateTime(selectedRelease.lastDeployed)">
                      <span class="text-muted-foreground">{{ $t('helm.lastDeployed') }}: </span>{{ formatDateTime(selectedRelease.lastDeployed) }}
                    </div>
                  </div>

                  <p v-if="selectedRelease.description" class="text-muted-foreground text-sm">{{ selectedRelease.description }}</p>

                  <div>
                    <h3 class="mb-2 text-sm font-medium">{{ $t('helm.resourcesTitle') }}</h3>
                    <div class="flex flex-col gap-2">
                      <Empty v-if="selectedRelease.resources.length === 0">
                        <EmptyHeader>
                          <EmptyTitle>{{ $t('helm.noResourcesTitle') }}</EmptyTitle>
                        </EmptyHeader>
                      </Empty>
                      <template v-for="(resourceRef, i) in selectedRelease.resources" :key="i">
                        <button
                          v-if="findResource(resourceRef)"
                          type="button"
                          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-accent"
                          @click="goToResource(resourceRef)"
                        >
                          <span class="min-w-0 truncate">{{ resourceRef.namespace ? `${resourceRef.namespace}/${resourceRef.name}` : resourceRef.name }}</span>
                          <Badge variant="outline" class="shrink-0">{{ resourceRef.kind }}</Badge>
                        </button>
                        <div v-else class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-sm opacity-70">
                          <span class="min-w-0 truncate">{{ resourceRef.namespace ? `${resourceRef.namespace}/${resourceRef.name}` : resourceRef.name }}</span>
                          <Badge variant="outline" class="shrink-0">{{ resourceRef.kind }}</Badge>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
