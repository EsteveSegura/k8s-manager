<script setup lang="ts">
import { useClusterStore } from '@/stores/cluster'
import DescribeDeployment from '@/components/describe/DescribeDeployment.vue'
import DescribeService from '@/components/describe/DescribeService.vue'
import DescribePod from '@/components/describe/DescribePod.vue'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileSearchIcon } from '@lucide/vue'

const store = useClusterStore()
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-4">
      <Empty v-if="!store.selectedResource || !store.selectedResourceObject">
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileSearchIcon /></EmptyMedia>
          <EmptyTitle>{{ $t('describe.emptyTitle') }}</EmptyTitle>
          <EmptyDescription>{{ $t('describe.emptyDescription') }}</EmptyDescription>
        </EmptyHeader>
      </Empty>

      <DescribeDeployment
        v-else-if="store.selectedResource.kind === 'deployments'"
        :key="`${store.selectedResource.namespace}/${store.selectedResource.name}`"
        :resource="store.selectedResourceObject"
      />
      <DescribeService
        v-else-if="store.selectedResource.kind === 'services'"
        :key="`${store.selectedResource.namespace}/${store.selectedResource.name}`"
        :resource="store.selectedResourceObject"
      />
      <DescribePod
        v-else-if="store.selectedResource.kind === 'pods'"
        :key="`${store.selectedResource.namespace}/${store.selectedResource.name}`"
        :resource="store.selectedResourceObject"
      />
    </div>
  </ScrollArea>
</template>
