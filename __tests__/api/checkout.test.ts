import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCheckoutSessionsCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()

vi.mock('@/backend/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'user123', email: 'test@test.com' }),
}))

vi.mock('@/backend/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}))

vi.mock('@/backend/stripe', () => ({
  stripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate,
      },
    },
  })),
}))

vi.mock('@/backend/subscription', () => ({
  getUserPlan: vi.fn().mockResolvedValue({ plan: 'free', subscriptionStatus: null }),
  createOrGetStripeCustomer: vi.fn().mockResolvedValue('cus_test123'),
}))

import { POST } from '@/app/api/checkout/route'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { checkRateLimit } from '@/backend/rate-limit'
import { getUserPlan, createOrGetStripeCustomer } from '@/backend/subscription'

function createRequest(): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: 'localhost',
    },
  })
}

describe('POST /api/checkout', () => {
  const originalEnv = process.env.STRIPE_PRO_PRICE_ID

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_PRO_PRICE_ID = 'price_test'

    vi.mocked(requireAuth).mockResolvedValue({ uid: 'user123', email: 'test@test.com' })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })
    vi.mocked(createOrGetStripeCustomer).mockResolvedValue('cus_test123')
    mockCheckoutSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_123' })
    mockBillingPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.com/portal_123' })
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STRIPE_PRO_PRICE_ID = originalEnv
    } else {
      delete process.env.STRIPE_PRO_PRICE_ID
    }
  })

  it('creates a Stripe Checkout session for authenticated free user', async () => {
    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.url).toBe('https://checkout.stripe.com/session_123')

    expect(createOrGetStripeCustomer).toHaveBeenCalledWith('user123', 'test@test.com')
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test123',
        line_items: [{ price: 'price_test', quantity: 1 }],
      })
    )
  })

  it('returns 401 when no auth token is provided', async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Sign in to continue.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const response = await POST(createRequest())
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('Sign in')
  })

  it('returns 401 when auth token is invalid or expired', async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Invalid or expired token.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const response = await POST(createRequest())
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('Invalid or expired')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })

    const response = await POST(createRequest())
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('returns billing portal URL for user with active Pro subscription', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'pro', subscriptionStatus: 'active' })

    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.url).toBe('https://billing.stripe.com/portal_123')

    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test123' })
    )
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled()
  })

  it('returns 500 when Stripe API fails', async () => {
    mockCheckoutSessionsCreate.mockRejectedValueOnce(new Error('Stripe unavailable'))

    const response = await POST(createRequest())
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Failed to create checkout session')
  })

  it('returns 500 when STRIPE_PRO_PRICE_ID is missing', async () => {
    delete process.env.STRIPE_PRO_PRICE_ID

    const response = await POST(createRequest())
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Payment is not configured')
  })
})
