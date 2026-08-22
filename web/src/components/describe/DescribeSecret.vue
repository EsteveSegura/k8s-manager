<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForSecret } from '@/lib/k8s-relations'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ContainerIcon, LockIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()

const relatedPods = computed(() => podsForSecret(props.resource, store.pods))

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
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-sm">
          <LockIcon class="size-4 text-muted-foreground" />
          {{ $t('describe.secret.keysTitle') }}
        </CardTitle>
        <CardDescription>{{ $t('describe.secret.keysDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <Badge variant="outline">{{ resource.type || 'Opaque' }}</Badge>
        <Empty v-if="!resource.dataKeys?.length">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.secret.emptyTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-else class="flex flex-wrap gap-2">
          <Badge v-for="key in resource.dataKeys" :key="key" variant="secondary" class="font-mono">{{ key }}</Badge>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.secret.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.secret.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.secret.noPodsDescription') }}</EmptyDescription>
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
