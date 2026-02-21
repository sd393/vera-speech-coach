import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBillingPortalSessionsCreate = vi.fn()

vi.mock('@/backend/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'user123', email: 'test@test.com' }),
}))

vi.mock('@/backend/stripe', () => ({
  stripe: vi.fn(() => ({
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate,
      },
    },
  })),
}))

vi.mock('@/backend/subscription', () => ({
  ensureUserDoc: vi.fn().mockResolvedValue({
    stripeCustomerId: 'cus_pro456',
    plan: 'pro',
    subscriptionStatus: 'active',
  }),
}))

import { POST } from '@/app/api/billing-portal/route'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { ensureUserDoc } from '@/backend/subscription'

function createRequest(): NextRequest {
  return new NextRequest('http://localhost/api/billing-portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: 'localhost',
    },
  })
}

describe('POST /api/billing-portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(requireAuth).mockResolvedValue({ uid: 'user123', email: 'test@test.com' })
    vi.mocked(ensureUserDoc).mockResolvedValue({
      stripeCustomerId: 'cus_pro456',
      plan: 'pro',
      subscriptionStatus: 'active',
    })
    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal_789',
    })
  })

  it('returns billing portal URL for authenticated user with stripeCustomerId', async () => {
    const response = await POST(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.url).toBe('https://billing.stripe.com/portal_789')

    expect(ensureUserDoc).toHaveBeenCalledWith('user123', 'test@test.com')
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_pro456' })
    )
  })

  it('returns 401 when not authenticated', async () => {
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

  it('returns 400 when user has no stripeCustomerId', async () => {
    vi.mocked(ensureUserDoc).mockResolvedValue({
      stripeCustomerId: null,
      plan: 'free',
      subscriptionStatus: null,
    })

    const response = await POST(createRequest())
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('No subscription found')
  })

  it('returns 500 when Stripe API fails', async () => {
    mockBillingPortalSessionsCreate.mockRejectedValueOnce(new Error('Stripe unavailable'))

    const response = await POST(createRequest())
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Failed to open billing portal')
  })
})
