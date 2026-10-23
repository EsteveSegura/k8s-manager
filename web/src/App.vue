<script setup lang="ts">
import { RouterView } from 'vue-router'
import CommandPalette from '@/components/CommandPalette.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
</script>

<template>
  <!-- Transparent drag area behind the macOS traffic lights; only rendered in the desktop app (see .electron-mac in style.css). -->
  <div class="electron-titlebar" aria-hidden="true" />
  <RouterView />
  <CommandPalette />
  <SettingsDialog />
</template>
