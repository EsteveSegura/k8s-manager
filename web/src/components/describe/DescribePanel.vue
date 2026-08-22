<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClusterStore } from '@/stores/cluster'
import type { ResourceKind } from '@/stores/cluster'
import DescribeDeployment from '@/components/describe/DescribeDeployment.vue'
import DescribeService from '@/components/describe/DescribeService.vue'
import DescribePod from '@/components/describe/DescribePod.vue'
import DescribeStatefulSet from '@/components/describe/DescribeStatefulSet.vue'
import DescribeDaemonSet from '@/components/describe/DescribeDaemonSet.vue'
import DescribeJob from '@/components/describe/DescribeJob.vue'
import DescribeCronJob from '@/components/describe/DescribeCronJob.vue'
import DescribeIngress from '@/components/describe/DescribeIngress.vue'
import DescribeConfigMap from '@/components/describe/DescribeConfigMap.vue'
import DescribeSecret from '@/components/describe/DescribeSecret.vue'
import DescribePersistentVolumeClaim from '@/components/describe/DescribePersistentVolumeClaim.vue'
import DescribePersistentVolume from '@/components/describe/DescribePersistentVolume.vue'
import DescribeNode from '@/components/describe/DescribeNode.vue'
import DescribeHorizontalPodAutoscaler from '@/components/describe/DescribeHorizontalPodAutoscaler.vue'
import DescribeNamespace from '@/components/describe/DescribeNamespace.vue'
import DescribeResourceQuota from '@/components/describe/DescribeResourceQuota.vue'
import DescribeLimitRange from '@/components/describe/DescribeLimitRange.vue'
import DescribeNetworkPolicy from '@/components/describe/DescribeNetworkPolicy.vue'
import DescribeEndpoints from '@/components/describe/DescribeEndpoints.vue'
import DescribePodDisruptionBudget from '@/components/describe/DescribePodDisruptionBudget.vue'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSearchIcon } from '@lucide/vue'

const store = useClusterStore()

const COMPONENT_BY_KIND: Record<ResourceKind, unknown> = {
  deployments: DescribeDeployment,
  services: DescribeService,
  pods: DescribePod,
  statefulsets: DescribeStatefulSet,
  daemonsets: DescribeDaemonSet,
  jobs: DescribeJob,
  cronjobs: DescribeCronJob,
  ingresses: DescribeIngress,
  configmaps: DescribeConfigMap,
  secrets: DescribeSecret,
  persistentvolumeclaims: DescribePersistentVolumeClaim,
  persistentvolumes: DescribePersistentVolume,
  nodes: DescribeNode,
  horizontalpodautoscalers: DescribeHorizontalPodAutoscaler,
  namespaces: DescribeNamespace,
  resourcequotas: DescribeResourceQuota,
  limitranges: DescribeLimitRange,
  networkpolicies: DescribeNetworkPolicy,
  endpoints: DescribeEndpoints,
  poddisruptionbudgets: DescribePodDisruptionBudget,
}

const activeComponent = computed(() => (store.selectedResource ? COMPONENT_BY_KIND[store.selectedResource.kind] : null))

const activeRef = ref<any>(null)

function openLogs() {
  activeRef.value?.openLogs?.()
}

defineExpose({ openLogs })
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-4">
      <Empty v-if="!store.selectedResource || !store.selectedResourceObject || !activeComponent">
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileSearchIcon /></EmptyMedia>
          <EmptyTitle>{{ $t('describe.emptyTitle') }}</EmptyTitle>
          <EmptyDescription>{{ $t('describe.emptyDescription') }}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <component
        :is="activeComponent"
        v-else
        ref="activeRef"
        :key="`${store.selectedResource.namespace}/${store.selectedResource.name}`"
        :resource="store.selectedResourceObject"
      />
    </div>
  </ScrollArea>
</template>
