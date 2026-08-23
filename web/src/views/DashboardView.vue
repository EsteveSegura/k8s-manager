<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useIntervalFn } from '@vueuse/core'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import type { ResourceKind } from '@/stores/cluster'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertTitle, AlertDescription, AlertAction } from '@/components/ui/alert'
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  InboxIcon,
  ServerIcon,
  ContainerIcon,
  BoxesIcon,
  DatabaseIcon,
  LayersIcon,
  ListChecksIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from '@lucide/vue'
import { resourcePath } from '@/lib/resource-kinds'
import {
  isNodeReady,
  isPodHealthy,
  podIssueReason,
  isDeploymentHealthy,
  isStatefulSetHealthy,
  isDaemonSetHealthy,
  isJobHealthy,
} from '@/lib/cluster-health'

type HealthKind = 'nodes' | 'pods' | 'deployments' | 'statefulsets' | 'daemonsets' | 'jobs'

interface Issue {
  kind: HealthKind
  namespace: string | null
  name: string
  reason: string
}

const store = useClusterStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const context = computed(() => String(route.params.context))

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}

function ensureLoaded() {
  store.loadResources(context.value).catch(() => {})
}

async function refreshNow() {
  await store.loadResources(context.value, { force: true }).catch(() => {})
}

onMounted(ensureLoaded)
watch(context, ensureLoaded)

const { pause: pauseAutoRefresh, resume: resumeAutoRefresh } = useIntervalFn(refreshNow, () => settings.refreshIntervalMs, {
  immediate: false,
})
watch(
  () => settings.autoRefresh,
  (enabled) => {
    if (enabled) resumeAutoRefresh()
    else pauseAutoRefresh()
  },
  { immediate: true },
)

const lastUpdatedLabel = computed(() => (store.lastUpdatedAt ? new Date(store.lastUpdatedAt).toLocaleTimeString() : null))

// sessionStorage, no localStorage: el aviso debe reaparecer si se cierra el
// navegador/pestaña y se vuelve a abrir, solo se recuerda "cerrado" mientras
// dura la sesión actual (recargas de página incluidas).
const RESOURCE_ERRORS_DISMISSED_KEY = 'dashboard.resourceErrorsAlertDismissed'
const resourceErrorsAlertDismissed = ref(sessionStorage.getItem(RESOURCE_ERRORS_DISMISSED_KEY) === 'true')

function dismissResourceErrorsAlert() {
  resourceErrorsAlertDismissed.value = true
  sessionStorage.setItem(RESOURCE_ERRORS_DISMISSED_KEY, 'true')
}

// Un fallo de autenticación (p.ej. el token de gcloud caducado) afecta a los ~20
// tipos de recurso a la vez con el mismo mensaje: agrupamos por mensaje en vez
// de listar 20 veces el mismo error.
const resourceErrorGroups = computed(() => {
  const groups = new Map<string, string[]>()
  for (const [kind, message] of Object.entries(store.resourceErrors)) {
    if (!message) continue
    const kinds = groups.get(message) || []
    kinds.push(kind)
    groups.set(message, kinds)
  }
  return Array.from(groups.entries()).map(([message, kinds]) => ({ message, kinds }))
})

interface StatCard {
  kind: HealthKind
  label: string
  icon: typeof BoxesIcon
  total: number
  healthy: number
}

const stats = computed<StatCard[]>(() => [
  { kind: 'nodes', label: 'Nodes', icon: ServerIcon, total: store.nodes.length, healthy: store.nodes.filter(isNodeReady).length },
  { kind: 'pods', label: 'Pods', icon: ContainerIcon, total: store.pods.length, healthy: store.pods.filter(isPodHealthy).length },
  {
    kind: 'deployments',
    label: 'Deployments',
    icon: BoxesIcon,
    total: store.deployments.length,
    healthy: store.deployments.filter(isDeploymentHealthy).length,
  },
  {
    kind: 'statefulsets',
    label: 'StatefulSets',
    icon: DatabaseIcon,
    total: store.statefulsets.length,
    healthy: store.statefulsets.filter(isStatefulSetHealthy).length,
  },
  {
    kind: 'daemonsets',
    label: 'DaemonSets',
    icon: LayersIcon,
    total: store.daemonsets.length,
    healthy: store.daemonsets.filter(isDaemonSetHealthy).length,
  },
  { kind: 'jobs', label: 'Jobs', icon: ListChecksIcon, total: store.jobs.length, healthy: store.jobs.filter(isJobHealthy).length },
])

const kindLabels: Record<HealthKind, string> = {
  nodes: 'Node',
  pods: 'Pod',
  deployments: 'Deployment',
  statefulsets: 'StatefulSet',
  daemonsets: 'DaemonSet',
  jobs: 'Job',
}

const issues = computed<Issue[]>(() => {
  const list: Issue[] = []

  for (const node of store.nodes) {
    if (!isNodeReady(node)) list.push({ kind: 'nodes', namespace: null, name: node.metadata.name, reason: t('dashboard.reasons.nodeNotReady') })
  }
  for (const pod of store.pods) {
    if (!isPodHealthy(pod)) list.push({ kind: 'pods', namespace: pod.metadata.namespace, name: pod.metadata.name, reason: podIssueReason(pod) })
  }
  for (const deployment of store.deployments) {
    if (!isDeploymentHealthy(deployment)) {
      list.push({
        kind: 'deployments',
        namespace: deployment.metadata.namespace,
        name: deployment.metadata.name,
        reason: t('dashboard.reasons.notReadyReplicas', {
          ready: deployment.status?.readyReplicas || 0,
          desired: deployment.spec?.replicas ?? 0,
        }),
      })
    }
  }
  for (const statefulset of store.statefulsets) {
    if (!isStatefulSetHealthy(statefulset)) {
      list.push({
        kind: 'statefulsets',
        namespace: statefulset.metadata.namespace,
        name: statefulset.metadata.name,
        reason: t('dashboard.reasons.notReadyReplicas', {
          ready: statefulset.status?.readyReplicas || 0,
          desired: statefulset.spec?.replicas ?? 0,
        }),
      })
    }
  }
  for (const daemonset of store.daemonsets) {
    if (!isDaemonSetHealthy(daemonset)) {
      list.push({
        kind: 'daemonsets',
        namespace: daemonset.metadata.namespace,
        name: daemonset.metadata.name,
        reason: t('dashboard.reasons.notReadyDaemons', {
          ready: daemonset.status?.numberReady || 0,
          desired: daemonset.status?.desiredNumberScheduled || 0,
        }),
      })
    }
  }
  for (const job of store.jobs) {
    if (!isJobHealthy(job)) list.push({ kind: 'jobs', namespace: job.metadata.namespace, name: job.metadata.name, reason: t('dashboard.reasons.jobFailed') })
  }

  return list
})

function goToIssue(issue: Issue) {
  router.push(resourcePath(context.value, issue.kind as ResourceKind, issue.namespace, issue.name))
}
</script>

<template>
      <header class="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b px-4">
        <Button variant="ghost" size="icon-sm" :aria-label="$t('common.changeCluster')" @click="changeCluster">
          <ArrowLeftIcon />
        </Button>
        <Separator orientation="vertical" class="my-2" />
        <span class="text-sm font-medium">{{ context }}</span>
        <span class="text-muted-foreground text-sm">/</span>
        <span class="text-sm font-medium">{{ $t('dashboard.title') }}</span>
      </header>

      <div class="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4 min-h-0">
        <div class="flex min-w-0 flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" :disabled="store.isRefreshing" @click="refreshNow">
            <RefreshCwIcon data-icon="inline-start" :class="{ 'animate-spin': store.isRefreshing }" />
            {{ $t('common.refresh') }}
          </Button>

          <span v-if="settings.autoRefresh" class="shrink-0 text-xs text-muted-foreground">
            {{ $t('common.autoRefreshActive') }}
          </span>

          <span v-if="lastUpdatedLabel" class="shrink-0 text-xs text-muted-foreground">
            {{ $t('common.updatedAt', { time: lastUpdatedLabel }) }}
          </span>
        </div>

        <template v-if="store.resourcesStatus === 'loading' && !store.lastUpdatedAt">
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Skeleton class="h-24 w-full" v-for="i in 6" :key="i" />
          </div>
          <Skeleton class="h-64 w-full" />
        </template>

        <Empty v-else-if="store.resourcesStatus === 'error'">
          <EmptyHeader>
            <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
            <EmptyTitle>{{ $t('resourceList.loadErrorTitle') }}</EmptyTitle>
            <EmptyDescription>{{ store.resourcesError }}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        <template v-else>
          <Alert v-if="resourceErrorGroups.length && !resourceErrorsAlertDismissed" variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>{{ $t('dashboard.resourceErrorsTitle') }}</AlertTitle>
            <AlertDescription>
              <div class="flex flex-col gap-3">
                <div v-for="group in resourceErrorGroups" :key="group.message" class="flex flex-col gap-0.5">
                  <span class="font-medium text-foreground">{{ group.kinds.join(', ') }}</span>
                  <span class="break-words">{{ group.message }}</span>
                </div>
              </div>
            </AlertDescription>
            <AlertAction>
              <Button variant="ghost" size="icon-sm" :aria-label="$t('common.close')" @click="dismissResourceErrorsAlert">
                <XIcon />
              </Button>
            </AlertAction>
          </Alert>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card v-for="stat in stats" :key="stat.kind" class="min-w-0">
              <CardHeader class="pb-2">
                <CardTitle class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <component :is="stat.icon" class="text-muted-foreground size-4 shrink-0" />
                  {{ stat.label }}
                </CardTitle>
              </CardHeader>
              <CardContent class="min-w-0">
                <div class="flex items-baseline gap-2">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <span class="min-w-0 truncate text-xl font-semibold">{{ stat.healthy }}/{{ stat.total }}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ stat.healthy }}/{{ stat.total }}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Badge v-if="stat.total - stat.healthy > 0" variant="destructive" class="shrink-0">{{ stat.total - stat.healthy }}</Badge>
                  <Badge v-else-if="stat.total > 0" variant="secondary" class="shrink-0">OK</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card class="flex min-h-0 flex-1 flex-col">
            <CardHeader>
              <CardTitle>{{ $t('dashboard.issuesTitle') }}</CardTitle>
              <CardDescription>{{ $t('dashboard.issuesDescription') }}</CardDescription>
            </CardHeader>
            <CardContent class="min-h-0 flex-1 overflow-auto">
              <Empty v-if="issues.length === 0">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><CircleCheckIcon /></EmptyMedia>
                  <EmptyTitle>{{ $t('dashboard.noIssuesTitle') }}</EmptyTitle>
                  <EmptyDescription>{{ $t('dashboard.noIssuesDescription') }}</EmptyDescription>
                </EmptyHeader>
              </Empty>

              <Table v-else>
                <TableHeader>
                  <TableRow>
                    <TableHead>{{ $t('dashboard.columns.kind') }}</TableHead>
                    <TableHead>{{ $t('dashboard.columns.resource') }}</TableHead>
                    <TableHead>{{ $t('dashboard.columns.reason') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="issue in issues"
                    :key="`${issue.kind}-${issue.namespace}-${issue.name}`"
                    class="cursor-pointer"
                    @click="goToIssue(issue)"
                  >
                    <TableCell><Badge variant="outline">{{ kindLabels[issue.kind] }}</Badge></TableCell>
                    <TableCell class="font-medium">
                      <span v-if="issue.namespace" class="text-muted-foreground">{{ issue.namespace }}/</span>{{ issue.name }}
                    </TableCell>
                    <TableCell class="text-muted-foreground text-sm">{{ issue.reason }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </template>
      </div>
</template>
