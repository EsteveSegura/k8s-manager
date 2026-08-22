<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForPersistentVolumeClaim, persistentVolumeForClaim } from '@/lib/k8s-relations'
import { resourcePath } from '@/lib/resource-kinds'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { ContainerIcon, HardDriveIcon, CodeIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('persistentvolumeclaims', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})
const boundVolume = computed(() => persistentVolumeForClaim(props.resource, store.persistentvolumes))
const relatedPods = computed(() => podsForPersistentVolumeClaim(props.resource, store.pods))

function phaseVariant(phase: string) {
  if (phase === 'Bound') return 'secondary'
  if (phase === 'Pending') return 'outline'
  return 'destructive'
}

function goToPod(pod: any) {
  router.push(`/${store.currentContext}/pods/${pod.metadata.namespace}/${pod.metadata.name}`)
}

function goToVolume(pv: any) {
  router.push(resourcePath(store.currentContext!, 'persistentvolumes', null, pv.metadata.name))
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
        <CardTitle class="text-sm">{{ $t('describe.pvc.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge :variant="phaseVariant(status.phase)">{{ status.phase || 'Unknown' }}</Badge>
        <div><span class="text-muted-foreground">{{ $t('describe.pvc.capacity') }}</span>{{ status.capacity?.storage || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pvc.storageClass') }}</span>{{ spec.storageClassName || '-' }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.pvc.accessModes') }}</span>{{ (spec.accessModes || []).join(', ') || '-' }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.pvc.volumeTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="!boundVolume">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.pvc.noVolumeTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.pvc.noVolumeDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-else
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToVolume(boundVolume)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <HardDriveIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ boundVolume.metadata.name }}</span>
          </div>
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.pvc.podsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.pvc.noPodsTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.pvc.noPodsDescription') }}</EmptyDescription>
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

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
