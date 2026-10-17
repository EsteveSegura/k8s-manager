import { describe, expect, it } from 'vitest'
import { K8S_KIND_TO_RESOURCE_KIND } from './k8s-kind-map'
import { resourceToYaml } from './k8s-yaml'
import type { ResourceKind } from '@/stores/cluster'

describe('K8S_KIND_TO_RESOURCE_KIND', () => {
  it('maps API kinds to internal resource kinds', () => {
    expect(K8S_KIND_TO_RESOURCE_KIND.Deployment).toBe('deployments')
    expect(K8S_KIND_TO_RESOURCE_KIND.PersistentVolumeClaim).toBe('persistentvolumeclaims')
    expect(K8S_KIND_TO_RESOURCE_KIND.Endpoints).toBe('endpoints')
  })

  it('does not map unknown kinds', () => {
    expect(K8S_KIND_TO_RESOURCE_KIND.ReplicaSet).toBeUndefined()
    expect(K8S_KIND_TO_RESOURCE_KIND.deployment).toBeUndefined()
  })

  it('is consistent with the kind emitted in exported YAML for every resource kind', () => {
    for (const [apiKind, resourceKind] of Object.entries(K8S_KIND_TO_RESOURCE_KIND)) {
      const yaml = resourceToYaml(resourceKind as ResourceKind, {})
      expect(yaml).toContain(`kind: ${apiKind}\n`)
    }
    expect(Object.keys(K8S_KIND_TO_RESOURCE_KIND)).toHaveLength(20)
  })
})
