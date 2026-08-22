<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
import type { ResourceKind } from '@/stores/cluster'
import { useSettingsStore } from '@/stores/settings'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
  LayoutDashboardIcon,
  GaugeIcon,
  FolderIcon,
  ScaleIcon,
  SlidersHorizontalIcon,
  ShieldIcon,
  CableIcon,
  UmbrellaIcon,
  PinIcon,
  PinOffIcon,
  ChevronDownIcon,
} from '@lucide/vue'

const store = useClusterStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const settingsDialog = useSettingsDialog()

const context = computed(() => String(route.params.context || ''))

watch(
  context,
  (value) => {
    if (value) store.loadNamespaceFilter(value)
  },
  { immediate: true },
)

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
      { kind: 'horizontalpodautoscalers', label: 'HorizontalPodAutoscalers', icon: GaugeIcon },
    ],
  },
  {
    label: 'sidebar.network',
    items: [
      { kind: 'services', label: 'Services', icon: NetworkIcon },
      { kind: 'ingresses', label: 'Ingress', icon: RouteIcon },
      { kind: 'networkpolicies', label: 'NetworkPolicies', icon: ShieldIcon },
      { kind: 'endpoints', label: 'Endpoints', icon: CableIcon },
    ],
  },
  {
    label: 'sidebar.configAndStorage',
    items: [
      { kind: 'configmaps', label: 'ConfigMaps', icon: FileTextIcon },
      { kind: 'secrets', label: 'Secrets', icon: KeyRoundIcon },
      { kind: 'persistentvolumeclaims', label: 'PersistentVolumeClaims', icon: SaveIcon },
      { kind: 'persistentvolumes', label: 'PersistentVolumes', icon: HardDriveIcon },
      { kind: 'resourcequotas', label: 'ResourceQuotas', icon: ScaleIcon },
      { kind: 'limitranges', label: 'LimitRanges', icon: SlidersHorizontalIcon },
    ],
  },
]

const clusterItems: NavItem[] = [
  { kind: 'namespaces', label: 'Namespaces', icon: FolderIcon },
  { kind: 'nodes', label: 'Nodes', icon: ServerIcon },
  { kind: 'poddisruptionbudgets', label: 'PodDisruptionBudgets', icon: UmbrellaIcon },
]

const itemByKind = new Map<ResourceKind, NavItem>([...navGroups.flatMap((group) => group.items), ...clusterItems].map((item) => [item.kind, item]))

const pinnedItems = computed(() => settings.pinnedKinds.map((kind) => itemByKind.get(kind)).filter((item): item is NavItem => !!item))

function countFor(kind: ResourceKind) {
  return store.resourcesByKind(kind).filter((item: any) => store.isNamespaceVisible(item.metadata?.namespace)).length
}

function goTo(kind: string) {
  router.push(`/${context.value}/${kind}`)
}

function togglePin(kind: ResourceKind, event: Event) {
  event.stopPropagation()
  settings.togglePinned(kind)
  // Sin esto, el botón se queda enfocado tras el click y la fila original se
  // queda "atascada" mostrando el icono de pin en vez de volver al contador,
  // ya que group-focus-within no se libera hasta que el foco se mueve.
  ;(event.currentTarget as HTMLElement | null)?.blur()
}

function isGroupOpen(key: string) {
  return !settings.isSidebarGroupCollapsed(key)
}

function setGroupOpen(key: string, open: boolean) {
  settings.setSidebarGroupOpen(key, open)
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
      <Collapsible
        class="group/collapsible"
        :open="isGroupOpen('sidebar.main')"
        @update:open="(open) => setGroupOpen('sidebar.main', open)"
      >
        <SidebarGroup>
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel class="cursor-pointer">
              <span>{{ $t('sidebar.main') }}</span>
              <ChevronDownIcon class="ml-auto shrink-0 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    :is-active="route.name === 'dashboard'"
                    :tooltip="$t('dashboard.title')"
                    @click="router.push(`/${context}/dashboard`)"
                  >
                    <LayoutDashboardIcon />
                    <span>{{ $t('dashboard.title') }}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem v-for="item in pinnedItems" :key="`pinned-${item.kind}`">
                  <SidebarMenuButton
                    :is-active="route.name === item.kind || route.params.kind === item.kind"
                    :tooltip="item.label"
                    @click="goTo(item.kind)"
                  >
                    <component :is="item.icon" />
                    <span>{{ item.label }}</span>
                  </SidebarMenuButton>
                  <Badge
                    variant="secondary"
                    class="absolute right-2 top-1.5 group-hover/menu-item:hidden group-focus-within/menu-item:hidden group-data-[collapsible=icon]:hidden"
                  >
                    {{ countFor(item.kind) }}
                  </Badge>
                  <SidebarMenuAction show-on-hover class="right-2" :aria-label="$t('sidebar.unpin')" @click="togglePin(item.kind, $event)">
                    <PinOffIcon />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <Collapsible
        v-for="group in navGroups"
        :key="group.label"
        class="group/collapsible"
        :open="isGroupOpen(group.label)"
        @update:open="(open) => setGroupOpen(group.label, open)"
      >
        <SidebarGroup>
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel class="cursor-pointer">
              <span>{{ $t(group.label) }}</span>
              <ChevronDownIcon class="ml-auto shrink-0 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
                  <Badge
                    variant="secondary"
                    class="absolute right-2 top-1.5 group-hover/menu-item:hidden group-focus-within/menu-item:hidden group-data-[collapsible=icon]:hidden"
                  >
                    {{ countFor(item.kind) }}
                  </Badge>
                  <SidebarMenuAction
                    show-on-hover
                    class="right-2"
                    :aria-label="settings.isPinned(item.kind) ? $t('sidebar.unpin') : $t('sidebar.pin')"
                    @click="togglePin(item.kind, $event)"
                  >
                    <component :is="settings.isPinned(item.kind) ? PinOffIcon : PinIcon" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <Collapsible
        class="group/collapsible"
        :open="isGroupOpen('sidebar.cluster')"
        @update:open="(open) => setGroupOpen('sidebar.cluster', open)"
      >
        <SidebarGroup>
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel class="cursor-pointer">
              <span>{{ $t('sidebar.cluster') }}</span>
              <ChevronDownIcon class="ml-auto shrink-0 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem v-for="item in clusterItems" :key="item.kind">
                  <SidebarMenuButton
                    :is-active="route.name === item.kind || route.params.kind === item.kind"
                    :tooltip="item.label"
                    @click="goTo(item.kind)"
                  >
                    <component :is="item.icon" />
                    <span>{{ item.label }}</span>
                  </SidebarMenuButton>
                  <Badge
                    variant="secondary"
                    class="absolute right-2 top-1.5 group-hover/menu-item:hidden group-focus-within/menu-item:hidden group-data-[collapsible=icon]:hidden"
                  >
                    {{ countFor(item.kind) }}
                  </Badge>
                  <SidebarMenuAction
                    show-on-hover
                    class="right-2"
                    :aria-label="settings.isPinned(item.kind) ? $t('sidebar.unpin') : $t('sidebar.pin')"
                    @click="togglePin(item.kind, $event)"
                  >
                    <component :is="settings.isPinned(item.kind) ? PinOffIcon : PinIcon" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton :is-active="route.name === 'events'" :tooltip="$t('events.title')" @click="router.push(`/${context}/events`)">
                    <ActivityIcon />
                    <span>{{ $t('events.title') }}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>

      <Collapsible
        class="group/collapsible"
        :open="isGroupOpen('sidebar.extensions')"
        @update:open="(open) => setGroupOpen('sidebar.extensions', open)"
      >
        <SidebarGroup>
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel class="cursor-pointer">
              <span>{{ $t('sidebar.extensions') }}</span>
              <ChevronDownIcon class="ml-auto shrink-0 transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
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
