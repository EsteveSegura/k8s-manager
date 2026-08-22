<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import { useLogScroll } from '@/composables/useLogScroll'
import { useLogSearch } from '@/composables/useLogSearch'
import { downloadTextFile } from '@/lib/download'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { RefreshCwIcon, ArrowDownIcon, DownloadIcon, SearchIcon, XIcon, ChevronUpIcon, ChevronDownIcon } from '@lucide/vue'

export interface LogTarget {
  namespace: string
  name: string
  containers: string[]
}

const props = defineProps<{
  open: boolean
  title: string
  description: string
  pods: LogTarget[]
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

interface LogLine {
  podName: string
  timestamp: number | null
  text: string
}

const route = useRoute()
const store = useClusterStore()
const settings = useSettingsStore()

const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const isRefreshing = ref(false)
const hasLoadedOnce = ref(false)
const error = ref('')
const lines = ref<LogLine[]>([])
const { scrollAreaRef: logsScrollArea, isAtBottom, afterContentUpdate, jumpToBottom } = useLogScroll()

function parseLine(podName: string, raw: string): LogLine {
  const separatorIndex = raw.indexOf(' ')
  if (separatorIndex > 0) {
    const maybeTimestamp = raw.slice(0, separatorIndex)
    const date = Date.parse(maybeTimestamp)
    if (!Number.isNaN(date)) {
      return { podName, timestamp: date, text: raw.slice(separatorIndex + 1) }
    }
  }
  return { podName, timestamp: null, text: raw }
}

async function fetchOnePod(pod: LogTarget): Promise<LogLine[]> {
  const context = String(route.params.context)
  const container = pod.containers[0]
  const params = new URLSearchParams({ tailLines: '200', timestamps: 'true' })
  if (container) params.set('container', container)
  const res = await fetch(`/api/${encodeURIComponent(context)}/pods/${pod.namespace}/${pod.name}/logs?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data.logs
    .split('\n')
    .filter((line: string) => line.length > 0)
    .map((line: string) => parseLine(pod.name, line))
}

async function fetchAllLogs() {
  if (props.pods.length === 0) return
  const isFirstLoad = !hasLoadedOnce.value
  if (hasLoadedOnce.value) {
    isRefreshing.value = true
  } else {
    status.value = 'loading'
  }
  error.value = ''
  try {
    const results = await Promise.allSettled(props.pods.map(fetchOnePod))
    const merged: LogLine[] = []
    const failures: string[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') merged.push(...result.value)
      else failures.push(`${props.pods[index].name}: ${result.reason?.message || 'error'}`)
    })
    merged.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
    lines.value = merged
    if (failures.length > 0) error.value = failures.join(' · ')
    status.value = 'ready'
    if (isFirstLoad) await jumpToBottom()
    else await afterContentUpdate()
  } catch (err: any) {
    error.value = err.message
    if (!hasLoadedOnce.value) status.value = 'error'
  } finally {
    hasLoadedOnce.value = true
    isRefreshing.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      hasLoadedOnce.value = false
      lines.value = []
      fetchAllLogs()
    }
  },
)

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(
  () => {
    if (props.open && isAtBottom.value) fetchAllLogs()
  },
  () => settings.refreshIntervalMs,
  { immediate: false },
)

watch(
  [() => settings.autoRefresh, () => props.open],
  ([enabled, isOpen]) => {
    if (enabled && isOpen) resumeAutoRefresh()
    else pauseAutoRefresh()
  },
  { immediate: true },
)

async function resumeFollowing() {
  clearSearch()
  await jumpToBottom()
  fetchAllLogs()
}

function downloadLogs() {
  const slug = props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  downloadTextFile(`${slug || 'logs'}.log`, combinedText.value)
}

function timeLabel(timestamp: number | null) {
  if (timestamp === null) return null
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const combinedText = computed(() =>
  lines.value
    .map((line) => {
      const time = timeLabel(line.timestamp)
      const prefix = time ? `${time} [${line.podName}]` : `[${line.podName}]`
      return `${prefix} ${line.text}`
    })
    .join('\n'),
)

const {
  query: searchQuery,
  matches: searchMatches,
  isCapped: searchIsCapped,
  activeIndex: searchActiveIndex,
  segments: logSegments,
  next: nextMatch,
  prev: prevMatch,
  clear: clearSearch,
  onKeydown: onSearchKeydown,
  registerMatchRef,
} = useLogSearch(combinedText)
</script>

<template>
  <Drawer :open="open" @update:open="(value) => emit('update:open', value)">
    <DrawerContent class="h-[85vh] max-h-[85vh] overflow-hidden">
      <DrawerHeader class="shrink-0">
        <DrawerTitle>{{ title }}</DrawerTitle>
        <DrawerDescription>{{ description }} · {{ $t('logs.podCount', pods.length) }}</DrawerDescription>
      </DrawerHeader>

      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        <Empty v-if="pods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('logs.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('logs.noPodsDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <template v-else>
          <div class="flex flex-wrap shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" :disabled="status === 'loading'" @click="fetchAllLogs">
              <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': isRefreshing }" />
              {{ $t('common.refresh') }}
            </Button>
            <Button variant="outline" size="sm" :disabled="status !== 'ready' || lines.length === 0" @click="downloadLogs">
              <DownloadIcon data-icon="inline-start" />
              {{ $t('logs.download') }}
            </Button>
            <span v-if="settings.autoRefresh" class="text-xs text-muted-foreground">{{ $t('common.autoRefreshActive') }}</span>
            <span v-if="error" class="text-xs text-destructive">{{ error }}</span>

            <div class="ml-auto flex items-center gap-2">
              <InputGroup class="max-w-64">
                <InputGroupInput
                  v-model="searchQuery"
                  :placeholder="$t('logs.searchPlaceholder')"
                  @keydown="onSearchKeydown"
                />
                <InputGroupAddon>
                  <SearchIcon class="size-4 shrink-0 opacity-50" />
                </InputGroupAddon>
                <InputGroupAddon v-if="searchQuery" align="inline-end">
                  <InputGroupButton size="icon-xs" :aria-label="$t('common.clearSearch')" @click="clearSearch">
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>

              <template v-if="searchQuery">
                <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {{ searchMatches.length ? searchActiveIndex + 1 : 0 }}/{{ searchMatches.length }}{{ searchIsCapped ? '+' : '' }}
                </span>
                <Button variant="outline" size="icon-sm" :disabled="!searchMatches.length" :aria-label="$t('logs.prevMatch')" @click="prevMatch">
                  <ChevronUpIcon />
                </Button>
                <Button variant="outline" size="icon-sm" :disabled="!searchMatches.length" :aria-label="$t('logs.nextMatch')" @click="nextMatch">
                  <ChevronDownIcon />
                </Button>
              </template>
            </div>
          </div>

          <div class="relative min-h-0 flex-1" @pointerdown.stop>
            <ScrollArea ref="logsScrollArea" class="h-full min-w-0 rounded-md border">
              <div class="p-4">
                <Skeleton v-if="status === 'loading' || status === 'idle'" class="h-64 w-full" />
                <Empty v-else-if="status === 'error'">
                  <EmptyHeader>
                    <EmptyTitle>{{ $t('logs.loadErrorTitle') }}</EmptyTitle>
                    <EmptyDescription>{{ error }}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
                <Empty v-else-if="lines.length === 0">
                  <EmptyHeader>
                    <EmptyTitle>{{ $t('logs.emptyLinesTitle') }}</EmptyTitle>
                    <EmptyDescription>{{ $t('logs.emptyLinesDescription') }}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
                <pre v-else class="font-mono text-xs whitespace-pre-wrap break-words select-text cursor-text"><template v-for="(segment, i) in logSegments" :key="i"><mark
                    v-if="segment.match"
                    :ref="(el) => registerMatchRef(el as Element | null, segment.active)"
                    :class="segment.active ? 'rounded-sm bg-yellow-400 text-black ring-2 ring-yellow-600' : 'rounded-sm bg-yellow-300/80 text-black'"
                  >{{ segment.text }}</mark><template v-else>{{ segment.text }}</template></template></pre>
              </div>
            </ScrollArea>

            <div v-if="!isAtBottom" class="absolute inset-x-0 bottom-3 flex justify-center">
              <Button size="sm" variant="secondary" class="shadow-md" @click="resumeFollowing">
                <ArrowDownIcon data-icon="inline-start" />
                {{ $t('logs.jumpToBottom') }}
              </Button>
            </div>
          </div>
        </template>
      </div>
    </DrawerContent>
  </Drawer>
</template>
