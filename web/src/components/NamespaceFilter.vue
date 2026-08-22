<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClusterStore } from '@/stores/cluster'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
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
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuCheckboxItem :model-value="allNamespacesSelected" @select.prevent="toggleAllNamespaces">
        {{ $t('resourceList.namespaceFilter.all') }}
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        v-for="ns in store.availableNamespaces"
        :key="ns"
        :model-value="!store.excludedNamespaces.includes(ns)"
        @select.prevent="store.toggleNamespace(ns)"
      >
        {{ ns }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
