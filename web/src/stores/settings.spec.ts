// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_REFRESH_SECONDS, MIN_REFRESH_SECONDS, useSettingsStore } from './settings'

// The store reads localStorage when it is first created, so every test seeds
// storage and then creates a fresh Pinia + store.
function createStore() {
  setActivePinia(createPinia())
  return useSettingsStore()
}

beforeEach(() => {
  localStorage.clear()
})

describe('settings store: initial state', () => {
  it('uses defaults with empty storage', () => {
    const store = createStore()
    expect(store.$id).toBe('settings')
    expect(store.refreshIntervalSeconds).toBe(15)
    expect(store.refreshIntervalMs).toBe(15000)
    expect(store.autoRefresh).toBe(true)
    expect(store.pinnedKinds).toEqual([])
    expect(store.collapsedSidebarGroups).toEqual([])
    expect(store.sidebarOpen).toBe(true)
  })

  it.each([
    ['5', 5],
    ['600', 600],
    ['30', 30],
    ['4', 15],
    ['601', 15],
    ['0', 15],
    ['-10', 15],
    ['abc', 15],
    ['', 15],
    ['Infinity', 15],
  ])('loads refresh interval %j as %d', (stored, expected) => {
    localStorage.setItem('settings.refreshIntervalSeconds', stored)
    expect(createStore().refreshIntervalSeconds).toBe(expected)
  })

  it.each([
    ['true', true],
    ['false', false],
    ['garbage', false],
  ])('loads autoRefresh/sidebarOpen %j as %s', (stored, expected) => {
    localStorage.setItem('settings.autoRefresh', stored)
    localStorage.setItem('settings.sidebarOpen', stored)
    const store = createStore()
    expect(store.autoRefresh).toBe(expected)
    expect(store.sidebarOpen).toBe(expected)
  })

  it('loads pinned kinds and collapsed groups from JSON', () => {
    localStorage.setItem('settings.pinnedKinds', JSON.stringify(['pods', 'nodes']))
    localStorage.setItem('settings.collapsedSidebarGroups', JSON.stringify(['storage']))
    const store = createStore()
    expect(store.pinnedKinds).toEqual(['pods', 'nodes'])
    expect(store.isPinned('pods')).toBe(true)
    expect(store.isPinned('services')).toBe(false)
    expect(store.collapsedSidebarGroups).toEqual(['storage'])
    expect(store.isSidebarGroupCollapsed('storage')).toBe(true)
    expect(store.isSidebarGroupCollapsed('network')).toBe(false)
  })

  it('falls back to empty lists when stored JSON is corrupt', () => {
    localStorage.setItem('settings.pinnedKinds', '{not json')
    localStorage.setItem('settings.collapsedSidebarGroups', '[oops')
    const store = createStore()
    expect(store.pinnedKinds).toEqual([])
    expect(store.collapsedSidebarGroups).toEqual([])
  })
})

describe('settings store: actions', () => {
  it('clamps, rounds and persists the refresh interval', () => {
    const store = createStore()
    store.setRefreshIntervalSeconds(1)
    expect(store.refreshIntervalSeconds).toBe(MIN_REFRESH_SECONDS)
    expect(localStorage.getItem('settings.refreshIntervalSeconds')).toBe('5')

    store.setRefreshIntervalSeconds(10_000)
    expect(store.refreshIntervalSeconds).toBe(MAX_REFRESH_SECONDS)
    expect(localStorage.getItem('settings.refreshIntervalSeconds')).toBe('600')

    store.setRefreshIntervalSeconds(29.6)
    expect(store.refreshIntervalSeconds).toBe(30)
    expect(store.refreshIntervalMs).toBe(30_000)
    expect(localStorage.getItem('settings.refreshIntervalSeconds')).toBe('30')

    store.setRefreshIntervalSeconds(5)
    expect(store.refreshIntervalSeconds).toBe(5)
    store.setRefreshIntervalSeconds(600)
    expect(store.refreshIntervalSeconds).toBe(600)
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('ignores non-finite refresh interval %d', (value) => {
    const store = createStore()
    store.setRefreshIntervalSeconds(value)
    expect(store.refreshIntervalSeconds).toBe(15)
    expect(localStorage.getItem('settings.refreshIntervalSeconds')).toBeNull()
  })

  it('persisted settings survive a reload', () => {
    const store = createStore()
    store.setRefreshIntervalSeconds(42)
    store.setAutoRefresh(false)
    store.setSidebarOpen(false)
    store.togglePinned('pods')
    store.setSidebarGroupOpen('storage', false)

    const reloaded = createStore()
    expect(reloaded.refreshIntervalSeconds).toBe(42)
    expect(reloaded.autoRefresh).toBe(false)
    expect(reloaded.sidebarOpen).toBe(false)
    expect(reloaded.pinnedKinds).toEqual(['pods'])
    expect(reloaded.collapsedSidebarGroups).toEqual(['storage'])
  })

  it('setAutoRefresh and setSidebarOpen persist booleans as strings', () => {
    const store = createStore()
    store.setAutoRefresh(false)
    store.setSidebarOpen(false)
    expect(localStorage.getItem('settings.autoRefresh')).toBe('false')
    expect(localStorage.getItem('settings.sidebarOpen')).toBe('false')
    store.setAutoRefresh(true)
    store.setSidebarOpen(true)
    expect(store.autoRefresh).toBe(true)
    expect(store.sidebarOpen).toBe(true)
    expect(localStorage.getItem('settings.autoRefresh')).toBe('true')
    expect(localStorage.getItem('settings.sidebarOpen')).toBe('true')
  })

  it('togglePinned adds and removes kinds, persisting each change', () => {
    const store = createStore()
    store.togglePinned('pods')
    store.togglePinned('nodes')
    expect(store.pinnedKinds).toEqual(['pods', 'nodes'])
    expect(JSON.parse(localStorage.getItem('settings.pinnedKinds')!)).toEqual(['pods', 'nodes'])
    store.togglePinned('pods')
    expect(store.pinnedKinds).toEqual(['nodes'])
    expect(JSON.parse(localStorage.getItem('settings.pinnedKinds')!)).toEqual(['nodes'])
  })

  it('setSidebarGroupOpen collapses and expands groups idempotently', () => {
    const store = createStore()
    store.setSidebarGroupOpen('storage', false)
    store.setSidebarGroupOpen('network', false)
    store.setSidebarGroupOpen('storage', false)
    expect(store.collapsedSidebarGroups).toEqual(['storage', 'network'])
    expect(JSON.parse(localStorage.getItem('settings.collapsedSidebarGroups')!)).toEqual(['storage', 'network'])

    store.setSidebarGroupOpen('storage', true)
    expect(store.collapsedSidebarGroups).toEqual(['network'])
    expect(JSON.parse(localStorage.getItem('settings.collapsedSidebarGroups')!)).toEqual(['network'])
  })

  it('setSidebarGroupOpen does not write storage when nothing changes', () => {
    const store = createStore()
    store.setSidebarGroupOpen('storage', true)
    expect(localStorage.getItem('settings.collapsedSidebarGroups')).toBeNull()
    store.setSidebarGroupOpen('storage', false)
    localStorage.removeItem('settings.collapsedSidebarGroups')
    store.setSidebarGroupOpen('storage', false)
    expect(localStorage.getItem('settings.collapsedSidebarGroups')).toBeNull()
  })
})
