<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { InboxIcon, ArrowLeftIcon, XIcon, CodeIcon, RefreshCwIcon } from '@lucide/vue'

interface CrdVersion {
  name: string
  served: boolean
  storage: boolean
}

interface CrdItem {
  metadata: { name: string }
  spec: {
    group: string
    scope: 'Namespaced' | 'Cluster'
    names: { kind: string; plural: string; singular: string; shortNames?: string[] }
    versions: CrdVersion[]
  }
}

const store = useClusterStore()
const route = useRoute()
const router = useRouter()

const context = computed(() => String(route.params.context))

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}

const crds = ref<CrdItem[]>([])
const crdsStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const crdsError = ref('')
const filterText = ref('')

async function loadCrds() {
  crdsStatus.value = 'loading'
  try {
    const res = await fetch(`/api/${encodeURIComponent(context.value)}/crds`)
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const data = await res.json()
    crds.value = data.items
    crdsStatus.value = 'ready'
  } catch (err: any) {
    crdsError.value = err.message
    crdsStatus.value = 'error'
  }
}

onMounted(loadCrds)
watch(context, loadCrds)

const filteredCrds = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  if (!text) return crds.value
  return crds.value.filter((crd) => {
    const haystack = `${crd.spec.names.kind} ${crd.spec.group} ${crd.spec.names.plural}`.toLowerCase()
    return haystack.includes(text)
  })
})

function storageVersion(crd: CrdItem) {
  return (crd.spec.versions.find((v) => v.storage) || crd.spec.versions[0])?.name
}

const selectedCrd = ref<CrdItem | null>(null)
const instances = ref<any[]>([])
const instancesStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const instancesError = ref('')

async function loadInstances(crd: CrdItem) {
  instancesStatus.value = 'loading'
  instancesError.value = ''
  try {
    const version = storageVersion(crd)
    const res = await fetch(
      `/api/${encodeURIComponent(context.value)}/crds/${crd.spec.group}/${version}/${crd.spec.names.plural}/instances`,
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Error ${res.status}`)
    }
    const data = await res.json()
    instances.value = data.items || []
    instancesStatus.value = 'ready'
  } catch (err: any) {
    instancesError.value = err.message
    instancesStatus.value = 'error'
  }
}

function selectCrd(crd: CrdItem) {
  selectedCrd.value = crd
  instances.value = []
  loadInstances(crd)
}

function isSelected(crd: CrdItem) {
  return selectedCrd.value?.metadata.name === crd.metadata.name
}

function closeCrdPanel() {
  selectedCrd.value = null
  instances.value = []
}

const rawViewerOpen = ref(false)
const rawViewerTitle = ref('')
const rawViewerContent = ref('')

function viewRaw(instance: any) {
  const namespace = instance.metadata?.namespace
  rawViewerTitle.value = namespace ? `${namespace}/${instance.metadata?.name}` : instance.metadata?.name
  rawViewerContent.value = JSON.stringify(instance, null, 2)
  rawViewerOpen.value = true
}
</script>

<template>
      <header class="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" :aria-label="$t('common.changeCluster')" @click="changeCluster">
          <ArrowLeftIcon />
        </Button>
        <Separator orientation="vertical" class="my-2" />
        <span class="text-sm font-medium">{{ context }}</span>
        <span class="text-muted-foreground text-sm">/</span>
        <span class="text-sm font-medium">{{ $t('crds.title') }}</span>
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 min-h-0">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <InputGroup class="max-w-sm">
            <InputGroupInput v-model="filterText" :placeholder="$t('crds.filterPlaceholder')" />
            <InputGroupAddon v-if="filterText" align="inline-end">
              <InputGroupButton size="icon-xs" :aria-label="$t('common.clearFilter')" @click="filterText = ''">
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" size="sm" :disabled="crdsStatus === 'loading'" @click="loadCrds">
            <RefreshCwIcon data-icon="inline-start" />
            {{ $t('common.refresh') }}
          </Button>
        </div>

        <ResizablePanelGroup direction="horizontal" class="flex-1 rounded-lg border min-h-0">
          <ResizablePanel :default-size="selectedCrd ? 55 : 100" :min-size="30" class="min-w-0">
            <div class="h-full min-w-0 overflow-auto">
              <template v-if="crdsStatus === 'loading'">
                <div class="flex flex-col gap-2 p-4">
                  <Skeleton class="h-10 w-full" v-for="i in 8" :key="i" />
                </div>
              </template>

              <Empty v-else-if="crdsStatus === 'error'">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('crds.loadErrorTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ crdsError }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Empty v-else-if="filteredCrds.length === 0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('resourceList.emptyTitle') }}</EmptyTitle>
                </EmptyHeader>
              </Empty>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>{{ $t('crds.columns.scope') }}</TableHead>
                    <TableHead>{{ $t('crds.columns.versions') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="crd in filteredCrds"
                    :key="crd.metadata.name"
                    class="cursor-pointer"
                    :data-state="isSelected(crd) ? 'selected' : undefined"
                    @click="selectCrd(crd)"
                  >
                    <TableCell class="font-medium">{{ crd.spec.names.kind }}</TableCell>
                    <TableCell class="text-muted-foreground font-mono text-xs">{{ crd.spec.group }}</TableCell>
                    <TableCell><Badge variant="outline">{{ crd.spec.scope }}</Badge></TableCell>
                    <TableCell class="text-muted-foreground">{{ crd.spec.versions.map((v) => v.name).join(', ') }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ResizablePanel>

          <template v-if="selectedCrd">
            <ResizableHandle with-handle />

            <ResizablePanel :default-size="45" :min-size="25" class="flex min-w-0 min-h-0 flex-col">
              <div class="flex shrink-0 items-center justify-between gap-2 border-b p-2">
                <span class="min-w-0 truncate text-sm font-medium">{{ selectedCrd.spec.names.kind }}</span>
                <Button variant="ghost" size="icon-sm" :aria-label="$t('common.close')" @click="closeCrdPanel">
                  <XIcon />
                </Button>
              </div>
              <ScrollArea class="min-h-0 flex-1">
                <div class="flex flex-col gap-3 p-4">
                  <p class="text-muted-foreground font-mono text-xs">{{ selectedCrd.spec.group }}/{{ storageVersion(selectedCrd) }}</p>

                  <Skeleton v-if="instancesStatus === 'loading'" class="h-40 w-full" />

                  <Empty v-else-if="instancesStatus === 'error'">
                    <EmptyHeader>
                      <EmptyTitle>{{ $t('crds.instancesErrorTitle') }}</EmptyTitle>
                      <EmptyDescription>{{ instancesError }}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>

                  <Empty v-else-if="instances.length === 0">
                    <EmptyHeader>
                      <EmptyTitle>{{ $t('crds.noInstancesTitle') }}</EmptyTitle>
                      <EmptyDescription>{{ $t('crds.noInstancesDescription') }}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>

                  <template v-else>
                    <button
                      v-for="instance in instances"
                      :key="`${instance.metadata?.namespace}/${instance.metadata?.name}`"
                      type="button"
                      class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
                      @click="viewRaw(instance)"
                    >
                      <div class="flex min-w-0 flex-col">
                        <span class="truncate text-sm font-medium">{{ instance.metadata?.name }}</span>
                        <span v-if="instance.metadata?.namespace" class="text-muted-foreground text-xs">{{ instance.metadata.namespace }}</span>
                      </div>
                      <CodeIcon class="text-muted-foreground size-4 shrink-0" />
                    </button>
                  </template>
                </div>
              </ScrollArea>
            </ResizablePanel>
          </template>
        </ResizablePanelGroup>
      </div>

  <Drawer v-model:open="rawViewerOpen">
    <DrawerContent class="h-[80vh] max-h-[80vh] overflow-hidden">
      <DrawerHeader class="shrink-0">
        <DrawerTitle class="font-mono">{{ rawViewerTitle }}</DrawerTitle>
        <DrawerDescription>{{ $t('crds.rawViewerDescription') }}</DrawerDescription>
      </DrawerHeader>
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div class="relative min-h-0 flex-1" @pointerdown.stop>
          <ScrollArea class="h-full min-w-0 rounded-md border">
            <pre class="p-4 font-mono text-xs whitespace-pre-wrap break-words select-text cursor-text">{{ rawViewerContent }}</pre>
          </ScrollArea>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>
