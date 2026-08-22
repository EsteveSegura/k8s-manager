<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { servicesForIngress } from '@/lib/k8s-relations'
import { useResourceYaml } from '@/composables/useResourceYaml'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import ResourceYamlDrawer from '@/components/ResourceYamlDrawer.vue'
import { NetworkIcon, CodeIcon } from '@lucide/vue'

const props = defineProps<{ resource: any }>()

const router = useRouter()
const store = useClusterStore()
const { yamlOpen, yaml } = useResourceYaml('ingresses', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const status = computed(() => props.resource.status || {})

interface IngressRow {
  host: string
  path: string
  backend: string
}

const rows = computed<IngressRow[]>(() => {
  const result: IngressRow[] = []
  for (const rule of spec.value.rules || []) {
    const host = rule.host || '*'
    for (const path of rule.http?.paths || []) {
      const service = path.backend?.service
      const port = service?.port?.number ?? service?.port?.name ?? ''
      const backend = service ? `${service.name}:${port}` : (path.backend?.resource?.name || '-')
      result.push({ host, path: path.path || '/', backend })
    }
  }
  return result
})

const loadBalancerEntries = computed(() => status.value.loadBalancer?.ingress || [])
const relatedServices = computed(() => servicesForIngress(props.resource, store.services))

function goToService(service: any) {
  router.push(`/${store.currentContext}/services/${service.metadata.namespace}/${service.metadata.name}`)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.ingress.classTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant="outline">{{ spec.ingressClassName || '-' }}</Badge>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.ingress.rulesTitle') }}</CardTitle>
        <CardDescription>{{ $t('describe.ingress.rulesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Empty v-if="rows.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.ingress.noRulesTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.ingress.noRulesDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>{{ $t('describe.ingress.columns.host') }}</TableHead>
              <TableHead>{{ $t('describe.ingress.columns.path') }}</TableHead>
              <TableHead>{{ $t('describe.ingress.columns.backend') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, i) in rows" :key="i">
              <TableCell class="font-mono text-xs">{{ row.host }}</TableCell>
              <TableCell class="font-mono text-xs">{{ row.path }}</TableCell>
              <TableCell class="font-mono text-xs">{{ row.backend }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.ingress.tlsTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <span v-if="!spec.tls?.length" class="text-muted-foreground">{{ $t('describe.ingress.noTls') }}</span>
        <div v-for="(tls, i) in spec.tls || []" :key="i" class="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{{ tls.secretName || 'secret' }}</Badge>
          <span class="text-muted-foreground text-xs">{{ (tls.hosts || []).join(', ') }}</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.ingress.loadBalancerTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <span v-if="loadBalancerEntries.length === 0" class="text-muted-foreground">{{ $t('describe.ingress.noLoadBalancer') }}</span>
        <div v-for="(entry, i) in loadBalancerEntries" :key="i" class="font-mono text-xs">
          {{ entry.hostname || entry.ip }}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Services</CardTitle>
        <CardDescription>{{ $t('describe.ingress.servicesDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="relatedServices.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.ingress.noServicesTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('describe.ingress.noServicesDescription') }}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <button
          v-for="service in relatedServices"
          :key="service.metadata.name"
          type="button"
          class="flex min-w-0 items-center justify-between gap-2 rounded-md border p-2 text-left transition-colors hover:bg-accent"
          @click="goToService(service)"
        >
          <div class="flex min-w-0 items-center gap-2">
            <NetworkIcon class="text-muted-foreground shrink-0" />
            <span class="truncate font-medium">{{ service.metadata.name }}</span>
          </div>
          <Badge variant="outline" class="shrink-0">{{ service.spec?.type || 'ClusterIP' }}</Badge>
        </button>
      </CardContent>
    </Card>

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
