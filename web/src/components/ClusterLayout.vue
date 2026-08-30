<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <SidebarProvider class="h-svh" :open="settings.sidebarOpen" @update:open="settings.setSidebarOpen">
    <AppSidebar />
    <SidebarInset class="min-w-0 min-h-0">
      <RouterView />
    </SidebarInset>
  </SidebarProvider>
</template>
