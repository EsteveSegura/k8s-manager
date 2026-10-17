import { describe, expect, it } from 'vitest'
import { formatDateTime } from './format'

describe('formatDateTime', () => {
  it.each([null, undefined, ''])('returns null for empty value %j', (value) => {
    expect(formatDateTime(value)).toBeNull()
  })

  it('returns null for unparsable dates', () => {
    expect(formatDateTime('not a date')).toBeNull()
  })

  it('formats a valid ISO timestamp with the locale formatter', () => {
    const iso = '2024-05-06T07:08:09Z'
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString())
  })
})
