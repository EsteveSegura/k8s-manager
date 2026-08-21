<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { SettingsIcon, BoxesIcon, NetworkIcon, ContainerIcon } from '@lucide/vue'
import type { ResourceKind } from '@/stores/cluster'

const store = useClusterStore()
const router = useRouter()
const settingsDialog = useSettingsDialog()
const open = ref(false)
const query = ref('')

const groups: { kind: ResourceKind; label: string; icon: typeof BoxesIcon }[] = [
  { kind: 'deployments', label: 'Deployments', icon: BoxesIcon },
  { kind: 'services', label: 'Services', icon: NetworkIcon },
  { kind: 'pods', label: 'Pods', icon: ContainerIcon },
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

function openSettings() {
  open.value = false
  settingsDialog.open()
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

      <CommandGroup :heading="$t('commandPalette.commandsHeading')">
        <CommandItem value="settings" @select="openSettings">
          <SettingsIcon class="text-muted-foreground" />
          <span>{{ $t('settings.title') }}</span>
          <CommandShortcut class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-wide">
            {{ $t('commandPalette.commandBadge') }}
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator class="[[hidden]+&]:hidden" />

      <CommandGroup v-for="group in groups" :key="group.kind" :heading="group.label">
        <CommandItem
          v-for="item in store.resourcesByKind(group.kind)"
          :key="`${group.kind}-${item.metadata.namespace}-${item.metadata.name}`"
          :value="`${item.metadata.namespace}/${item.metadata.name}`"
          @select="selectItem(group.kind, item)"
        >
          <component :is="group.icon" class="text-muted-foreground" />
          <span class="truncate">
            <span class="text-muted-foreground">{{ item.metadata.namespace }}/</span>{{ item.metadata.name }}
          </span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
