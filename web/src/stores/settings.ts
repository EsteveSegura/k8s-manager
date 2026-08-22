import { defineStore } from 'pinia'
import type { ResourceKind } from '@/stores/cluster'

export const MIN_REFRESH_SECONDS = 5
export const MAX_REFRESH_SECONDS = 600
const DEFAULT_REFRESH_SECONDS = 15

const REFRESH_SECONDS_KEY = 'settings.refreshIntervalSeconds'
const AUTO_REFRESH_KEY = 'settings.autoRefresh'
const PINNED_KINDS_KEY = 'settings.pinnedKinds'
const COLLAPSED_SIDEBAR_GROUPS_KEY = 'settings.collapsedSidebarGroups'

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

function loadPinnedKinds(): ResourceKind[] {
  try {
    const raw = localStorage.getItem(PINNED_KINDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadCollapsedSidebarGroups(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_SIDEBAR_GROUPS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

interface SettingsState {
  refreshIntervalSeconds: number
  autoRefresh: boolean
  pinnedKinds: ResourceKind[]
  collapsedSidebarGroups: string[]
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    refreshIntervalSeconds: loadRefreshSeconds(),
    autoRefresh: loadAutoRefresh(),
    pinnedKinds: loadPinnedKinds(),
    collapsedSidebarGroups: loadCollapsedSidebarGroups(),
  }),

  getters: {
    refreshIntervalMs: (state) => state.refreshIntervalSeconds * 1000,
    isPinned: (state) => (kind: ResourceKind) => state.pinnedKinds.includes(kind),
    isSidebarGroupCollapsed: (state) => (key: string) => state.collapsedSidebarGroups.includes(key),
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

    togglePinned(kind: ResourceKind) {
      const idx = this.pinnedKinds.indexOf(kind)
      if (idx === -1) this.pinnedKinds.push(kind)
      else this.pinnedKinds.splice(idx, 1)
      localStorage.setItem(PINNED_KINDS_KEY, JSON.stringify(this.pinnedKinds))
    },

    setSidebarGroupOpen(key: string, open: boolean) {
      const idx = this.collapsedSidebarGroups.indexOf(key)
      if (open && idx !== -1) this.collapsedSidebarGroups.splice(idx, 1)
      else if (!open && idx === -1) this.collapsedSidebarGroups.push(key)
      else return
      localStorage.setItem(COLLAPSED_SIDEBAR_GROUPS_KEY, JSON.stringify(this.collapsedSidebarGroups))
    },
  },
})
