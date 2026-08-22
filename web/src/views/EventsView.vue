<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import { K8S_KIND_TO_RESOURCE_KIND } from '@/lib/k8s-kind-map'
import { resourcePath } from '@/lib/resource-kinds'
import { formatDateTime } from '@/lib/format'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { InboxIcon, ArrowLeftIcon, XIcon, RefreshCwIcon } from '@lucide/vue'

interface K8sEvent {
  metadata: { namespace: string; name: string; creationTimestamp?: string }
  type: string
  reason: string
  message: string
  count?: number
  firstTimestamp?: string | null
  lastTimestamp?: string | null
  eventTime?: string | null
  involvedObject: { kind: string; name: string; namespace?: string }
}

const store = useClusterStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()

const context = computed(() => String(route.params.context))

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}

const events = ref<K8sEvent[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref('')
const filterText = ref('')
const namespaceFilter = ref('all')
const typeFilter = ref('all')

async function loadEvents() {
  status.value = 'loading'
  try {
    const res = await fetch(`/api/${encodeURIComponent(context.value)}/events`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Error ${res.status}`)
    }
    const data = await res.json()
    events.value = data.items
    status.value = 'ready'
  } catch (err: any) {
    error.value = err.message
    status.value = 'error'
  }
}

onMounted(loadEvents)
watch(context, loadEvents)

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(loadEvents, () => settings.refreshIntervalMs, {
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

function eventTimestamp(event: K8sEvent) {
  return event.lastTimestamp || event.eventTime || event.metadata.creationTimestamp || null
}

const namespaces = computed(() => {
  const set = new Set<string>()
  for (const event of events.value) {
    if (event.involvedObject.namespace) set.add(event.involvedObject.namespace)
  }
  return [...set].sort()
})

const sortedEvents = computed(() =>
  [...events.value].sort((a, b) => new Date(eventTimestamp(b) || 0).getTime() - new Date(eventTimestamp(a) || 0).getTime()),
)

const filteredEvents = computed(() =>
  sortedEvents.value.filter((event) => {
    if (namespaceFilter.value !== 'all' && event.involvedObject.namespace !== namespaceFilter.value) return false
    if (typeFilter.value !== 'all' && event.type !== typeFilter.value) return false
    const text = filterText.value.trim().toLowerCase()
    if (!text) return true
    const haystack = `${event.involvedObject.kind} ${event.involvedObject.name} ${event.reason} ${event.message}`.toLowerCase()
    return haystack.includes(text)
  }),
)

function findResource(event: K8sEvent) {
  const kind = K8S_KIND_TO_RESOURCE_KIND[event.involvedObject.kind]
  if (!kind) return null
  const list = store.resourcesByKind(kind)
  return (
    list.find(
      (item: any) =>
        item.metadata?.name === event.involvedObject.name &&
        (item.metadata?.namespace == null || item.metadata?.namespace === event.involvedObject.namespace),
    ) || null
  )
}

function goToObject(event: K8sEvent) {
  const kind = K8S_KIND_TO_RESOURCE_KIND[event.involvedObject.kind]
  if (!kind) return
  router.push(resourcePath(context.value, kind, event.involvedObject.namespace, event.involvedObject.name))
}

function typeVariant(type: string) {
  return type === 'Warning' ? 'destructive' : 'secondary'
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
        <span class="text-sm font-medium">{{ $t('events.title') }}</span>
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-3 p-4 min-h-0">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <InputGroup class="max-w-sm">
            <InputGroupInput v-model="filterText" :placeholder="$t('events.filterPlaceholder')" />
            <InputGroupAddon v-if="filterText" align="inline-end">
              <InputGroupButton size="icon-xs" :aria-label="$t('common.clearFilter')" @click="filterText = ''">
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <Select v-model="namespaceFilter">
            <SelectTrigger class="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{{ $t('events.allNamespaces') }}</SelectItem>
                <SelectItem v-for="namespace in namespaces" :key="namespace" :value="namespace">{{ namespace }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select v-model="typeFilter">
            <SelectTrigger class="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{{ $t('events.allTypes') }}</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" :disabled="status === 'loading'" @click="loadEvents">
            <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': status === 'loading' }" />
            {{ $t('common.refresh') }}
          </Button>

          <span v-if="settings.autoRefresh" class="shrink-0 text-xs text-muted-foreground">
            {{ $t('common.autoRefreshActive') }}
          </span>
        </div>

        <div class="min-w-0 flex-1 overflow-auto rounded-lg border">
          <template v-if="status === 'loading' && events.length === 0">
            <div class="flex flex-col gap-2 p-4">
              <Skeleton class="h-10 w-full" v-for="i in 8" :key="i" />
            </div>
          </template>

          <Empty v-else-if="status === 'error'">
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>{{ $t('events.loadErrorTitle') }}</EmptyTitle>
              <EmptyDescription>{{ error }}</EmptyDescription>
            </EmptyHeader>
          </Empty>

          <Empty v-else-if="filteredEvents.length === 0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>{{ $t('resourceList.emptyTitle') }}</EmptyTitle>
            </EmptyHeader>
          </Empty>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>{{ $t('events.columns.lastSeen') }}</TableHead>
                <TableHead>{{ $t('resourceList.columns.type') }}</TableHead>
                <TableHead>{{ $t('events.columns.object') }}</TableHead>
                <TableHead>{{ $t('events.columns.reason') }}</TableHead>
                <TableHead>{{ $t('events.columns.message') }}</TableHead>
                <TableHead>{{ $t('events.columns.count') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(event, i) in filteredEvents" :key="`${event.metadata.namespace}/${event.metadata.name}-${i}`">
                <TableCell class="text-muted-foreground whitespace-nowrap text-xs">{{ formatDateTime(eventTimestamp(event)) || '-' }}</TableCell>
                <TableCell><Badge :variant="typeVariant(event.type)">{{ event.type }}</Badge></TableCell>
                <TableCell class="whitespace-nowrap">
                  <button
                    v-if="findResource(event)"
                    type="button"
                    class="text-left underline-offset-2 hover:underline"
                    @click="goToObject(event)"
                  >
                    <span class="text-muted-foreground">{{ event.involvedObject.kind }}/</span>{{ event.involvedObject.name }}
                  </button>
                  <span v-else>
                    <span class="text-muted-foreground">{{ event.involvedObject.kind }}/</span>{{ event.involvedObject.name }}
                  </span>
                  <div v-if="event.involvedObject.namespace" class="text-muted-foreground text-xs">{{ event.involvedObject.namespace }}</div>
                </TableCell>
                <TableCell class="font-mono text-xs">{{ event.reason }}</TableCell>
                <TableCell class="max-w-md whitespace-normal break-words text-sm">{{ event.message }}</TableCell>
                <TableCell>{{ event.count || 1 }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
