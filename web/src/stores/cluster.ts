import { defineStore } from 'pinia'
import { i18n } from '@/i18n'

export interface K8sContext {
  name: string
  cluster: string
  namespace: string | null
  isCurrent: boolean
}

export type ResourceKind = 'deployments' | 'services' | 'pods'

export interface SelectedResource {
  kind: ResourceKind
  namespace: string
  name: string
}

interface ClusterState {
  contexts: K8sContext[]
  contextsStatus: 'idle' | 'loading' | 'ready' | 'error'
  currentContext: string | null
  deployments: any[]
  services: any[]
  pods: any[]
  resourcesStatus: 'idle' | 'loading' | 'ready' | 'error'
  resourcesError: string | null
  isRefreshing: boolean
  lastUpdatedAt: number | null
  loadedForContext: string | null
  selectedResource: SelectedResource | null
  podMetrics: Record<string, any>
  metricsStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
  metricsUpdatedAt: number | null
  filterText: string
}

export const useClusterStore = defineStore('cluster', {
  state: (): ClusterState => ({
    contexts: [],
    contextsStatus: 'idle',
    currentContext: null,
    deployments: [],
    services: [],
    pods: [],
    resourcesStatus: 'idle',
    resourcesError: null,
    isRefreshing: false,
    lastUpdatedAt: null,
    loadedForContext: null,
    selectedResource: null,
    podMetrics: {},
    metricsStatus: 'idle',
    metricsUpdatedAt: null,
    filterText: '',
  }),

  getters: {
    resourcesByKind: (state) => (kind: ResourceKind) => {
      if (kind === 'deployments') return state.deployments
      if (kind === 'services') return state.services
      return state.pods
    },
    selectedResourceObject(state): any | null {
      if (!state.selectedResource) return null
      const { kind, namespace, name } = state.selectedResource
      const list = kind === 'deployments' ? state.deployments : kind === 'services' ? state.services : state.pods
      return list.find((item) => item.metadata?.namespace === namespace && item.metadata?.name === name) || null
    },
  },

  actions: {
    async fetchContexts() {
      this.contextsStatus = 'loading'
      try {
        const res = await fetch('/api/contexts')
        const data = await res.json()
        this.contexts = data.contexts
        this.contextsStatus = 'ready'
      } catch (err: any) {
        this.contextsStatus = 'error'
        throw err
      }
    },

    async loadResources(context: string, options: { force?: boolean } = {}) {
      const alreadyLoaded = this.loadedForContext === context && this.resourcesStatus === 'ready'
      if (alreadyLoaded && !options.force) return

      if (alreadyLoaded) {
        this.isRefreshing = true
      } else {
        this.resourcesStatus = 'loading'
      }
      this.resourcesError = null
      try {
        const res = await fetch(`/api/${encodeURIComponent(context)}/resources`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || i18n.global.t('errors.loadResourcesFailed', { status: res.status }))
        }
        const data = await res.json()
        this.deployments = data.deployments
        this.services = data.services
        this.pods = data.pods
        this.currentContext = context
        this.loadedForContext = context
        this.resourcesStatus = 'ready'
        this.lastUpdatedAt = Date.now()
      } catch (err: any) {
        if (!alreadyLoaded) this.resourcesStatus = 'error'
        this.resourcesError = err.message
        throw err
      } finally {
        this.isRefreshing = false
      }
    },

    async loadMetrics(context: string, options: { force?: boolean } = {}) {
      if (this.metricsStatus === 'ready' && !options.force) return
      if (this.metricsStatus === 'idle') this.metricsStatus = 'loading'
      try {
        const res = await fetch(`/api/${encodeURIComponent(context)}/metrics/pods`)
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const byKey: Record<string, any> = {}
        for (const metric of data.items || []) {
          byKey[`${metric.metadata.namespace}/${metric.metadata.name}`] = metric
        }
        this.podMetrics = byKey
        this.metricsStatus = 'ready'
        this.metricsUpdatedAt = Date.now()
      } catch {
        this.metricsStatus = 'unavailable'
      }
    },

    selectResource(kind: ResourceKind, namespace: string, name: string) {
      this.selectedResource = { kind, namespace, name }
    },

    clearSelection() {
      this.selectedResource = null
    },

    setFilterText(value: string) {
      this.filterText = value
    },

    resetForNewContext() {
      this.deployments = []
      this.services = []
      this.pods = []
      this.resourcesStatus = 'idle'
      this.lastUpdatedAt = null
      this.loadedForContext = null
      this.selectedResource = null
      this.podMetrics = {}
      this.metricsStatus = 'idle'
      this.metricsUpdatedAt = null
      this.filterText = ''
    },
  },
})
