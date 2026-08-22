<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { resourceQuotasForNamespace, limitRangesForNamespace, podsForNamespace } from '@/lib/k8s-relations'
import { resourcePath } from '@/lib/resource-kinds'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import ResourceEventsCard from '@/components/ResourceEventsCard.vue'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon, ScaleIcon, SlidersHorizontalIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('namespaces', () => props.resource)

const status = computed(() => props.resource.status || {})
const labels = computed(() => props.resource.metadata?.labels || {})
const relatedQuotas = computed(() => resourceQuotasForNamespace(props.resource, store.resourcequotas))
const relatedLimitRanges = computed(() => limitRangesForNamespace(props.resource, store.limitranges))
const relatedPods = computed(() => podsForNamespace(props.resource, store.pods))

function phaseVariant(phase: string) {
  return phase === 'Active' ? 'secondary' : 'destructive'
}

function goToQuota(quota: any) {
  router.push(resourcePath(store.currentContext!, 'resourcequotas', quota.metadata.namespace, quota.metadata.name))
}

function goToLimitRange(limitRange: any) {
  router.push(resourcePath(store.currentContext!, 'limitranges', limitRange.metadata.namespace, limitRange.metadata.name))
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.namespace.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="phaseVariant(status.phase)">{{ status.phase || 'Unknown' }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.namespace.podsCount') }}</span>{{ relatedPods.length }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.namespace.labelsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex min-w-0 flex-wrap gap-2">
        <Empty v-if="Object.keys(labels).length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.namespace.noLabelsTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <Badge
          v-for="[key, value] in Object.entries(labels)"
          :key="key"
          variant="secondary"
          class="max-w-full whitespace-normal break-all font-mono"
        >
          {{ key }}={{ value }}
        </Badge>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">ResourceQuotas</CardTitle>
        <CardDescription>{{ $t('describe.namespace.quotasDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedQuotas.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.namespace.noQuotasTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <button
          v-for="quota in relatedQuotas"
          :key="quota.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToQuota(quota)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <ScaleIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ quota.metadata.name }}</span>
          </div>
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">LimitRanges</CardTitle>
        <CardDescription>{{ $t('describe.namespace.limitRangesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedLimitRanges.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.namespace.noLimitRangesTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <button
          v-for="limitRange in relatedLimitRanges"
          :key="limitRange.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToLimitRange(limitRange)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <SlidersHorizontalIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ limitRange.metadata.name }}</span>
          </div>
        </button>
      </CardContent>
    </Card>

    <ResourceEventsCard :namespace="resource.metadata.name" :matchers="[{ kind: 'Namespace', name: resource.metadata.name }]" />

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
