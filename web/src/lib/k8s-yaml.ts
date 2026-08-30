import { stringify } from 'yaml'
import type { ResourceKind } from '@/stores/cluster'

const API_VERSION_AND_KIND: Record<ResourceKind, { apiVersion: string; kind: string }> = {
  deployments: { apiVersion: 'apps/v1', kind: 'Deployment' },
  services: { apiVersion: 'v1', kind: 'Service' },
  pods: { apiVersion: 'v1', kind: 'Pod' },
  statefulsets: { apiVersion: 'apps/v1', kind: 'StatefulSet' },
  daemonsets: { apiVersion: 'apps/v1', kind: 'DaemonSet' },
  jobs: { apiVersion: 'batch/v1', kind: 'Job' },
  cronjobs: { apiVersion: 'batch/v1', kind: 'CronJob' },
  ingresses: { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
  configmaps: { apiVersion: 'v1', kind: 'ConfigMap' },
  secrets: { apiVersion: 'v1', kind: 'Secret' },
  persistentvolumeclaims: { apiVersion: 'v1', kind: 'PersistentVolumeClaim' },
  persistentvolumes: { apiVersion: 'v1', kind: 'PersistentVolume' },
  nodes: { apiVersion: 'v1', kind: 'Node' },
  horizontalpodautoscalers: { apiVersion: 'autoscaling/v2', kind: 'HorizontalPodAutoscaler' },
  namespaces: { apiVersion: 'v1', kind: 'Namespace' },
  resourcequotas: { apiVersion: 'v1', kind: 'ResourceQuota' },
  limitranges: { apiVersion: 'v1', kind: 'LimitRange' },
  networkpolicies: { apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy' },
  endpoints: { apiVersion: 'v1', kind: 'Endpoints' },
  poddisruptionbudgets: { apiVersion: 'policy/v1', kind: 'PodDisruptionBudget' },
}

// The objects returned by @kubernetes/client-node for a list don't always
// have apiVersion/kind filled in (TypeMeta is usually empty in list items),
// so we fill them in by hand so the exported YAML is faithful to what
// `kubectl get -o yaml` would return.
export function resourceToYaml(kind: ResourceKind, resource: Record<string, unknown>): string {
  const fallback = API_VERSION_AND_KIND[kind]
  const ordered: Record<string, unknown> = {
    apiVersion: resource.apiVersion || fallback.apiVersion,
    kind: resource.kind || fallback.kind,
  }
  for (const key of Object.keys(resource)) {
    if (key === 'apiVersion' || key === 'kind') continue
    ordered[key] = resource[key]
  }
  return stringify(ordered, { indent: 2 })
}
