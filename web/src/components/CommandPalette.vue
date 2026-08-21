<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { ResourceKind } from '@/stores/cluster'

const store = useClusterStore()
const router = useRouter()
const open = ref(false)
const query = ref('')

const groups: { kind: ResourceKind; label: string }[] = [
  { kind: 'deployments', label: 'Deployments' },
  { kind: 'services', label: 'Services' },
  { kind: 'pods', label: 'Pods' },
]

function handleKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

watch(open, (isOpen) => {
  if (isOpen) query.value = ''
})

function selectItem(kind: ResourceKind, item: any) {
  open.value = false
  store.setFilterText(query.value)
  router.push(`/${store.currentContext}/${kind}/${item.metadata.namespace}/${item.metadata.name}`)
}
</script>

<template>
  <CommandDialog v-model:open="open" :title="$t('commandPalette.title')" :description="$t('commandPalette.description')">
    <CommandInput
      :placeholder="$t('commandPalette.placeholder')"
      @update:model-value="(value) => (query = String(value))"
    />
    <CommandList>
      <CommandEmpty>{{ $t('commandPalette.empty') }}</CommandEmpty>
      <CommandGroup v-for="group in groups" :key="group.kind" :heading="group.label">
        <CommandItem
          v-for="item in store.resourcesByKind(group.kind)"
          :key="`${group.kind}-${item.metadata.namespace}-${item.metadata.name}`"
          :value="`${item.metadata.namespace}/${item.metadata.name}`"
          @select="selectItem(group.kind, item)"
        >
          {{ item.metadata.namespace }}/{{ item.metadata.name }}
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
