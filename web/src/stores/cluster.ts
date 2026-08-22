import { defineStore } from 'pinia'
import { i18n } from '@/i18n'

export interface K8sContext {
  name: string
  cluster: string
  namespace: string | null
  isCurrent: boolean
}

export type ResourceKind =
  | 'deployments'
  | 'services'
  | 'pods'
  | 'statefulsets'
  | 'daemonsets'
  | 'jobs'
  | 'cronjobs'
  | 'ingresses'
  | 'configmaps'
  | 'secrets'
  | 'persistentvolumeclaims'
  | 'persistentvolumes'
  | 'nodes'

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
  statefulsets: any[]
  daemonsets: any[]
  jobs: any[]
  cronjobs: any[]
  ingresses: any[]
  configmaps: any[]
  secrets: any[]
  persistentvolumeclaims: any[]
  persistentvolumes: any[]
  nodes: any[]
  resourcesStatus: 'idle' | 'loading' | 'ready' | 'error'
  resourcesError: string | null
  resourceErrors: Partial<Record<ResourceKind, string>>
  isRefreshing: boolean
  lastUpdatedAt: number | null
  loadedForContext: string | null
  selectedResource: SelectedResource | null
  podMetrics: Record<string, any>
  metricsStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
  metricsUpdatedAt: number | null
  nodeMetrics: Record<string, any>
  nodeMetricsStatus: 'idle' | 'loading' | 'ready' | 'unavailable'
  nodeMetricsUpdatedAt: number | null
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
    statefulsets: [],
    daemonsets: [],
    jobs: [],
    cronjobs: [],
    ingresses: [],
    configmaps: [],
    secrets: [],
    persistentvolumeclaims: [],
    persistentvolumes: [],
    nodes: [],
    resourcesStatus: 'idle',
    resourcesError: null,
    resourceErrors: {},
    isRefreshing: false,
    lastUpdatedAt: null,
    loadedForContext: null,
    selectedResource: null,
    podMetrics: {},
    metricsStatus: 'idle',
    metricsUpdatedAt: null,
    nodeMetrics: {},
    nodeMetricsStatus: 'idle',
    nodeMetricsUpdatedAt: null,
    filterText: '',
  }),

  getters: {
    resourcesByKind: (state) => (kind: ResourceKind): any[] => {
      const byKind: Record<ResourceKind, any[]> = {
        deployments: state.deployments,
        services: state.services,
        pods: state.pods,
        statefulsets: state.statefulsets,
        daemonsets: state.daemonsets,
        jobs: state.jobs,
        cronjobs: state.cronjobs,
        ingresses: state.ingresses,
        configmaps: state.configmaps,
        secrets: state.secrets,
        persistentvolumeclaims: state.persistentvolumeclaims,
        persistentvolumes: state.persistentvolumes,
        nodes: state.nodes,
      }
      return byKind[kind]
    },
    selectedResourceObject(): any | null {
      if (!this.selectedResource) return null
      const { kind, namespace, name } = this.selectedResource
      // Los recursos de clúster (PersistentVolumes, Nodes) no tienen namespace real:
      // si el propio recurso no tiene namespace, basta con hacer match por nombre.
      return (
        this.resourcesByKind(kind).find(
          (item: any) => item.metadata?.name === name && (item.metadata?.namespace == null || item.metadata?.namespace === namespace),
        ) || null
      )
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
        this.statefulsets = data.statefulsets
        this.daemonsets = data.daemonsets
        this.jobs = data.jobs
        this.cronjobs = data.cronjobs
        this.ingresses = data.ingresses
        this.configmaps = data.configmaps
        this.secrets = data.secrets
        this.persistentvolumeclaims = data.persistentvolumeclaims
        this.persistentvolumes = data.persistentvolumes
        this.nodes = data.nodes
        this.resourceErrors = data.errors || {}
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

    async loadNodeMetrics(context: string, options: { force?: boolean } = {}) {
      if (this.nodeMetricsStatus === 'ready' && !options.force) return
      if (this.nodeMetricsStatus === 'idle') this.nodeMetricsStatus = 'loading'
      try {
        const res = await fetch(`/api/${encodeURIComponent(context)}/metrics/nodes`)
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const data = await res.json()
        const byKey: Record<string, any> = {}
        for (const metric of data.items || []) {
          byKey[metric.metadata.name] = metric
        }
        this.nodeMetrics = byKey
        this.nodeMetricsStatus = 'ready'
        this.nodeMetricsUpdatedAt = Date.now()
      } catch {
        this.nodeMetricsStatus = 'unavailable'
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
      this.statefulsets = []
      this.daemonsets = []
      this.jobs = []
      this.cronjobs = []
      this.ingresses = []
      this.configmaps = []
      this.secrets = []
      this.persistentvolumeclaims = []
      this.persistentvolumes = []
      this.nodes = []
      this.resourceErrors = {}
      this.resourcesStatus = 'idle'
      this.lastUpdatedAt = null
      this.loadedForContext = null
      this.selectedResource = null
      this.podMetrics = {}
      this.metricsStatus = 'idle'
      this.metricsUpdatedAt = null
      this.nodeMetrics = {}
      this.nodeMetricsStatus = 'idle'
      this.nodeMetricsUpdatedAt = null
      this.filterText = ''
    },
  },
})
