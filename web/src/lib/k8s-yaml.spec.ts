import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { resourceToYaml } from './k8s-yaml'

describe('resourceToYaml', () => {
  it('fills apiVersion and kind when missing and puts them first', () => {
    const yaml = resourceToYaml('deployments', { metadata: { name: 'web' }, spec: { replicas: 2 } })
    expect(yaml).toBe('apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 2\n')
  })

  it('keeps apiVersion/kind present in the resource, but still moves them first', () => {
    const yaml = resourceToYaml('horizontalpodautoscalers', {
      metadata: { name: 'h' },
      kind: 'HorizontalPodAutoscaler',
      apiVersion: 'autoscaling/v1',
    })
    expect(yaml.split('\n').slice(0, 3)).toEqual(['apiVersion: autoscaling/v1', 'kind: HorizontalPodAutoscaler', 'metadata:'])
  })

  // Same apiVersion/kind pairs `kubectl get <kind> -o yaml` prints.
  it.each([
    ['deployments', 'apps/v1', 'Deployment'],
    ['services', 'v1', 'Service'],
    ['pods', 'v1', 'Pod'],
    ['statefulsets', 'apps/v1', 'StatefulSet'],
    ['daemonsets', 'apps/v1', 'DaemonSet'],
    ['jobs', 'batch/v1', 'Job'],
    ['cronjobs', 'batch/v1', 'CronJob'],
    ['ingresses', 'networking.k8s.io/v1', 'Ingress'],
    ['configmaps', 'v1', 'ConfigMap'],
    ['secrets', 'v1', 'Secret'],
    ['persistentvolumeclaims', 'v1', 'PersistentVolumeClaim'],
    ['persistentvolumes', 'v1', 'PersistentVolume'],
    ['nodes', 'v1', 'Node'],
    ['horizontalpodautoscalers', 'autoscaling/v2', 'HorizontalPodAutoscaler'],
    ['namespaces', 'v1', 'Namespace'],
    ['resourcequotas', 'v1', 'ResourceQuota'],
    ['limitranges', 'v1', 'LimitRange'],
    ['networkpolicies', 'networking.k8s.io/v1', 'NetworkPolicy'],
    ['endpoints', 'v1', 'Endpoints'],
    ['poddisruptionbudgets', 'policy/v1', 'PodDisruptionBudget'],
  ] as const)('uses the right fallback for %s', (kind, apiVersion, k8sKind) => {
    expect(parse(resourceToYaml(kind, {}))).toEqual({ apiVersion, kind: k8sKind })
  })

  it('falls back when apiVersion/kind are present but empty (empty TypeMeta)', () => {
    const yaml = resourceToYaml('secrets', { apiVersion: '', kind: undefined, metadata: { name: 's' } })
    expect(yaml).toBe('apiVersion: v1\nkind: Secret\nmetadata:\n  name: s\n')
  })

  it('uses 2-space indentation and preserves nested data', () => {
    const resource = { data: { 'config.yaml': 'a: 1\nb: 2\n' }, metadata: { labels: { app: 'x' } } }
    const yaml = resourceToYaml('configmaps', resource)
    expect(yaml).toContain('\n  labels:\n    app: x\n')
    expect(parse(yaml)).toEqual({ apiVersion: 'v1', kind: 'ConfigMap', ...resource })
  })

  it('does not mutate the input resource', () => {
    const resource = { metadata: { name: 'p' } }
    resourceToYaml('pods', resource)
    expect(resource).toEqual({ metadata: { name: 'p' } })
  })
})
