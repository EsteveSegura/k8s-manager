import { computed, ref } from 'vue'
import { resourceToYaml } from '@/lib/k8s-yaml'
import type { ResourceKind } from '@/stores/cluster'

export function useResourceYaml(kind: ResourceKind, resource: () => Record<string, unknown>) {
  const yamlOpen = ref(false)
  const yaml = computed(() => resourceToYaml(kind, resource()))
  return { yamlOpen, yaml }
}
