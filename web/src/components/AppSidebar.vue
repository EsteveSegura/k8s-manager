<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import type { ResourceKind } from '@/stores/cluster'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import {
  BoxesIcon,
  NetworkIcon,
  ContainerIcon,
  SettingsIcon,
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
  PuzzleIcon,
  ShipWheelIcon,
  ActivityIcon,
} from '@lucide/vue'

const store = useClusterStore()
const route = useRoute()
const router = useRouter()
const settingsDialog = useSettingsDialog()

const context = computed(() => String(route.params.context || ''))

interface NavItem {
  kind: ResourceKind
  label: string
  icon: typeof BoxesIcon
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'sidebar.workloads',
    items: [
      { kind: 'deployments', label: 'Deployments', icon: BoxesIcon },
      { kind: 'statefulsets', label: 'StatefulSets', icon: DatabaseIcon },
      { kind: 'daemonsets', label: 'DaemonSets', icon: LayersIcon },
      { kind: 'jobs', label: 'Jobs', icon: ListChecksIcon },
      { kind: 'cronjobs', label: 'CronJobs', icon: CalendarClockIcon },
      { kind: 'pods', label: 'Pods', icon: ContainerIcon },
    ],
  },
  {
    label: 'sidebar.network',
    items: [
      { kind: 'services', label: 'Services', icon: NetworkIcon },
      { kind: 'ingresses', label: 'Ingress', icon: RouteIcon },
    ],
  },
  {
    label: 'sidebar.configAndStorage',
    items: [
      { kind: 'configmaps', label: 'ConfigMaps', icon: FileTextIcon },
      { kind: 'secrets', label: 'Secrets', icon: KeyRoundIcon },
      { kind: 'persistentvolumeclaims', label: 'PersistentVolumeClaims', icon: SaveIcon },
      { kind: 'persistentvolumes', label: 'PersistentVolumes', icon: HardDriveIcon },
    ],
  },
]

function countFor(kind: ResourceKind) {
  return store.resourcesByKind(kind).length
}

function goTo(kind: string) {
  router.push(`/${context.value}/${kind}`)
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <div class="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
        <div class="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
          <span class="text-xs text-muted-foreground">{{ $t('common.cluster') }}</span>
          <span class="truncate text-sm font-medium">{{ context }}</span>
        </div>
        <SidebarTrigger class="shrink-0" />
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup v-for="group in navGroups" :key="group.label">
        <SidebarGroupLabel>{{ $t(group.label) }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in group.items" :key="item.kind">
              <SidebarMenuButton
                :is-active="route.name === item.kind || route.params.kind === item.kind"
                :tooltip="item.label"
                @click="goTo(item.kind)"
              >
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </SidebarMenuButton>
              <Badge variant="secondary" class="absolute right-2 top-1.5 group-data-[collapsible=icon]:hidden">
                {{ countFor(item.kind) }}
              </Badge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>{{ $t('sidebar.cluster') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton :is-active="route.name === 'nodes' || route.params.kind === 'nodes'" tooltip="Nodes" @click="goTo('nodes')">
                <ServerIcon />
                <span>Nodes</span>
              </SidebarMenuButton>
              <Badge variant="secondary" class="absolute right-2 top-1.5 group-data-[collapsible=icon]:hidden">
                {{ countFor('nodes') }}
              </Badge>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton :is-active="route.name === 'events'" :tooltip="$t('events.title')" @click="router.push(`/${context}/events`)">
                <ActivityIcon />
                <span>{{ $t('events.title') }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>{{ $t('sidebar.extensions') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton :is-active="route.name === 'crds'" tooltip="CRDs" @click="router.push(`/${context}/crds`)">
                <PuzzleIcon />
                <span>CRDs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton :is-active="route.name === 'helm'" tooltip="Helm" @click="router.push(`/${context}/helm`)">
                <ShipWheelIcon />
                <span>Helm</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="border-t border-sidebar-border bg-black/5 dark:bg-black/20">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton :tooltip="$t('common.settings')" @click="settingsDialog.open()">
            <SettingsIcon />
            <span>{{ $t('common.settings') }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
