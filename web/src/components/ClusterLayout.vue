<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
</script>

<template>
  <SidebarProvider class="h-svh">
    <AppSidebar />
    <SidebarInset class="min-w-0 min-h-0">
      <RouterView />
    </SidebarInset>
  </SidebarProvider>
</template>
