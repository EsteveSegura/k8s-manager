import type { ResourceKind } from '@/stores/cluster'

// Traduce el `kind` literal de la API de k8s (como aparece en events, manifests
// de Helm, ownerReferences...) al ResourceKind interno de la app, solo para los
// kinds que la app sabe navegar. Los que no están aquí se muestran como texto plano.
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
}
