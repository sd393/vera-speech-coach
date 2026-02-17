import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkTrialLimit,
  incrementTrialUsage,
  resetTrialUsage,
  TRIAL_MESSAGE_LIMIT,
} from '@/backend/trial-limit'

describe('trial-limit', () => {
  const TEST_IP = '192.168.1.1'

  beforeEach(() => {
    resetTrialUsage(TEST_IP)
    resetTrialUsage('10.0.0.1')
  })

  it('returns allowed with full remaining for a new IP', () => {
    const result = checkTrialLimit(TEST_IP)
    expect(result).toEqual({ allowed: true, remaining: TRIAL_MESSAGE_LIMIT })
  })

  it('decrements remaining after one increment', () => {
    incrementTrialUsage(TEST_IP)
    const result = checkTrialLimit(TEST_IP)
    expect(result).toEqual({
      allowed: true,
      remaining: TRIAL_MESSAGE_LIMIT - 1,
    })
  })

  it('returns not allowed after reaching the limit', () => {
    for (let i = 0; i < TRIAL_MESSAGE_LIMIT; i++) {
      incrementTrialUsage(TEST_IP)
    }
    const result = checkTrialLimit(TEST_IP)
    expect(result).toEqual({ allowed: false, remaining: 0 })
  })

  it('tracks different IPs independently', () => {
    incrementTrialUsage(TEST_IP)
    incrementTrialUsage(TEST_IP)

    const result1 = checkTrialLimit(TEST_IP)
    const result2 = checkTrialLimit('10.0.0.1')

    expect(result1.remaining).toBe(TRIAL_MESSAGE_LIMIT - 2)
    expect(result2.remaining).toBe(TRIAL_MESSAGE_LIMIT)
  })

  it('does not error when incrementing beyond the limit', () => {
    for (let i = 0; i < TRIAL_MESSAGE_LIMIT + 3; i++) {
      incrementTrialUsage(TEST_IP)
    }
    const result = checkTrialLimit(TEST_IP)
    expect(result).toEqual({ allowed: false, remaining: 0 })
  })

  it('resets a specific IP count', () => {
    for (let i = 0; i < TRIAL_MESSAGE_LIMIT; i++) {
      incrementTrialUsage(TEST_IP)
    }
    expect(checkTrialLimit(TEST_IP).allowed).toBe(false)

    resetTrialUsage(TEST_IP)
    expect(checkTrialLimit(TEST_IP)).toEqual({
      allowed: true,
      remaining: TRIAL_MESSAGE_LIMIT,
    })
  })
})
