import { describe, expect, it } from 'vitest'
import { CLUSTER_SCOPED_KINDS, NO_NAMESPACE, isClusterScoped, resourcePath } from './resource-kinds'

describe('isClusterScoped', () => {
  it.each(['persistentvolumes', 'nodes', 'namespaces'] as const)('%s is cluster-scoped', (kind) => {
    expect(isClusterScoped(kind)).toBe(true)
  })

  it.each(['pods', 'deployments', 'persistentvolumeclaims', 'secrets'] as const)('%s is namespaced', (kind) => {
    expect(isClusterScoped(kind)).toBe(false)
  })

  it('exposes exactly the three cluster-scoped kinds', () => {
    expect([...CLUSTER_SCOPED_KINDS].sort()).toEqual(['namespaces', 'nodes', 'persistentvolumes'])
  })
})

describe('resourcePath', () => {
  it('builds a namespaced path', () => {
    expect(resourcePath('kind-dev', 'pods', 'default', 'web-1')).toBe('/kind-dev/pods/default/web-1')
  })

  it('uses the placeholder namespace for cluster-scoped kinds, ignoring the given one', () => {
    expect(resourcePath('ctx', 'nodes', 'default', 'node-a')).toBe(`/ctx/nodes/${NO_NAMESPACE}/node-a`)
    expect(resourcePath('ctx', 'persistentvolumes', null, 'pv-1')).toBe('/ctx/persistentvolumes/_/pv-1')
  })
})
