<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { serviceForEndpoints } from '@/lib/k8s-relations'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { CodeIcon, NetworkIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('endpoints', () => props.resource)

const subsets = computed(() => props.resource.subsets || [])
const relatedService = computed(() => serviceForEndpoints(props.resource, store.services))
const totalReady = computed(() => subsets.value.reduce((sum: number, s: any) => sum + (s.addresses?.length || 0), 0))
const totalNotReady = computed(() => subsets.value.reduce((sum: number, s: any) => sum + (s.notReadyAddresses?.length || 0), 0))

function portsLabel(ports: any[] | undefined) {
  if (!ports?.length) return '-'
  return ports.map((p) => `${p.name ? `${p.name}:` : ''}${p.port}/${p.protocol || 'TCP'}`).join(', ')
}

function goToService() {
  if (!relatedService.value) return
  router.push(`/${store.currentContext}/services/${relatedService.value.metadata.namespace}/${relatedService.value.metadata.name}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.endpoints.statusTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <div><span class="text-muted-foreground">{{ $t('describe.endpoints.ready') }}</span>{{ totalReady }}</div>
        <div><span class="text-muted-foreground">{{ $t('describe.endpoints.notReady') }}</span>{{ totalNotReady }}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Service</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="!relatedService">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.endpoints.noServiceTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.endpoints.noServiceDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-else
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToService"
        >
          <div class="flex min-w-0 items-center gap-2">
            <NetworkIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ relatedService.metadata.name }}</span>
          </div>
        </button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.endpoints.subsetsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <Empty v-if="subsets.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.endpoints.noSubsetsTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-for="(subset, i) in subsets" :key="i" class="flex flex-col gap-2 rounded-md border p-2">
          <span class="text-muted-foreground text-xs">{{ $t('describe.endpoints.ports') }}: {{ portsLabel(subset.ports) }}</span>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="addr in subset.addresses || []" :key="addr.ip" variant="secondary" class="font-mono">{{ addr.ip }}</Badge>
            <Badge v-for="addr in subset.notReadyAddresses || []" :key="addr.ip" variant="destructive" class="font-mono">{{ addr.ip }}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
