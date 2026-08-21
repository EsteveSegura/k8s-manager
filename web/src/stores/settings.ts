import { defineStore } from 'pinia'

export const MIN_REFRESH_SECONDS = 5
export const MAX_REFRESH_SECONDS = 600
const DEFAULT_REFRESH_SECONDS = 15

const REFRESH_SECONDS_KEY = 'settings.refreshIntervalSeconds'
const AUTO_REFRESH_KEY = 'settings.autoRefresh'

function loadRefreshSeconds(): number {
  const stored = Number(localStorage.getItem(REFRESH_SECONDS_KEY))
  if (Number.isFinite(stored) && stored >= MIN_REFRESH_SECONDS && stored <= MAX_REFRESH_SECONDS) return stored
  return DEFAULT_REFRESH_SECONDS
}

function loadAutoRefresh(): boolean {
  const stored = localStorage.getItem(AUTO_REFRESH_KEY)
  if (stored === null) return true
  return stored === 'true'
}

interface SettingsState {
  refreshIntervalSeconds: number
  autoRefresh: boolean
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    refreshIntervalSeconds: loadRefreshSeconds(),
    autoRefresh: loadAutoRefresh(),
  }),

  getters: {
    refreshIntervalMs: (state) => state.refreshIntervalSeconds * 1000,
  },

  actions: {
    setRefreshIntervalSeconds(value: number) {
      if (!Number.isFinite(value)) return
      const clamped = Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Math.round(value)))
      this.refreshIntervalSeconds = clamped
      localStorage.setItem(REFRESH_SECONDS_KEY, String(clamped))
    },

    setAutoRefresh(enabled: boolean) {
      this.autoRefresh = enabled
      localStorage.setItem(AUTO_REFRESH_KEY, String(enabled))
    },
  },
})
