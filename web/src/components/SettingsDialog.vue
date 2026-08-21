<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORTED_LOCALES, type AppLocale } from '@/i18n'
import { useTheme } from '@/composables/useTheme'
import { useSettingsDialog } from '@/composables/useSettingsDialog'
import { useSettingsStore, MIN_REFRESH_SECONDS, MAX_REFRESH_SECONDS } from '@/stores/settings'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { InputGroup, InputGroupInput, InputGroupAddon } from '@/components/ui/input-group'

const { isOpen } = useSettingsDialog()
const { locale } = useI18n()
const mode = useTheme()
const settings = useSettingsStore()

const LOCALE_LABEL: Record<AppLocale, string> = { es: 'Español', en: 'English' }

const isDark = computed({
  get: () => mode.value === 'dark',
  set: (value: boolean) => {
    mode.value = value ? 'dark' : 'light'
  },
})

const autoRefresh = computed({
  get: () => settings.autoRefresh,
  set: (value: boolean) => settings.setAutoRefresh(value),
})

const refreshSecondsInput = ref(String(settings.refreshIntervalSeconds))

watch(
  () => settings.refreshIntervalSeconds,
  (value) => {
    refreshSecondsInput.value = String(value)
  },
)

function commitRefreshSeconds() {
  settings.setRefreshIntervalSeconds(Number(refreshSecondsInput.value))
  refreshSecondsInput.value = String(settings.refreshIntervalSeconds)
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t('settings.title') }}</DialogTitle>
        <DialogDescription>{{ $t('settings.description') }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5">
        <div class="flex items-center justify-between gap-4">
          <label for="settings-locale" class="text-sm font-medium">{{ $t('settings.language') }}</label>
          <Select :model-value="locale" @update:model-value="(value) => setLocale(value as AppLocale)">
            <SelectTrigger id="settings-locale" class="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
                  {{ LOCALE_LABEL[code] }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="settings-dark-mode" class="text-sm font-medium">{{ $t('settings.darkMode') }}</label>
          <Switch id="settings-dark-mode" v-model="isDark" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="settings-auto-refresh" class="text-sm font-medium">{{ $t('settings.autoRefresh') }}</label>
          <Switch id="settings-auto-refresh" v-model="autoRefresh" />
        </div>

        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5">
            <label for="settings-refresh-interval" class="text-sm font-medium">{{ $t('settings.refreshInterval') }}</label>
            <span class="text-xs text-muted-foreground">{{ $t('settings.refreshIntervalHint', { min: MIN_REFRESH_SECONDS, max: MAX_REFRESH_SECONDS }) }}</span>
          </div>
          <InputGroup class="w-24 shrink-0">
            <InputGroupInput
              id="settings-refresh-interval"
              v-model="refreshSecondsInput"
              type="number"
              :min="MIN_REFRESH_SECONDS"
              :max="MAX_REFRESH_SECONDS"
              :disabled="!autoRefresh"
              @blur="commitRefreshSeconds"
              @keydown.enter="commitRefreshSeconds"
            />
            <InputGroupAddon align="inline-end">s</InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
