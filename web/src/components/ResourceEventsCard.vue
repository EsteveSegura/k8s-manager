<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatDateTime } from '@/lib/format'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { RefreshCwIcon } from '@lucide/vue'

const MAX_EVENTS = 15

interface EventMatcher {
  kind: string
  name: string
}

const props = defineProps<{
  namespace: string
  matchers: EventMatcher[]
}>()

const route = useRoute()
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const error = ref('')
const events = ref<any[]>([])

function eventTimestamp(event: any) {
  return event.lastTimestamp || event.eventTime || event.metadata?.creationTimestamp || null
}

async function load() {
  status.value = 'loading'
  try {
    const context = String(route.params.context)
    const res = await fetch(`/api/${encodeURIComponent(context)}/events`)
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

onMounted(load)

const filteredEvents = computed(() =>
  events.value
    .filter(
      (event) =>
        event.involvedObject?.namespace === props.namespace &&
        props.matchers.some((matcher) => matcher.kind === event.involvedObject?.kind && matcher.name === event.involvedObject?.name),
    )
    .sort((a, b) => new Date(eventTimestamp(b) || 0).getTime() - new Date(eventTimestamp(a) || 0).getTime())
    .slice(0, MAX_EVENTS),
)

function typeVariant(type: string) {
  return type === 'Warning' ? 'destructive' : 'secondary'
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-sm">{{ $t('describe.eventsTitle') }}</CardTitle>
      <CardDescription>{{ $t('describe.eventsDescription') }}</CardDescription>
      <CardAction>
        <Button variant="ghost" size="icon-sm" :aria-label="$t('common.refresh')" @click="load">
          <RefreshCwIcon :class="{ 'animate-spin': status === 'loading' }" />
        </Button>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-2 text-sm">
      <Skeleton v-if="status === 'loading' && events.length === 0" class="h-16 w-full" />

      <Empty v-else-if="status === 'error'">
        <EmptyHeader>
          <EmptyTitle>{{ $t('events.loadErrorTitle') }}</EmptyTitle>
          <EmptyDescription>{{ error }}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <Empty v-else-if="filteredEvents.length === 0">
        <EmptyHeader>
          <EmptyTitle>{{ $t('describe.noEventsTitle') }}</EmptyTitle>
        </EmptyHeader>
      </Empty>

      <div v-for="(event, i) in filteredEvents" :key="i" class="flex flex-col gap-0.5 rounded-md border p-2">
        <div class="flex items-center gap-2">
          <Badge :variant="typeVariant(event.type)">{{ event.type }}</Badge>
          <span class="font-mono text-xs">{{ event.reason }}</span>
          <span class="text-muted-foreground ml-auto shrink-0 text-xs whitespace-nowrap">{{ formatDateTime(eventTimestamp(event)) }}</span>
        </div>
        <p class="text-muted-foreground text-xs">
          <span class="font-mono">{{ event.involvedObject.kind }}/{{ event.involvedObject.name }}</span> — {{ event.message }}
        </p>
      </div>
    </CardContent>
  </Card>
</template>
