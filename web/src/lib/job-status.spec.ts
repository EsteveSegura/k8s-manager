import { describe, expect, it } from 'vitest'
import { jobStatusLabel, jobStatusVariant } from './job-status'

const cond = (type: string, status: string) => ({ type, status })

describe('jobStatusLabel', () => {
  it('is Complete when the Complete condition is True', () => {
    expect(jobStatusLabel({ status: { conditions: [cond('Complete', 'True')] } })).toBe('Complete')
  })

  it('prefers Complete over Failed when both are True', () => {
    expect(jobStatusLabel({ status: { conditions: [cond('Failed', 'True'), cond('Complete', 'True')] } })).toBe('Complete')
  })

  it('is Failed when the Failed condition is True', () => {
    expect(jobStatusLabel({ status: { conditions: [cond('Failed', 'True')], active: 2 } })).toBe('Failed')
  })

  it('ignores conditions whose status is not True', () => {
    expect(jobStatusLabel({ status: { conditions: [cond('Complete', 'False'), cond('Failed', 'Unknown')] } })).toBe('Pending')
  })

  it('does not treat a Complete-typed condition as Failed or vice versa', () => {
    expect(jobStatusLabel({ status: { conditions: [cond('Suspended', 'True')], active: 1 } })).toBe('Running')
  })

  it('is Running when there are active pods', () => {
    expect(jobStatusLabel({ status: { active: 1 } })).toBe('Running')
  })

  it('is Pending with no status at all', () => {
    expect(jobStatusLabel({})).toBe('Pending')
    expect(jobStatusLabel({ status: { active: 0 } })).toBe('Pending')
  })
})

describe('jobStatusVariant', () => {
  it.each([
    ['Complete', 'secondary'],
    ['Failed', 'destructive'],
    ['Running', 'outline'],
    ['Pending', 'outline'],
    ['whatever', 'outline'],
  ])('maps %s to %s', (status, variant) => {
    expect(jobStatusVariant(status)).toBe(variant)
  })
})
