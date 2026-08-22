<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForPodDisruptionBudget } from '@/lib/k8s-relations'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon, ContainerIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('poddisruptionbudgets', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const matchedPods = computed(() => podsForPodDisruptionBudget(props.resource, store.pods))

function disruptionVariant(allowed: number) {
  return allowed > 0 ? 'secondary' : 'destructive'
}

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
        <CardTitle class="text-sm">{{ $t('describe.pdb.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="disruptionVariant(status.disruptionsAllowed)">
          {{ $t('describe.pdb.disruptionsAllowed') }}{{ status.disruptionsAllowed ?? 0 }}
        </Badge>
        <div v-if="spec.minAvailable != null"><span class="text-muted-foreground">{{ $t('describe.pdb.minAvailable') }}</span>{{ spec.minAvailable }}</div>
        <div v-if="spec.maxUnavailable != null"><span class="text-muted-foreground">{{ $t('describe.pdb.maxUnavailable') }}</span>{{ spec.maxUnavailable }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pdb.currentHealthy') }}</span>{{ status.currentHealthy ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pdb.desiredHealthy') }}</span>{{ status.desiredHealthy ?? 0 }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pdb.expectedPods') }}</span>{{ status.expectedPods ?? 0 }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.pdb.matchedPodsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="matchedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.pdb.noPodsTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <button
          v-for="pod in matchedPods"
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

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="[{ kind: 'PodDisruptionBudget', name: resource.metadata.name }]" />

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
