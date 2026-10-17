import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins conditional classes', () => {
    expect(cn('a', false && 'b', { c: true, d: false }, ['e'])).toBe('a c e')
  })

  it('lets later tailwind utilities override conflicting earlier ones', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
