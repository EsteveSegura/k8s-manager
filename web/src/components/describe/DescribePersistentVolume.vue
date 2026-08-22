<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { persistentVolumeClaimForVolume } from '@/lib/k8s-relations'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { SaveIcon, CodeIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('persistentvolumes', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const boundClaim = computed(() => persistentVolumeClaimForVolume(props.resource, store.persistentvolumeclaims))

const sourceKind = computed(() => {
  const knownSources = ['hostPath', 'nfs', 'csi', 'gcePersistentDisk', 'awsElasticBlockStore', 'local']
  return knownSources.find((key) => spec.value[key]) || null
})

function phaseVariant(phase: string) {
  if (phase === 'Bound') return 'secondary'
  if (phase === 'Available') return 'outline'
  if (phase === 'Released') return 'outline'
  return 'destructive'
}

function goToClaim(pvc: any) {
  router.push(`/${store.currentContext}/persistentvolumeclaims/${pvc.metadata.namespace}/${pvc.metadata.name}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.pv.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="phaseVariant(status.phase)">{{ status.phase || 'Unknown' }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.pv.capacity') }}</span>{{ spec.capacity?.storage || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pv.storageClass') }}</span>{{ spec.storageClassName || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pv.reclaimPolicy') }}</span>{{ spec.persistentVolumeReclaimPolicy || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pv.accessModes') }}</span>{{ (spec.accessModes || []).join(', ') || '-' }}</div>
        <div v-if="sourceKind"><span class="text-muted-foreground">{{ $t('describe.pv.source') }}</span>{{ sourceKind }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.pv.claimTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="!spec.claimRef">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.pv.noClaimTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.pv.noClaimDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-else-if="boundClaim"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToClaim(boundClaim)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <SaveIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ boundClaim.metadata.namespace }}/{{ boundClaim.metadata.name }}</span>
          </div>
        </button>
        <div v-else class="text-muted-foreground text-xs">
          {{ spec.claimRef.namespace }}/{{ spec.claimRef.name }}
        </div>
      </CardContent>
    </Card>

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
