import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function (this: any, key: string) {
    this.key = key
  }),
}))

let savedEnv: string | undefined

describe('stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    savedEnv = process.env.STRIPE_SECRET_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123'
    vi.resetModules()
  })

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.STRIPE_SECRET_KEY = savedEnv
    } else {
      delete process.env.STRIPE_SECRET_KEY
    }
  })

  it('stripe() returns a Stripe instance', async () => {
    const { stripe } = await import('@/backend/stripe')
    const client = stripe()

    expect(client).toHaveProperty('key', 'sk_test_abc123')
  })

  it('throws when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY

    const { stripe } = await import('@/backend/stripe')

    expect(() => stripe()).toThrow(
      'STRIPE_SECRET_KEY environment variable is not set'
    )
  })

  it('multiple calls return the same instance (singleton)', async () => {
    const Stripe = (await import('stripe')).default as unknown as ReturnType<typeof vi.fn>

    const { stripe } = await import('@/backend/stripe')

    const first = stripe()
    const second = stripe()

    expect(first).toBe(second)
    expect(Stripe).toHaveBeenCalledTimes(1)
  })
})
