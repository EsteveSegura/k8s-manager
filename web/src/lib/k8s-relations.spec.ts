import { describe, expect, it } from 'vitest'
import {
  deploymentsForPod,
  deploymentsForService,
  endpointsForService,
  jobsForCronJob,
  limitRangesForNamespace,
  persistentVolumeClaimForVolume,
  persistentVolumeForClaim,
  podsForConfigMap,
  podsForDaemonSet,
  podsForDeployment,
  podsForJob,
  podsForNamespace,
  podsForNetworkPolicy,
  podsForNode,
  podsForPersistentVolumeClaim,
  podsForPodDisruptionBudget,
  podsForSecret,
  podsForSelector,
  podsForService,
  podsForStatefulSet,
  resourceQuotasForNamespace,
  serviceForEndpoints,
  servicesForDeployment,
  servicesForIngress,
  servicesForPod,
  targetForHorizontalPodAutoscaler,
} from './k8s-relations'

const pod = (name: string, namespace: string, labels?: Record<string, string>, spec: any = {}) => ({
  metadata: { name, namespace, labels },
  spec,
})
const names = (items: any[]) => items.map((i) => i.metadata.name)

const pods = [
  pod('web-1', 'default', { app: 'web', tier: 'front' }),
  pod('web-2', 'default', { app: 'web', tier: 'back' }),
  pod('web-other-ns', 'staging', { app: 'web', tier: 'front' }),
  pod('db-1', 'default', { app: 'db' }),
  pod('no-labels', 'default'),
]

describe('podsForSelector', () => {
  it('matches pods whose labels include every selector entry, in the same namespace', () => {
    expect(names(podsForSelector('default', { app: 'web' }, pods))).toEqual(['web-1', 'web-2'])
    expect(names(podsForSelector('default', { app: 'web', tier: 'front' }, pods))).toEqual(['web-1'])
    expect(names(podsForSelector('staging', { app: 'web' }, pods))).toEqual(['web-other-ns'])
  })

  it('requires exact label values', () => {
    expect(podsForSelector('default', { app: 'we' }, pods)).toEqual([])
    expect(podsForSelector('default', { app: 'web', missing: 'x' }, pods)).toEqual([])
  })

  it('matches nothing for an empty or missing selector (Service/Deployment semantics)', () => {
    expect(podsForSelector('default', {}, pods)).toEqual([])
    expect(podsForSelector('default', undefined, pods)).toEqual([])
  })

  it('does not match a cluster-scoped (undefined) namespace against namespaced pods', () => {
    expect(podsForSelector(undefined, { app: 'web' }, pods)).toEqual([])
  })
})

describe('workload -> pods', () => {
  const selectorWorkload = (namespace: string, matchLabels?: Record<string, string>) => ({
    metadata: { namespace },
    spec: { selector: matchLabels ? { matchLabels } : undefined },
  })

  it.each([
    ['podsForDeployment', podsForDeployment],
    ['podsForStatefulSet', podsForStatefulSet],
    ['podsForDaemonSet', podsForDaemonSet],
    ['podsForJob', podsForJob],
    ['podsForPodDisruptionBudget', podsForPodDisruptionBudget],
  ])('%s uses spec.selector.matchLabels within the namespace', (_, fn) => {
    expect(names(fn(selectorWorkload('default', { app: 'web' }), pods))).toEqual(['web-1', 'web-2'])
    expect(names(fn(selectorWorkload('staging', { app: 'web' }), pods))).toEqual(['web-other-ns'])
    expect(fn(selectorWorkload('default'), pods)).toEqual([])
    expect(fn({}, pods)).toEqual([])
  })

  // A selector with only `matchExpressions` (valid for Deployments, Jobs, PDBs...)
  // is ignored: the relation shows no pods at all.
  it.fails('podsForDeployment honours matchExpressions-only selectors', () => {
    const deployment = {
      metadata: { namespace: 'default' },
      spec: { selector: { matchExpressions: [{ key: 'app', operator: 'In', values: ['db'] }] } },
    }
    expect(names(podsForDeployment(deployment, pods))).toEqual(['db-1'])
  })

  // With matchLabels + matchExpressions, only matchLabels is evaluated, so pods
  // excluded by the expression are still listed.
  it.fails('podsForDeployment applies matchExpressions in addition to matchLabels', () => {
    const deployment = {
      metadata: { namespace: 'default' },
      spec: {
        selector: {
          matchLabels: { app: 'web' },
          matchExpressions: [{ key: 'tier', operator: 'NotIn', values: ['back'] }],
        },
      },
    }
    expect(names(podsForDeployment(deployment, pods))).toEqual(['web-1'])
  })
})

describe('service relations', () => {
  const service = (name: string, namespace: string, selector?: Record<string, string>) => ({
    metadata: { name, namespace },
    spec: { selector },
  })
  const services = [
    service('web', 'default', { app: 'web' }),
    service('web-front', 'default', { app: 'web', tier: 'front' }),
    service('web-staging', 'staging', { app: 'web' }),
    service('external', 'default'),
    service('empty-selector', 'default', {}),
  ]
  const deployment = (name: string, namespace: string, templateLabels?: Record<string, string>, matchLabels?: Record<string, string>) => ({
    metadata: { name, namespace },
    spec: { template: { metadata: { labels: templateLabels } }, selector: { matchLabels } },
  })
  const deployments = [
    deployment('web', 'default', { app: 'web', tier: 'front' }, { app: 'web' }),
    deployment('web-back', 'default', { app: 'web', tier: 'back' }, { app: 'web', tier: 'back' }),
    deployment('web', 'staging', { app: 'web' }, { app: 'web' }),
    deployment('no-template', 'default'),
  ]

  it('podsForService uses spec.selector', () => {
    expect(names(podsForService(services[1], pods))).toEqual(['web-1'])
    expect(podsForService(services[3], pods)).toEqual([])
    expect(podsForService(services[4], pods)).toEqual([])
  })

  it('servicesForDeployment matches service selectors against the pod template labels', () => {
    expect(names(servicesForDeployment(deployments[0], services))).toEqual(['web', 'web-front'])
    expect(names(servicesForDeployment(deployments[1], services))).toEqual(['web'])
    expect(names(servicesForDeployment(deployments[2], services))).toEqual(['web-staging'])
    expect(servicesForDeployment(deployments[3], services)).toEqual([])
  })

  it('deploymentsForService is the inverse of servicesForDeployment', () => {
    expect(deploymentsForService(services[0], deployments).map((d) => `${d.metadata.namespace}/${d.metadata.name}`)).toEqual([
      'default/web',
      'default/web-back',
    ])
    expect(deploymentsForService(services[1], deployments).map((d) => d.metadata.name)).toEqual(['web'])
    expect(deploymentsForService(services[3], deployments)).toEqual([])
  })

  it('servicesForPod matches by pod labels and namespace', () => {
    expect(names(servicesForPod(pods[0], services))).toEqual(['web', 'web-front'])
    expect(names(servicesForPod(pods[1], services))).toEqual(['web'])
    expect(names(servicesForPod(pods[2], services))).toEqual(['web-staging'])
    expect(servicesForPod(pods[4], services)).toEqual([])
  })

  it('deploymentsForPod matches deployment matchLabels against pod labels', () => {
    expect(deploymentsForPod(pods[0], deployments).map((d) => d.metadata.name)).toEqual(['web'])
    expect(deploymentsForPod(pods[1], deployments).map((d) => d.metadata.name)).toEqual(['web', 'web-back'])
    expect(deploymentsForPod(pods[2], deployments).map((d) => d.metadata.namespace)).toEqual(['staging'])
    expect(deploymentsForPod(pods[4], deployments)).toEqual([])
  })

  it('endpointsForService and serviceForEndpoints match by namespace and name', () => {
    const endpoints = [
      { metadata: { name: 'web', namespace: 'staging' } },
      { metadata: { name: 'web', namespace: 'default' } },
    ]
    expect(endpointsForService(services[0], endpoints)).toBe(endpoints[1])
    expect(endpointsForService(services[1], endpoints)).toBeNull()
    expect(serviceForEndpoints(endpoints[0], services)).toBeNull()
    expect(serviceForEndpoints(endpoints[1], services)).toBe(services[0])
    expect(serviceForEndpoints({ metadata: { name: 'web-staging', namespace: 'staging' } }, services)).toBe(services[2])
  })
})

describe('jobsForCronJob', () => {
  it('matches jobs owned by the cronjob uid in the same namespace', () => {
    const cronJob = { metadata: { namespace: 'default', uid: 'cj-1' } }
    const jobs = [
      { metadata: { name: 'a', namespace: 'default', ownerReferences: [{ uid: 'other' }, { uid: 'cj-1' }] } },
      { metadata: { name: 'b', namespace: 'default', ownerReferences: [{ uid: 'other' }] } },
      { metadata: { name: 'c', namespace: 'default' } },
      { metadata: { name: 'd', namespace: 'staging', ownerReferences: [{ uid: 'cj-1' }] } },
    ]
    expect(names(jobsForCronJob(cronJob, jobs))).toEqual(['a'])
  })
})

describe('configmap and secret references', () => {
  const consumer = pod('consumer', 'default', {}, {
    volumes: [{ configMap: { name: 'cm-volume' } }, { secret: { secretName: 'secret-volume' } }, { emptyDir: {} }],
    imagePullSecrets: [{ name: 'pull-secret' }, {}],
    containers: [
      {
        envFrom: [{ configMapRef: { name: 'cm-envfrom' } }, { secretRef: { name: 'secret-envfrom' } }],
        env: [
          { name: 'A', valueFrom: { configMapKeyRef: { name: 'cm-key', key: 'a' } } },
          { name: 'B', valueFrom: { secretKeyRef: { name: 'secret-key', key: 'b' } } },
          { name: 'C', value: 'plain' },
          { name: 'D', valueFrom: { fieldRef: { fieldPath: 'metadata.name' } } },
        ],
      },
    ],
    initContainers: [
      {
        envFrom: [{ configMapRef: { name: 'cm-init' } }, { secretRef: { name: 'secret-init' } }],
        env: [
          { name: 'E', valueFrom: { configMapKeyRef: { name: 'cm-init-key' } } },
          { name: 'F', valueFrom: { secretKeyRef: { name: 'secret-init-key' } } },
        ],
      },
    ],
  })
  const otherNamespace = pod('elsewhere', 'staging', {}, { volumes: [{ configMap: { name: 'cm-volume' } }, { secret: { secretName: 'secret-volume' } }] })
  const bare = pod('bare', 'default')
  const all = [consumer, otherNamespace, bare]
  const cm = (name: string, namespace = 'default') => ({ metadata: { name, namespace } })

  it.each(['cm-volume', 'cm-envfrom', 'cm-key', 'cm-init', 'cm-init-key'])('podsForConfigMap finds pods referencing %s', (name) => {
    expect(names(podsForConfigMap(cm(name), all))).toEqual(['consumer'])
  })

  it.each(['secret-volume', 'pull-secret', 'secret-envfrom', 'secret-key', 'secret-init', 'secret-init-key'])(
    'podsForSecret finds pods referencing %s',
    (name) => {
      expect(names(podsForSecret(cm(name), all))).toEqual(['consumer'])
    },
  )

  it('does not mix configmap and secret references', () => {
    expect(podsForConfigMap(cm('secret-volume'), all)).toEqual([])
    expect(podsForConfigMap(cm('pull-secret'), all)).toEqual([])
    expect(podsForConfigMap(cm('secret-envfrom'), all)).toEqual([])
    expect(podsForConfigMap(cm('secret-key'), all)).toEqual([])
    expect(podsForSecret(cm('cm-volume'), all)).toEqual([])
    expect(podsForSecret(cm('cm-envfrom'), all)).toEqual([])
    expect(podsForSecret(cm('cm-key'), all)).toEqual([])
  })

  it('respects namespaces', () => {
    expect(names(podsForConfigMap(cm('cm-volume', 'staging'), all))).toEqual(['elsewhere'])
    expect(names(podsForSecret(cm('secret-volume', 'staging'), all))).toEqual(['elsewhere'])
    expect(podsForConfigMap(cm('cm-volume', 'other'), all)).toEqual([])
  })

  it('returns nothing for unreferenced names', () => {
    expect(podsForConfigMap(cm('nope'), all)).toEqual([])
    expect(podsForSecret(cm('nope'), all)).toEqual([])
  })
})

describe('storage relations', () => {
  it('podsForPersistentVolumeClaim matches by claimName in the namespace', () => {
    const all = [
      pod('a', 'default', {}, { volumes: [{ emptyDir: {} }, { persistentVolumeClaim: { claimName: 'data' } }] }),
      pod('b', 'default', {}, { volumes: [{ persistentVolumeClaim: { claimName: 'other' } }] }),
      pod('c', 'staging', {}, { volumes: [{ persistentVolumeClaim: { claimName: 'data' } }] }),
      pod('d', 'default'),
    ]
    expect(names(podsForPersistentVolumeClaim({ metadata: { name: 'data', namespace: 'default' } }, all))).toEqual(['a'])
  })

  it('persistentVolumeForClaim follows spec.volumeName', () => {
    const pvs = [{ metadata: { name: 'pv-1' } }, { metadata: { name: 'pv-2' } }]
    expect(persistentVolumeForClaim({ spec: { volumeName: 'pv-2' } }, pvs)).toBe(pvs[1])
    expect(persistentVolumeForClaim({ spec: { volumeName: 'pv-3' } }, pvs)).toBeNull()
    expect(persistentVolumeForClaim({ spec: {} }, pvs)).toBeNull()
    expect(persistentVolumeForClaim({}, [{ metadata: {} }])).toBeNull()
  })

  it('persistentVolumeClaimForVolume follows spec.claimRef namespace and name', () => {
    const pvcs = [
      { metadata: { name: 'data', namespace: 'staging' } },
      { metadata: { name: 'data', namespace: 'default' } },
    ]
    expect(persistentVolumeClaimForVolume({ spec: { claimRef: { name: 'data', namespace: 'default' } } }, pvcs)).toBe(pvcs[1])
    expect(persistentVolumeClaimForVolume({ spec: { claimRef: { name: 'data', namespace: 'other' } } }, pvcs)).toBeNull()
    expect(persistentVolumeClaimForVolume({ spec: { claimRef: { name: 'nope', namespace: 'default' } } }, pvcs)).toBeNull()
    expect(persistentVolumeClaimForVolume({ spec: {} }, [{ metadata: {} }])).toBeNull()
    expect(persistentVolumeClaimForVolume({}, pvcs)).toBeNull()
  })
})

describe('podsForNode', () => {
  it('matches pods scheduled on the node regardless of namespace', () => {
    const all = [
      pod('a', 'default', {}, { nodeName: 'node-1' }),
      pod('b', 'kube-system', {}, { nodeName: 'node-1' }),
      pod('c', 'default', {}, { nodeName: 'node-2' }),
      pod('pending', 'default'),
    ]
    expect(names(podsForNode({ metadata: { name: 'node-1' } }, all))).toEqual(['a', 'b'])
  })
})

describe('targetForHorizontalPodAutoscaler', () => {
  const deployments = [
    { metadata: { name: 'web', namespace: 'staging' } },
    { metadata: { name: 'web', namespace: 'default' } },
  ]
  const statefulsets = [{ metadata: { name: 'web', namespace: 'default' } }]
  const hpa = (kind: string | undefined, name = 'web', namespace = 'default') => ({
    metadata: { namespace },
    spec: kind ? { scaleTargetRef: { kind, name } } : {},
  })

  it('resolves Deployment targets', () => {
    expect(targetForHorizontalPodAutoscaler(hpa('Deployment'), deployments, statefulsets)).toBe(deployments[1])
  })

  it('resolves StatefulSet targets', () => {
    expect(targetForHorizontalPodAutoscaler(hpa('StatefulSet'), deployments, statefulsets)).toBe(statefulsets[0])
  })

  it('returns null when not found, unsupported or missing', () => {
    expect(targetForHorizontalPodAutoscaler(hpa('Deployment', 'nope'), deployments, statefulsets)).toBeNull()
    expect(targetForHorizontalPodAutoscaler(hpa('Deployment', 'web', 'other'), deployments, statefulsets)).toBeNull()
    expect(targetForHorizontalPodAutoscaler(hpa('StatefulSet', 'nope'), deployments, statefulsets)).toBeNull()
    expect(targetForHorizontalPodAutoscaler(hpa('StatefulSet', 'web', 'staging'), deployments, statefulsets)).toBeNull()
    expect(targetForHorizontalPodAutoscaler(hpa('ReplicaSet'), deployments, statefulsets)).toBeNull()
    expect(targetForHorizontalPodAutoscaler(hpa(undefined), deployments, statefulsets)).toBeNull()
  })
})

describe('namespace relations', () => {
  const ns = { metadata: { name: 'default' } }
  const items = [
    { metadata: { name: 'a', namespace: 'default' } },
    { metadata: { name: 'b', namespace: 'staging' } },
    { metadata: { name: 'c', namespace: 'default' } },
  ]

  it.each([
    ['resourceQuotasForNamespace', resourceQuotasForNamespace],
    ['limitRangesForNamespace', limitRangesForNamespace],
    ['podsForNamespace', podsForNamespace],
  ])('%s filters by namespace name', (_, fn) => {
    expect(names(fn(ns, items))).toEqual(['a', 'c'])
    expect(fn({ metadata: { name: 'empty' } }, items)).toEqual([])
  })
})

describe('podsForNetworkPolicy', () => {
  const policy = (podSelector: any, namespace = 'default') => ({ metadata: { namespace }, spec: { podSelector } })

  it('matches pods by podSelector.matchLabels in the namespace', () => {
    expect(names(podsForNetworkPolicy(policy({ matchLabels: { app: 'web' } }), pods))).toEqual(['web-1', 'web-2'])
    expect(names(podsForNetworkPolicy(policy({ matchLabels: { app: 'web', tier: 'back' } }), pods))).toEqual(['web-2'])
  })

  it('treats an empty podSelector as "all pods in the namespace"', () => {
    const inDefault = ['web-1', 'web-2', 'db-1', 'no-labels']
    expect(names(podsForNetworkPolicy(policy({}), pods))).toEqual(inDefault)
    expect(names(podsForNetworkPolicy(policy({ matchLabels: {} }), pods))).toEqual(inDefault)
    expect(names(podsForNetworkPolicy(policy(undefined), pods))).toEqual(inDefault)
    expect(names(podsForNetworkPolicy(policy({}, 'staging'), pods))).toEqual(['web-other-ns'])
  })

  it('does not match unlabelled pods against a non-empty selector', () => {
    expect(names(podsForNetworkPolicy(policy({ matchLabels: { app: 'db' } }), pods))).toEqual(['db-1'])
  })

  // A podSelector with only matchExpressions is treated as empty, so the
  // policy appears to select every pod in the namespace (over-matching).
  it.fails('honours matchExpressions-only podSelectors', () => {
    const selector = { matchExpressions: [{ key: 'app', operator: 'In', values: ['db'] }] }
    expect(names(podsForNetworkPolicy(policy(selector), pods))).toEqual(['db-1'])
  })
})

describe('servicesForIngress', () => {
  const services = [
    { metadata: { name: 'api', namespace: 'default' } },
    { metadata: { name: 'web', namespace: 'default' } },
    { metadata: { name: 'fallback', namespace: 'default' } },
    { metadata: { name: 'api', namespace: 'staging' } },
    { metadata: { name: 'unused', namespace: 'default' } },
  ]

  it('collects services from rule paths and the default backend, in the same namespace', () => {
    const ingress = {
      metadata: { namespace: 'default' },
      spec: {
        defaultBackend: { service: { name: 'fallback' } },
        rules: [
          { http: { paths: [{ backend: { service: { name: 'api' } } }, { backend: { resource: { kind: 'Bucket' } } }] } },
          { http: { paths: [{ backend: { service: { name: 'web' } } }, { backend: { service: { name: 'api' } } }] } },
          { host: 'no-http.example.com' },
        ],
      },
    }
    expect(servicesForIngress(ingress, services).map((s) => s.metadata.name)).toEqual(['api', 'web', 'fallback'])
  })

  it('returns nothing for an ingress without backends', () => {
    expect(servicesForIngress({ metadata: { namespace: 'default' }, spec: {} }, services)).toEqual([])
    expect(servicesForIngress({ metadata: { namespace: 'default' } }, services)).toEqual([])
  })

  it('works with only a default backend', () => {
    const ingress = { metadata: { namespace: 'staging' }, spec: { defaultBackend: { service: { name: 'api' } } } }
    expect(servicesForIngress(ingress, services)).toEqual([services[3]])
  })
})

// Objects coming from the API (or from a partially failed list) may lack
// metadata/spec/status; the relation helpers must never throw on them.
describe('robustness against partial objects', () => {
  const partials: any[] = [
    {},
    { metadata: {} },
    { spec: {} },
    { spec: { template: {} } },
    { spec: { selector: {} } },
    { spec: { containers: [{}], initContainers: [{}] } },
    { status: {} },
  ]
  const withEmptyPullSecret = [...partials, { spec: { imagePullSecrets: [{}] } }]

  it('selector-based relations return nothing', () => {
    expect(podsForSelector(undefined, { app: 'web' }, partials)).toEqual([])
    expect(servicesForDeployment({}, partials)).toEqual([])
    expect(servicesForDeployment({ spec: {} }, partials)).toEqual([])
    expect(servicesForDeployment({ spec: { template: {} } }, partials)).toEqual([])
    expect(deploymentsForService({}, partials)).toEqual([])
    expect(deploymentsForService({ spec: { selector: { app: 'web' } } }, partials)).toEqual([])
    expect(deploymentsForPod({}, partials)).toEqual([])
    expect(servicesForPod({}, partials)).toEqual([])
    for (const fn of [podsForService, podsForDeployment, podsForStatefulSet, podsForDaemonSet, podsForJob, podsForPodDisruptionBudget]) {
      expect(fn({}, partials)).toEqual([])
    }
  })

  it('a cronjob without uid owns no jobs', () => {
    expect(jobsForCronJob({}, partials)).toEqual([])
  })

  it('a configmap/secret/claim without name is referenced by no pod', () => {
    expect(podsForConfigMap({}, partials)).toEqual([])
    expect(podsForSecret({}, withEmptyPullSecret)).toEqual([])
    expect(podsForPersistentVolumeClaim({}, partials)).toEqual([])
  })

  it('lookups by name return null', () => {
    expect(persistentVolumeForClaim({ spec: { volumeName: 'pv' } }, partials)).toBeNull()
    expect(persistentVolumeClaimForVolume({ spec: { claimRef: { name: 'c', namespace: 'n' } } }, partials)).toBeNull()
    expect(targetForHorizontalPodAutoscaler({}, partials, partials)).toBeNull()
    for (const kind of ['Deployment', 'StatefulSet']) {
      expect(targetForHorizontalPodAutoscaler({ spec: { scaleTargetRef: { kind, name: 'x' } } }, partials, partials)).toBeNull()
    }
    expect(endpointsForService({ metadata: { name: 'x', namespace: 'n' } }, partials)).toBeNull()
    expect(serviceForEndpoints({ metadata: { name: 'x', namespace: 'n' } }, partials)).toBeNull()
  })

  it('ingresses without named service backends select no services', () => {
    expect(servicesForIngress({}, partials)).toEqual([])
    expect(servicesForIngress({ spec: { defaultBackend: { resource: { kind: 'Bucket' } } } }, partials)).toEqual([])
    expect(servicesForIngress({ spec: { rules: [{ http: { paths: [{}, { backend: {} }] } }] } }, partials)).toEqual([])
  })

  it('namespace- and node-scoped relations do not throw', () => {
    const calls = [
      () => podsForNode({}, partials),
      () => resourceQuotasForNamespace({}, partials),
      () => limitRangesForNamespace({}, partials),
      () => podsForNamespace({}, partials),
      () => endpointsForService({}, partials),
      () => serviceForEndpoints({}, partials),
      () => podsForNetworkPolicy({}, partials),
      () => podsForNetworkPolicy({ metadata: {}, spec: { podSelector: { matchLabels: { a: 'b' } } } }, partials),
    ]
    for (const call of calls) expect(call).not.toThrow()
  })
})
