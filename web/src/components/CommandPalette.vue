<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { resourcePath } from '@/lib/resource-kinds'
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
import {
  SettingsIcon,
  BoxesIcon,
  NetworkIcon,
  ContainerIcon,
  DatabaseIcon,
  LayersIcon,
  ListChecksIcon,
  CalendarClockIcon,
  RouteIcon,
  FileTextIcon,
  KeyRoundIcon,
  SaveIcon,
  HardDriveIcon,
  ServerIcon,
  ActivityIcon,
  PuzzleIcon,
  ShipWheelIcon,
  LayoutDashboardIcon,
} from '@lucide/vue'
import type { ResourceKind } from '@/stores/cluster'

const store = useClusterStore()
const route = useRoute()
const router = useRouter()
const settingsDialog = useSettingsDialog()
const open = ref(false)
const query = ref('')
const showResults = ref(false)

const groups: { kind: ResourceKind; label: string; icon: typeof BoxesIcon }[] = [
  { kind: 'deployments', label: 'Deployments', icon: BoxesIcon },
  { kind: 'statefulsets', label: 'StatefulSets', icon: DatabaseIcon },
  { kind: 'daemonsets', label: 'DaemonSets', icon: LayersIcon },
  { kind: 'jobs', label: 'Jobs', icon: ListChecksIcon },
  { kind: 'cronjobs', label: 'CronJobs', icon: CalendarClockIcon },
  { kind: 'pods', label: 'Pods', icon: ContainerIcon },
  { kind: 'services', label: 'Services', icon: NetworkIcon },
  { kind: 'ingresses', label: 'Ingress', icon: RouteIcon },
  { kind: 'configmaps', label: 'ConfigMaps', icon: FileTextIcon },
  { kind: 'secrets', label: 'Secrets', icon: KeyRoundIcon },
  { kind: 'persistentvolumeclaims', label: 'PersistentVolumeClaims', icon: SaveIcon },
  { kind: 'persistentvolumes', label: 'PersistentVolumes', icon: HardDriveIcon },
  { kind: 'nodes', label: 'Nodes', icon: ServerIcon },
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
  if (isOpen) {
    query.value = ''
    showResults.value = false

    const context = String(route.params.context || '')
    if (context) store.loadResources(context).catch(() => {})

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        showResults.value = true
      })
    })
  }
})

function selectItem(kind: ResourceKind, item: any) {
  open.value = false
  store.setFilterText(query.value)
  router.push(resourcePath(store.currentContext!, kind, item.metadata.namespace, item.metadata.name))
}

function openSettings() {
  open.value = false
  settingsDialog.open()
}

function goToPage(name: string) {
  open.value = false
  router.push(`/${store.currentContext}/${name}`)
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
        <CommandItem value="dashboard" @select="goToPage('dashboard')">
          <LayoutDashboardIcon class="text-muted-foreground" />
          <span>{{ $t('dashboard.title') }}</span>
          <CommandShortcut class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-wide">
            {{ $t('commandPalette.commandBadge') }}
          </CommandShortcut>
        </CommandItem>
        <CommandItem value="events" @select="goToPage('events')">
          <ActivityIcon class="text-muted-foreground" />
          <span>{{ $t('events.title') }}</span>
          <CommandShortcut class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-wide">
            {{ $t('commandPalette.commandBadge') }}
          </CommandShortcut>
        </CommandItem>
        <CommandItem value="crds" @select="goToPage('crds')">
          <PuzzleIcon class="text-muted-foreground" />
          <span>CRDs</span>
          <CommandShortcut class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-wide">
            {{ $t('commandPalette.commandBadge') }}
          </CommandShortcut>
        </CommandItem>
        <CommandItem value="helm" @select="goToPage('helm')">
          <ShipWheelIcon class="text-muted-foreground" />
          <span>Helm</span>
          <CommandShortcut class="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-wide">
            {{ $t('commandPalette.commandBadge') }}
          </CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <template v-if="showResults">
        <CommandSeparator class="[[hidden]+&]:hidden" />

        <CommandGroup v-for="group in groups" :key="group.kind" :heading="group.label">
          <CommandItem
            v-for="item in store.resourcesByKind(group.kind)"
            :key="`${group.kind}-${item.metadata.namespace}-${item.metadata.name}`"
            :value="item.metadata.namespace ? `${item.metadata.namespace}/${item.metadata.name}` : item.metadata.name"
            @select="selectItem(group.kind, item)"
          >
            <component :is="group.icon" class="text-muted-foreground" />
            <span class="truncate">
              <span v-if="item.metadata.namespace" class="text-muted-foreground">{{ item.metadata.namespace }}/</span>{{ item.metadata.name }}
            </span>
          </CommandItem>
        </CommandGroup>
      </template>
    </CommandList>
  </CommandDialog>
</template>
