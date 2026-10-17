// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toRaw } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { setLocale } from '@/i18n'
import { useClusterStore, type ResourceKind } from './cluster'

const ALL_KINDS: ResourceKind[] = [
  'deployments',
  'services',
  'pods',
  'statefulsets',
  'daemonsets',
  'jobs',
  'cronjobs',
  'ingresses',
  'configmaps',
  'secrets',
  'persistentvolumeclaims',
  'persistentvolumes',
  'nodes',
  'horizontalpodautoscalers',
  'namespaces',
  'resourcequotas',
  'limitranges',
  'networkpolicies',
  'endpoints',
  'poddisruptionbudgets',
]

const item = (name: string, namespace?: string) => ({ metadata: { name, namespace } })

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function resourcesPayload(overrides: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = {}
  for (const kind of ALL_KINDS) payload[kind] = [item(`${kind}-1`, 'default')]
  return { ...payload, ...overrides }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  setLocale('en')
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('initial state', () => {
  it('starts empty and idle', () => {
    const store = useClusterStore()
    expect(store.$id).toBe('cluster')
    const empty = Object.fromEntries(ALL_KINDS.map((kind) => [kind, []]))
    expect(store.$state).toEqual({
      ...empty,
      contexts: [],
      contextsStatus: 'idle',
      currentContext: null,
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
      excludedNamespaces: [],
    })
  })
})

describe('fetchContexts', () => {
  it('loads contexts and marks them ready', async () => {
    const store = useClusterStore()
    const contexts = [{ name: 'kind', cluster: 'kind', namespace: null }]
    fetchMock.mockResolvedValue(jsonResponse({ contexts }))
    const promise = store.fetchContexts()
    expect(store.contextsStatus).toBe('loading')
    await promise
    expect(fetchMock).toHaveBeenCalledWith('/api/contexts')
    expect(store.contexts).toEqual(contexts)
    expect(store.contextsStatus).toBe('ready')
  })

  it('marks an error and rethrows when the request fails', async () => {
    const store = useClusterStore()
    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(store.fetchContexts()).rejects.toThrow('offline')
    expect(store.contextsStatus).toBe('error')
  })
})

describe('loadResources', () => {
  it('fetches every resource kind for the (URL-encoded) context', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse(resourcesPayload({ errors: { secrets: 'forbidden' } })))
    const promise = store.loadResources('arn:aws/eks cluster')
    expect(store.resourcesStatus).toBe('loading')
    expect(store.isRefreshing).toBe(false)
    await promise

    expect(fetchMock).toHaveBeenCalledWith('/api/arn%3Aaws%2Feks%20cluster/resources')
    for (const kind of ALL_KINDS) {
      expect(store.resourcesByKind(kind)).toEqual([item(`${kind}-1`, 'default')])
      expect((store as any)[kind]).toEqual([item(`${kind}-1`, 'default')])
    }
    expect(store.resourceErrors).toEqual({ secrets: 'forbidden' })
    expect(store.currentContext).toBe('arn:aws/eks cluster')
    expect(store.loadedForContext).toBe('arn:aws/eks cluster')
    expect(store.resourcesStatus).toBe('ready')
    expect(store.resourcesError).toBeNull()
    expect(store.lastUpdatedAt).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('defaults resourceErrors to an empty object', async () => {
    const store = useClusterStore()
    store.resourceErrors = { pods: 'stale' }
    fetchMock.mockResolvedValue(jsonResponse(resourcesPayload()))
    await store.loadResources('ctx')
    expect(store.resourceErrors).toEqual({})
  })

  it('does not refetch an already loaded context unless forced', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse(resourcesPayload()))
    await store.loadResources('ctx')
    await store.loadResources('ctx')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
    const promise = store.loadResources('ctx', { force: true })
    expect(store.isRefreshing).toBe(true)
    expect(store.resourcesStatus).toBe('ready')
    await promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.isRefreshing).toBe(false)
    expect(store.lastUpdatedAt).toBe(Date.parse('2026-01-01T00:01:00Z'))
  })

  it('loads again when switching to a different context', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse(resourcesPayload()))
    await store.loadResources('a')
    const promise = store.loadResources('b')
    expect(store.resourcesStatus).toBe('loading')
    expect(store.isRefreshing).toBe(false)
    await promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.loadedForContext).toBe('b')
  })

  it('reloads the same context if the previous load failed', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValueOnce(jsonResponse(resourcesPayload()))
    await store.loadResources('ctx')
    store.resourcesStatus = 'error'
    fetchMock.mockResolvedValueOnce(jsonResponse(resourcesPayload()))
    await store.loadResources('ctx')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses the server error message on HTTP errors', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({ error: 'context not found' }, { status: 404 }))
    await expect(store.loadResources('ctx')).rejects.toThrow('context not found')
    expect(store.resourcesStatus).toBe('error')
    expect(store.resourcesError).toBe('context not found')
    expect(store.loadedForContext).toBeNull()
  })

  it('falls back to a translated message with the status when the error body is not JSON', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => Promise.reject(new SyntaxError('bad json')) } as unknown as Response)
    await expect(store.loadResources('ctx')).rejects.toThrow('Error 502 while loading resources')
    expect(store.resourcesError).toBe('Error 502 while loading resources')
  })

  it('falls back to the translated message when the error body has no error field', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }))
    await expect(store.loadResources('ctx')).rejects.toThrow('Error 500 while loading resources')
  })

  it('keeps showing previous data when a forced refresh fails', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValueOnce(jsonResponse(resourcesPayload()))
    await store.loadResources('ctx')
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    await expect(store.loadResources('ctx', { force: true })).rejects.toThrow('timeout')
    expect(store.resourcesStatus).toBe('ready')
    expect(store.resourcesError).toBe('timeout')
    expect(store.isRefreshing).toBe(false)
    expect(store.pods).toEqual([item('pods-1', 'default')])
  })

  it('clears a previous error when a new load starts', async () => {
    const store = useClusterStore()
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    await expect(store.loadResources('ctx')).rejects.toThrow()
    fetchMock.mockResolvedValueOnce(jsonResponse(resourcesPayload()))
    const promise = store.loadResources('ctx')
    expect(store.resourcesError).toBeNull()
    await promise
  })
})

describe.each([
  ['loadMetrics', 'metrics/pods', 'metricsStatus', 'podMetrics', 'metricsUpdatedAt'],
  ['loadNodeMetrics', 'metrics/nodes', 'nodeMetricsStatus', 'nodeMetrics', 'nodeMetricsUpdatedAt'],
] as const)('%s', (action, path, statusKey, dataKey, updatedKey) => {
  const isPods = action === 'loadMetrics'
  const metricItems = [
    { metadata: { name: 'a', namespace: 'default' }, value: 1 },
    { metadata: { name: 'b', namespace: 'kube-system' }, value: 2 },
  ]
  const expectedData = isPods
    ? { 'default/a': metricItems[0], 'kube-system/b': metricItems[1] }
    : { a: metricItems[0], b: metricItems[1] }

  it('loads metrics indexed by key and marks them ready', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({ items: metricItems }))
    const promise = store[action]('my ctx')
    expect(store[statusKey]).toBe('loading')
    await promise
    expect(fetchMock).toHaveBeenCalledWith(`/api/my%20ctx/${path}`)
    expect(store[dataKey]).toEqual(expectedData)
    expect(store[statusKey]).toBe('ready')
    expect(store[updatedKey]).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('handles a response without items', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({}))
    await store[action]('ctx')
    expect(store[dataKey]).toEqual({})
    expect(store[statusKey]).toBe('ready')
  })

  it('skips loading when already ready unless forced, without flashing loading on refresh', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }))
    await store[action]('ctx')
    await store[action]('ctx')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const promise = store[action]('ctx', { force: true })
    expect(store[statusKey]).toBe('ready')
    await promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('marks metrics unavailable on HTTP errors without throwing', async () => {
    const store = useClusterStore()
    fetchMock.mockResolvedValue(jsonResponse({ items: metricItems }, { status: 503 }))
    await expect(store[action]('ctx')).resolves.toBeUndefined()
    expect(store[statusKey]).toBe('unavailable')
    expect(store[dataKey]).toEqual({})
    expect(store[updatedKey]).toBeNull()
  })

  it('marks metrics unavailable on network errors and retries on the next call', async () => {
    const store = useClusterStore()
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await store[action]('ctx')
    expect(store[statusKey]).toBe('unavailable')

    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    const promise = store[action]('ctx')
    expect(store[statusKey]).toBe('unavailable')
    await promise
    expect(store[statusKey]).toBe('ready')
  })
})

describe('getters', () => {
  it('availableNamespaces lists unique, sorted namespaces from namespaced kinds only', () => {
    const store = useClusterStore()
    store.pods = [item('a', 'zeta'), item('b', 'alpha'), item('c'), {}]
    store.services = [item('s', 'alpha')]
    store.poddisruptionbudgets = [item('p', 'mid')]
    store.persistentvolumes = [item('pv', 'should-not-appear')]
    store.nodes = [item('n', 'nor-this')]
    store.namespaces = [item('ns', 'nor-that')]
    expect(store.availableNamespaces).toEqual(['alpha', 'mid', 'zeta'])
  })

  it.each([
    'deployments',
    'statefulsets',
    'daemonsets',
    'jobs',
    'cronjobs',
    'ingresses',
    'configmaps',
    'secrets',
    'persistentvolumeclaims',
    'horizontalpodautoscalers',
    'resourcequotas',
    'limitranges',
    'networkpolicies',
    'endpoints',
  ] as const)('availableNamespaces includes namespaces from %s', (kind) => {
    const store = useClusterStore()
    store[kind] = [item('x', `ns-${kind}`)]
    expect(store.availableNamespaces).toEqual([`ns-${kind}`])
  })

  it('isNamespaceVisible hides excluded namespaces but always shows cluster-scoped items', () => {
    const store = useClusterStore()
    store.excludedNamespaces = ['kube-system']
    expect(store.isNamespaceVisible('kube-system')).toBe(false)
    expect(store.isNamespaceVisible('default')).toBe(true)
    expect(store.isNamespaceVisible(null)).toBe(true)
    expect(store.isNamespaceVisible(undefined)).toBe(true)
    expect(store.isNamespaceVisible('')).toBe(true)
  })

  it('selectedResourceObject finds the selected item by kind, namespace and name', () => {
    const store = useClusterStore()
    const target = item('web', 'default')
    store.pods = [{}, item('web', 'staging'), target, item('other', 'default')]
    expect(store.selectedResourceObject).toBeNull()
    store.selectResource('pods', 'default', 'web')
    expect(store.selectedResource).toEqual({ kind: 'pods', namespace: 'default', name: 'web' })
    expect(toRaw(store.selectedResourceObject)).toBe(target)
    store.selectResource('pods', 'default', 'missing')
    expect(store.selectedResourceObject).toBeNull()
    store.selectResource('services', 'default', 'web')
    expect(store.selectedResourceObject).toBeNull()
    store.clearSelection()
    expect(store.selectedResource).toBeNull()
    expect(store.selectedResourceObject).toBeNull()
  })

  it('selectedResourceObject matches cluster-scoped items by name only', () => {
    const store = useClusterStore()
    const node = item('node-1')
    store.nodes = [{}, item('node-0'), node]
    store.selectResource('nodes', '_', 'node-1')
    expect(toRaw(store.selectedResourceObject)).toBe(node)
  })
})

describe('namespace filter', () => {
  it('loads the excluded namespaces for a context from storage', () => {
    const store = useClusterStore()
    localStorage.setItem('namespaceFilter.excluded.ctx', JSON.stringify(['kube-system']))
    store.loadNamespaceFilter('ctx')
    expect(store.excludedNamespaces).toEqual(['kube-system'])
    store.loadNamespaceFilter('other')
    expect(store.excludedNamespaces).toEqual([])
  })

  it('falls back to no exclusions when stored JSON is corrupt', () => {
    const store = useClusterStore()
    store.excludedNamespaces = ['x']
    localStorage.setItem('namespaceFilter.excluded.ctx', 'not json')
    store.loadNamespaceFilter('ctx')
    expect(store.excludedNamespaces).toEqual([])
  })

  it('toggleNamespace adds/removes and persists per current context', () => {
    const store = useClusterStore()
    store.currentContext = 'ctx'
    store.toggleNamespace('kube-system')
    store.toggleNamespace('monitoring')
    expect(store.excludedNamespaces).toEqual(['kube-system', 'monitoring'])
    expect(JSON.parse(localStorage.getItem('namespaceFilter.excluded.ctx')!)).toEqual(['kube-system', 'monitoring'])
    store.toggleNamespace('kube-system')
    expect(store.excludedNamespaces).toEqual(['monitoring'])
    expect(JSON.parse(localStorage.getItem('namespaceFilter.excluded.ctx')!)).toEqual(['monitoring'])
  })

  it('setExcludedNamespaces and selectAllNamespaces persist', () => {
    const store = useClusterStore()
    store.currentContext = 'ctx'
    store.setExcludedNamespaces(['a', 'b'])
    expect(store.excludedNamespaces).toEqual(['a', 'b'])
    expect(JSON.parse(localStorage.getItem('namespaceFilter.excluded.ctx')!)).toEqual(['a', 'b'])
    store.selectAllNamespaces()
    expect(store.excludedNamespaces).toEqual([])
    expect(JSON.parse(localStorage.getItem('namespaceFilter.excluded.ctx')!)).toEqual([])
  })

  it('does not persist without a current context', () => {
    const store = useClusterStore()
    store.toggleNamespace('kube-system')
    expect(store.excludedNamespaces).toEqual(['kube-system'])
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    expect(keys).toEqual(['locale'])
  })
})

describe('setFilterText and resetForNewContext', () => {
  it('setFilterText updates the filter', () => {
    const store = useClusterStore()
    store.setFilterText('web')
    expect(store.filterText).toBe('web')
  })

  it('resetForNewContext clears all context-dependent state but keeps contexts and currentContext', async () => {
    const store = useClusterStore()
    const contexts = [{ name: 'ctx', cluster: 'c', namespace: null }]
    store.contexts = contexts
    fetchMock.mockResolvedValueOnce(jsonResponse(resourcesPayload({ errors: { pods: 'x' } })))
    await store.loadResources('ctx')
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ metadata: { name: 'a', namespace: 'default' } }] }))
    await store.loadMetrics('ctx')
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ metadata: { name: 'n' } }] }))
    await store.loadNodeMetrics('ctx')
    store.selectResource('pods', 'default', 'pods-1')
    store.setFilterText('abc')
    store.excludedNamespaces = ['kube-system']

    store.resetForNewContext()

    for (const kind of ALL_KINDS) expect(store.resourcesByKind(kind)).toEqual([])
    expect(store.$state).toMatchObject({
      contexts,
      currentContext: 'ctx',
      resourceErrors: {},
      resourcesStatus: 'idle',
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
      excludedNamespaces: [],
    })
  })
})
