import type { ResourceKind } from '@/stores/cluster'

// Translates the literal `kind` from the k8s API (as it appears in events, Helm
// manifests, ownerReferences...) to the app's internal ResourceKind, only for the
// kinds the app knows how to navigate. Ones not listed here are shown as plain text.
export const K8S_KIND_TO_RESOURCE_KIND: Partial<Record<string, ResourceKind>> = {
  Deployment: 'deployments',
  Service: 'services',
  Pod: 'pods',
  StatefulSet: 'statefulsets',
  DaemonSet: 'daemonsets',
  Job: 'jobs',
  CronJob: 'cronjobs',
  Ingress: 'ingresses',
  ConfigMap: 'configmaps',
  Secret: 'secrets',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  PersistentVolume: 'persistentvolumes',
  Node: 'nodes',
  HorizontalPodAutoscaler: 'horizontalpodautoscalers',
  Namespace: 'namespaces',
  ResourceQuota: 'resourcequotas',
  LimitRange: 'limitranges',
  NetworkPolicy: 'networkpolicies',
  Endpoints: 'endpoints',
  PodDisruptionBudget: 'poddisruptionbudgets',
}
