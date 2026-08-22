<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClusterStore } from '@/stores/cluster'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ListFilterIcon } from '@lucide/vue'

const store = useClusterStore()
const { t } = useI18n()

const allNamespacesSelected = computed(() => store.excludedNamespaces.length === 0)
const namespaceSelectedCount = computed(() => store.availableNamespaces.length - store.excludedNamespaces.length)
const namespaceFilterLabel = computed(() => {
  if (allNamespacesSelected.value) return t('resourceList.namespaceFilter.all')
  return t('resourceList.namespaceFilter.selected', { count: namespaceSelectedCount.value, total: store.availableNamespaces.length })
})

function toggleAllNamespaces() {
  if (allNamespacesSelected.value) {
    store.setExcludedNamespaces(store.availableNamespaces.slice())
  } else {
    store.selectAllNamespaces()
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm" class="ml-auto shrink-0">
        <ListFilterIcon data-icon="inline-start" />
        <span class="hidden @md:inline">{{ namespaceFilterLabel }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56 max-h-80 overflow-y-auto">
      <label class="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
        <Checkbox :model-value="allNamespacesSelected" @update:model-value="toggleAllNamespaces" />
        <span class="truncate">{{ $t('resourceList.namespaceFilter.all') }}</span>
      </label>
      <DropdownMenuSeparator />
      <label v-for="ns in store.availableNamespaces" :key="ns" class="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
        <Checkbox :model-value="!store.excludedNamespaces.includes(ns)" @update:model-value="() => store.toggleNamespace(ns)" />
        <span class="truncate">{{ ns }}</span>
      </label>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
