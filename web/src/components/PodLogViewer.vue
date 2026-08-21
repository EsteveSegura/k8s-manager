<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { AUTO_REFRESH_INTERVAL_MS } from '@/lib/constants'
import { useLogScroll } from '@/composables/useLogScroll'
import { useLogSearch } from '@/composables/useLogSearch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { RefreshCwIcon, ArrowDownIcon, SearchIcon, XIcon, ChevronUpIcon, ChevronDownIcon } from '@lucide/vue'

const props = defineProps<{
  namespace: string
  name: string
  containers: string[]
  active: boolean
}>()

const route = useRoute()
const store = useClusterStore()
const selectedContainer = ref(props.containers[0] || '')
const logs = ref('')
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref('')
const hasLoadedOnce = ref(false)
const isRefreshing = ref(false)
const { scrollAreaRef: logsScrollArea, isAtBottom, afterContentUpdate, jumpToBottom } = useLogScroll()
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
} = useLogSearch(logs)

async function fetchLogs() {
  if (!selectedContainer.value) return
  const isFirstLoad = !hasLoadedOnce.value
  if (hasLoadedOnce.value) {
    isRefreshing.value = true
  } else {
    status.value = 'loading'
  }
  error.value = ''
  try {
    const context = String(route.params.context)
    const params = new URLSearchParams({ container: selectedContainer.value, tailLines: '200' })
    const res = await fetch(
      `/api/${encodeURIComponent(context)}/pods/${props.namespace}/${props.name}/logs?${params}`,
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
    logs.value = data.logs
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
  () => props.active,
  (isActive) => {
    if (isActive && !hasLoadedOnce.value) fetchLogs()
  },
  { immediate: true },
)

watch(selectedContainer, () => {
  hasLoadedOnce.value = false
  if (props.active) fetchLogs()
})

async function resumeFollowing() {
  clearSearch()
  await jumpToBottom()
  if (props.active) fetchLogs()
}

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(
  () => {
    if (props.active && isAtBottom.value) fetchLogs()
  },
  AUTO_REFRESH_INTERVAL_MS,
  { immediate: false },
)

watch(
  [() => store.autoRefresh, () => props.active],
  ([enabled, active]) => {
    if (enabled && active) resumeAutoRefresh()
    else pauseAutoRefresh()
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-col gap-2">
    <div class="flex flex-wrap shrink-0 items-center gap-2">
      <Select v-if="containers.length > 1" v-model="selectedContainer">
        <SelectTrigger class="w-56">
          <SelectValue :placeholder="$t('logs.selectContainer')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="c in containers" :key="c" :value="c">{{ c }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" :disabled="status === 'loading'" @click="fetchLogs">
        <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': isRefreshing }" />
        {{ $t('common.refresh') }}
      </Button>

      <span v-if="store.autoRefresh" class="text-xs text-muted-foreground">{{ $t('common.autoRefreshActive') }}</span>

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
  </div>
</template>
