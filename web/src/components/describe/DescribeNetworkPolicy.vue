<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { podsForNetworkPolicy } from '@/lib/k8s-relations'
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
const { yamlOpen, yaml } = useResourceYaml('networkpolicies', () => props.resource)

const spec = computed(() => props.resource.spec || {})
const podSelectorLabels = computed(() => spec.value.podSelector?.matchLabels || {})
const matchedPods = computed(() => podsForNetworkPolicy(props.resource, store.pods))

function portsLabel(ports: any[] | undefined) {
  if (!ports?.length) return 'all ports'
  return ports.map((p) => `${p.protocol || 'TCP'}/${p.port}${p.endPort ? `-${p.endPort}` : ''}`).join(', ')
}

function peerLabel(peer: any) {
  if (peer.ipBlock) {
    const except = peer.ipBlock.except?.length ? ` (except ${peer.ipBlock.except.join(', ')})` : ''
    return `IP block ${peer.ipBlock.cidr}${except}`
  }
  const parts: string[] = []
  if (peer.namespaceSelector) {
    const labels = peer.namespaceSelector.matchLabels
    parts.push(labels && Object.keys(labels).length ? `namespace ${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',')}` : 'any namespace')
  }
  if (peer.podSelector) {
    const labels = peer.podSelector.matchLabels
    parts.push(labels && Object.keys(labels).length ? `pod ${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',')}` : 'any pod')
  }
  return parts.length ? parts.join(' / ') : 'all sources'
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
        <CardTitle class="text-sm">{{ $t('describe.networkpolicy.selectorTitle') }}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" @click="yamlOpen = true">
            <CodeIcon data-icon="inline-start" />
            {{ $t('describe.viewYaml') }}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <div class="flex flex-wrap gap-2">
          <Badge v-for="type in spec.policyTypes || ['Ingress']" :key="type" variant="outline">{{ type }}</Badge>
        </div>
        <div class="flex min-w-0 flex-wrap gap-2">
          <span v-if="Object.keys(podSelectorLabels).length === 0" class="text-muted-foreground text-xs">{{ $t('describe.networkpolicy.allPods') }}</span>
          <Badge v-for="[key, value] in Object.entries(podSelectorLabels)" :key="key" variant="secondary" class="font-mono">{{ key }}={{ value }}</Badge>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.networkpolicy.ingressTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <Empty v-if="!spec.ingress?.length">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.networkpolicy.noIngressTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-for="(rule, i) in spec.ingress" :key="i" class="flex flex-col gap-1 rounded-md border p-2">
          <span class="text-muted-foreground text-xs">{{ $t('describe.networkpolicy.ports') }}: {{ portsLabel(rule.ports) }}</span>
          <div v-if="!rule.from?.length" class="text-xs">{{ $t('describe.networkpolicy.allSources') }}</div>
          <div v-for="(peer, j) in rule.from" :key="j" class="text-xs">{{ peerLabel(peer) }}</div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">{{ $t('describe.networkpolicy.egressTitle') }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 text-sm">
        <Empty v-if="!spec.egress?.length">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.networkpolicy.noEgressTitle') }}</EmptyTitle>
          </EmptyHeader>
        </Empty>
        <div v-for="(rule, i) in spec.egress" :key="i" class="flex flex-col gap-1 rounded-md border p-2">
          <span class="text-muted-foreground text-xs">{{ $t('describe.networkpolicy.ports') }}: {{ portsLabel(rule.ports) }}</span>
          <div v-if="!rule.to?.length" class="text-xs">{{ $t('describe.networkpolicy.allDestinations') }}</div>
          <div v-for="(peer, j) in rule.to" :key="j" class="text-xs">{{ peerLabel(peer) }}</div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Pods</CardTitle>
        <CardDescription>{{ $t('describe.networkpolicy.matchedPodsDescription') }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 text-sm">
        <Empty v-if="matchedPods.length === 0">
          <EmptyHeader>
            <EmptyTitle>{{ $t('describe.networkpolicy.noPodsTitle') }}</EmptyTitle>
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

    <ResourceEventsCard :namespace="resource.metadata.namespace" :matchers="[{ kind: 'NetworkPolicy', name: resource.metadata.name }]" />

    <ResourceYamlDrawer v-model:open="yamlOpen" :title="resource.metadata.name" :yaml="yaml" />
  </div>
</template>
