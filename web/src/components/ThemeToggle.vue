<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui/button'
import { SunIcon, MoonIcon } from '@lucide/vue'

const mode = useTheme()
const isDark = computed(() => mode.value === 'dark')

function toggle() {
  mode.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <Button variant="ghost" size="icon-sm" @click="toggle" :aria-label="isDark ? $t('common.enableLightMode') : $t('common.enableDarkMode')">
    <SunIcon v-if="isDark" />
    <MoonIcon v-else />
  </Button>
</template>
