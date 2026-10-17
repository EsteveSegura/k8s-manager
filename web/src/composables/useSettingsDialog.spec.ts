import { describe, expect, it } from 'vitest'
import { useSettingsDialog } from './useSettingsDialog'

describe('useSettingsDialog', () => {
  it('shares the open state across callers', () => {
    const a = useSettingsDialog()
    const b = useSettingsDialog()
    expect(a.isOpen.value).toBe(false)
    a.open()
    expect(b.isOpen.value).toBe(true)
    b.close()
    expect(a.isOpen.value).toBe(false)
  })
})
