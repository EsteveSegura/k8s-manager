<script setup lang="ts">
import { RouterView } from 'vue-router'
import CommandPalette from '@/components/CommandPalette.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
</script>

<template>
  <RouterView />
  <CommandPalette />
  <SettingsDialog />
</template>
