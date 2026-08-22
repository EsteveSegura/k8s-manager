import type { ResourceKind } from '@/stores/cluster'

// PersistentVolumes y Nodes son recursos de clúster, sin namespace propio.
export const CLUSTER_SCOPED_KINDS: ResourceKind[] = ['persistentvolumes', 'nodes']

// Placeholder de namespace en la URL para recursos de clúster (un namespace real
// de k8s nunca puede contener "_", así que no colisiona con nombres reales).
export const NO_NAMESPACE = '_'

export function isClusterScoped(kind: ResourceKind): boolean {
  return CLUSTER_SCOPED_KINDS.includes(kind)
}

export function resourcePath(context: string, kind: ResourceKind, namespace: string | null | undefined, name: string): string {
  const ns = isClusterScoped(kind) ? NO_NAMESPACE : namespace
  return `/${context}/${kind}/${ns}/${name}`
}
