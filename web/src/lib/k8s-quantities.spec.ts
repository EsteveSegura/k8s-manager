import { describe, expect, it } from 'vitest'
import { formatCpu, formatMemory, parseCpu, parseMemory, percentOf } from './k8s-quantities'

describe('parseCpu', () => {
  it.each([
    ['100m', 100],
    ['500m', 500],
    ['0m', 0],
    ['2', 2000],
    ['1.5', 1500],
    ['0.25', 250],
    ['250000000n', 250],
    ['136888n', 0.136888],
    ['1500u', 1.5],
    ['-1', -1000],
    ['1.5m', 1.5],
    ['0.125', 125],
  ])('parses %s to %d millicores', (input, expected) => {
    expect(parseCpu(input)).toBeCloseTo(expected, 9)
  })

  it.each([undefined, null, ''])('returns 0 for missing value %s', (input) => {
    expect(parseCpu(input)).toBe(0)
  })

  it.each(['abc', 'm', '1 m', ' 1', '1m ', '1.', '1x', '1Mi', 'x1'])('returns 0 for malformed or unknown quantity %j', (input) => {
    expect(parseCpu(input)).toBe(0)
  })

  it('accepts numbers passed through untyped API objects', () => {
    expect(parseCpu(3 as unknown as string)).toBe(3000)
  })

  // Kubernetes allows decimal exponent notation for quantities ("1e3" == 1000
  // cores). The parser does not support it and silently returns 0.
  it.fails('parses exponent notation (1e3 = 1000 cores)', () => {
    expect(parseCpu('1e3')).toBe(1_000_000)
  })
})

describe('parseMemory', () => {
  it.each([
    ['1024', 1024],
    ['1.5', 1.5],
    ['1Ki', 1024],
    ['128Mi', 128 * 1024 ** 2],
    ['512Mi', 512 * 1024 ** 2],
    ['1Gi', 1024 ** 3],
    ['1.5Gi', 1.5 * 1024 ** 3],
    ['0.25Gi', 0.25 * 1024 ** 3],
    ['2Ti', 2 * 1024 ** 4],
    ['1Pi', 1024 ** 5],
    ['1Ei', 1024 ** 6],
    ['1K', 1e3],
    ['500M', 500e6],
    ['1G', 1e9],
    ['1T', 1e12],
    ['1P', 1e15],
    ['1E', 1e18],
  ])('parses %s to %d bytes', (input, expected) => {
    expect(parseMemory(input)).toBe(expected)
  })

  it.each([undefined, null, ''])('returns 0 for missing value %s', (input) => {
    expect(parseMemory(input)).toBe(0)
  })

  it.each(['abc', 'Mi', '1 Mi', '1Mib', '1mi', '1Xi', ' 1Gi', '1Gi '])('returns 0 for malformed or unknown quantity %j', (input) => {
    expect(parseMemory(input)).toBe(0)
  })

  // Kubernetes' decimal SI suffix for kilo is lowercase "k" ("500k"); uppercase
  // "K" is not a valid Kubernetes suffix. The parser only knows "K", so a valid
  // "500k" request is read as 0 bytes.
  it.fails('parses the lowercase decimal kilo suffix (500k = 500000 bytes)', () => {
    expect(parseMemory('500k')).toBe(500_000)
  })

  // Same as CPU: exponent notation is valid in Kubernetes but parsed as 0.
  it.fails('parses exponent notation (1e3 = 1000 bytes)', () => {
    expect(parseMemory('1e3')).toBe(1000)
  })
})

describe('formatCpu', () => {
  it.each([
    [0, '0m'],
    [-5, '0m'],
    [0.4, '0m'],
    [1, '1m'],
    [99.5, '100m'],
    [250, '250m'],
    [999, '999m'],
    [1000, '1.00 cores'],
    [1500, '1.50 cores'],
    [12345, '12.35 cores'],
  ])('formats %d millicores as %s', (input, expected) => {
    expect(formatCpu(input)).toBe(expected)
  })
})

describe('formatMemory', () => {
  const MiB = 1024 ** 2
  it.each([
    [0, '0 MiB'],
    [-1, '0 MiB'],
    [1, '0 MiB'],
    [MiB, '1 MiB'],
    [128 * MiB, '128 MiB'],
    [1023 * MiB, '1023 MiB'],
    [1024 * MiB, '1.00 GiB'],
    [1.5 * 1024 * MiB, '1.50 GiB'],
  ])('formats %d bytes as %s', (input, expected) => {
    expect(formatMemory(input)).toBe(expected)
  })
})

describe('percentOf', () => {
  it('returns the rounded percentage', () => {
    expect(percentOf(50, 200)).toBe(25)
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
  })

  it('caps at 100 when value exceeds total', () => {
    expect(percentOf(300, 100)).toBe(100)
    expect(percentOf(100, 100)).toBe(100)
  })

  it('returns 0 for zero value', () => {
    expect(percentOf(0, 100)).toBe(0)
  })

  it.each([0, -10, Number.NaN])('returns null when total is %d', (total) => {
    expect(percentOf(10, total)).toBeNull()
  })
})

describe('formatting near unit boundaries', () => {
  // Rounding happens after the unit is chosen, so values just below the
  // boundary are rendered with the "wrong" unit (e.g. "1000m" instead of
  // "1.00 cores", "1024 MiB" instead of "1.00 GiB"). Cosmetic only.
  it.fails('formats 999.6 millicores as cores rather than "1000m"', () => {
    expect(formatCpu(999.6)).toBe('1.00 cores')
  })

  it.fails('formats 1023.9 MiB as GiB rather than "1024 MiB"', () => {
    expect(formatMemory(1023.9 * 1024 ** 2)).toBe('1.00 GiB')
  })
})
