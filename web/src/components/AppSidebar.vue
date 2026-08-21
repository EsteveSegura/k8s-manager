<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClusterStore } from '@/stores/cluster'
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
import { BoxesIcon, NetworkIcon, ContainerIcon, SettingsIcon } from '@lucide/vue'

const store = useClusterStore()
const route = useRoute()
const router = useRouter()
const settingsDialog = useSettingsDialog()

const context = computed(() => String(route.params.context || ''))

const navItems = [
  { kind: 'deployments', label: 'Deployments', icon: BoxesIcon },
  { kind: 'services', label: 'Services', icon: NetworkIcon },
  { kind: 'pods', label: 'Pods', icon: ContainerIcon },
] as const

function countFor(kind: 'deployments' | 'services' | 'pods') {
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
      <SidebarGroup>
        <SidebarGroupLabel>{{ $t('sidebar.resources') }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.kind">
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
    </SidebarContent>

    <SidebarFooter>
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
