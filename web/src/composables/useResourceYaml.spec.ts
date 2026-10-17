import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useResourceYaml } from './useResourceYaml'

describe('useResourceYaml', () => {
  it('starts closed and renders the resource as YAML', () => {
    const { yamlOpen, yaml } = useResourceYaml('services', () => ({ metadata: { name: 'web' } }))
    expect(yamlOpen.value).toBe(false)
    expect(yaml.value).toBe('apiVersion: v1\nkind: Service\nmetadata:\n  name: web\n')
  })

  it('recomputes when the resource changes', () => {
    const resource = ref<Record<string, unknown>>({ metadata: { name: 'a' } })
    const { yaml } = useResourceYaml('pods', () => resource.value)
    expect(yaml.value).toContain('name: a')
    resource.value = { metadata: { name: 'b' } }
    expect(yaml.value).toContain('name: b')
  })
})
