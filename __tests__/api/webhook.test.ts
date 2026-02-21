import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockConstructEvent = vi.fn()
const mockSubscriptionsRetrieve = vi.fn()
const mockGet = vi.fn()

vi.mock('@/backend/stripe', () => ({
  stripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
    },
  })),
}))

vi.mock('@/backend/subscription', () => ({
  ensureUserDoc: vi.fn(),
  updateSubscription: vi.fn(),
}))

vi.mock('@/backend/firebase-admin', () => ({
  db: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
      })),
    })),
  })),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
import { NextRequest } from 'next/server'
import { ensureUserDoc, updateSubscription } from '@/backend/subscription'

function createWebhookRequest(body: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/webhooks/stripe', () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

    // Default: doc does not exist, so events are never skipped
    mockGet.mockResolvedValue({ exists: false })
  })

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET
    }
  })

  it('handles checkout.session.completed — calls ensureUserDoc and updateSubscription with pro plan', async () => {
    const event = {
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          metadata: { firebaseUid: 'user123' },
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(ensureUserDoc).toHaveBeenCalledWith('user123')
    expect(updateSubscription).toHaveBeenCalledWith('user123', {
      plan: 'pro',
      subscriptionId: 'sub_123',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_123',
    })
  })

  it('handles customer.subscription.updated with canceled status', async () => {
    const event = {
      type: 'customer.subscription.updated',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          metadata: { firebaseUid: 'user123' },
          status: 'canceled',
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(updateSubscription).toHaveBeenCalledWith('user123', {
      subscriptionStatus: 'canceled',
    })
  })

  it('handles customer.subscription.deleted — resets to free plan and clears subscription fields', async () => {
    const event = {
      type: 'customer.subscription.deleted',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          metadata: { firebaseUid: 'user123' },
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(updateSubscription).toHaveBeenCalledWith('user123', {
      plan: 'free',
      subscriptionId: null,
      subscriptionStatus: null,
    })
  })

  it('handles invoice.payment_failed — sets subscriptionStatus to past_due', async () => {
    const event = {
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          subscription: 'sub_456',
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)
    mockSubscriptionsRetrieve.mockResolvedValue({
      metadata: { firebaseUid: 'user456' },
    })

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_456')
    expect(updateSubscription).toHaveBeenCalledWith('user456', {
      subscriptionStatus: 'past_due',
    })
  })

  it('returns 400 when constructEvent throws (invalid signature)', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const response = await POST(createWebhookRequest('{}', 'sig_invalid'))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid signature')
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const response = await POST(createWebhookRequest('{}'))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Missing stripe-signature')
  })

  it('returns 200 for unknown/unhandled event types', async () => {
    const event = {
      type: 'some.unknown.event',
      created: Math.floor(Date.now() / 1000),
      data: { object: {} },
    }

    mockConstructEvent.mockReturnValue(event)

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(ensureUserDoc).not.toHaveBeenCalled()
  })

  it('skips processing when event is older than doc updatedAt (idempotency)', async () => {
    const oldTimestampSeconds = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    const docTimestampMs = Date.now() // now

    const event = {
      type: 'checkout.session.completed',
      created: oldTimestampSeconds,
      data: {
        object: {
          metadata: { firebaseUid: 'user123' },
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        updatedAt: { toMillis: () => docTimestampMs },
      }),
    })

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(ensureUserDoc).not.toHaveBeenCalled()
  })

  it('returns 200 and does not crash when firebaseUid is missing from metadata', async () => {
    const event = {
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          metadata: {},
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    }

    mockConstructEvent.mockReturnValue(event)

    const response = await POST(createWebhookRequest('{}', 'sig_valid'))
    expect(response.status).toBe(200)

    expect(updateSubscription).not.toHaveBeenCalled()
    expect(ensureUserDoc).not.toHaveBeenCalled()
  })
})
