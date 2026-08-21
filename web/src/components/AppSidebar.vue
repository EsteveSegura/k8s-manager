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
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { BoxesIcon, NetworkIcon, ContainerIcon, ArrowLeftIcon } from '@lucide/vue'

const store = useClusterStore()
const route = useRoute()
const router = useRouter()

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

function changeCluster() {
  store.resetForNewContext()
  router.push('/')
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <div class="flex items-center justify-between gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
        <div class="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
          <span class="text-xs text-muted-foreground">Cluster</span>
          <span class="truncate text-sm font-medium">{{ context }}</span>
        </div>
        <SidebarMenuButton as-child class="w-auto shrink-0" tooltip="Cambiar cluster" @click="changeCluster">
          <button type="button">
            <ArrowLeftIcon />
          </button>
        </SidebarMenuButton>
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Recursos</SidebarGroupLabel>
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
      <div class="flex items-center justify-between px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
        <span class="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Tema</span>
        <ThemeToggle />
      </div>
    </SidebarFooter>
  </Sidebar>
</template>
