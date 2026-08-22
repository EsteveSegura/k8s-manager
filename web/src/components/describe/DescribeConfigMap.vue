<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForConfigMap } from '@/lib/k8s-relations'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ContainerIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const dataEntries = computed(() => Object.entries(props.resource.data || {}))
const binaryDataKeys = computed(() => Object.keys(props.resource.binaryData || {}))
const relatedPods = computed(() => podsForConfigMap(props.resource, store.pods))

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
    <div>
      <h2 class="text-lg font-semibold">{{ resource.metadata.name }}</h2>
      <p class="text-muted-foreground text-sm">{{ resource.metadata.namespace }}</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.configmap.dataTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.configmap.dataDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <Empty v-if="dataEntries.length === 0 && binaryDataKeys.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.configmap.emptyTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-for="[key, value] in dataEntries" :key="key" class="flex flex-col gap-1">
          <div class="font-mono text-xs font-medium">{{ key }}</div>
          <pre class="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap break-all select-text">{{ value }}</pre>
          <Separator class="mt-2" />
        </div>
        <div v-for="key in binaryDataKeys" :key="key" class="flex items-center gap-2">
          <span class="font-mono text-xs font-medium">{{ key }}</span>
          <Badge variant="outline">binary</Badge>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.configmap.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.configmap.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.configmap.noPodsDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="pod in relatedPods"
          :key="pod.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToPod(pod)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ContainerIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ pod.metadata.name }}</span>
          </div>
          <Badge :variant="podPhaseVariant(pod.status?.phase)" class="shrink-0">{{ pod.status?.phase || 'Unknown' }}</Badge>
        </button>
      </CardContent>
    </Card>
  </div>
</template>
