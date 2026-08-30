import type { ResourceKind } from '@/stores/cluster'

// PersistentVolumes, Nodes and Namespaces are cluster-scoped resources, with no namespace of their own.
export const CLUSTER_SCOPED_KINDS: ResourceKind[] = ['persistentvolumes', 'nodes', 'namespaces']

// Namespace placeholder in the URL for cluster-scoped resources (a real k8s
// namespace can never contain "_", so it never collides with real names).
export const NO_NAMESPACE = '_'

export function isClusterScoped(kind: ResourceKind): boolean {
  return CLUSTER_SCOPED_KINDS.includes(kind)
}

export function resourcePath(context: string, kind: ResourceKind, namespace: string | null | undefined, name: string): string {
  const ns = isClusterScoped(kind) ? NO_NAMESPACE : namespace
  return `/${context}/${kind}/${ns}/${name}`
}
