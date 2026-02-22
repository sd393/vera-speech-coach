import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockUpdate,
  mockSet,
  mockGet,
  mockDoc,
  mockCollection,
  mockCustomersCreate,
  mockServerTimestamp,
} = vi.hoisted(() => {
  const mockUpdate = vi.fn().mockResolvedValue(undefined)
  const mockSet = vi.fn().mockResolvedValue(undefined)
  const mockGet = vi.fn().mockResolvedValue({ exists: false, data: () => undefined })
  const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, update: mockUpdate })
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc })
  const mockCustomersCreate = vi.fn()
  const mockServerTimestamp = vi.fn().mockReturnValue('SERVER_TIMESTAMP')
  return { mockUpdate, mockSet, mockGet, mockDoc, mockCollection, mockCustomersCreate, mockServerTimestamp }
})

vi.mock('@/backend/firebase-admin', () => ({
  db: vi.fn(() => ({ collection: mockCollection })),
}))

vi.mock('@/backend/stripe', () => ({
  stripe: vi.fn(() => ({
    customers: { create: mockCustomersCreate },
  })),
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: mockServerTimestamp,
  },
}))

import {
  ensureUserDoc,
  getUserPlan,
  createOrGetStripeCustomer,
  updateSubscription,
} from '@/backend/subscription'

const FREE_DEFAULTS = {
  stripeCustomerId: null,
  plan: 'free' as const,
  subscriptionId: null,
  subscriptionStatus: null,
  createdAt: 'SERVER_TIMESTAMP',
  updatedAt: 'SERVER_TIMESTAMP',
}

describe('ensureUserDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ exists: false, data: () => undefined })
  })

  it('creates doc with defaults when none exists', async () => {
    const createdDoc = { ...FREE_DEFAULTS }
    // First get returns not-exists, second get (after set) returns the new doc
    mockGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => createdDoc })

    const result = await ensureUserDoc('user-1', 'user@example.com')

    expect(mockCollection).toHaveBeenCalledWith('users')
    expect(mockDoc).toHaveBeenCalledWith('user-1')
    expect(mockSet).toHaveBeenCalledWith(
      {
        stripeCustomerId: null,
        plan: 'free',
        subscriptionId: null,
        subscriptionStatus: null,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
        email: 'user@example.com',
      },
      { merge: true }
    )
    expect(result).toEqual(createdDoc)
  })

  it('returns existing doc without overwriting when doc already exists', async () => {
    const existingDoc = {
      stripeCustomerId: 'cus_existing',
      plan: 'pro',
      subscriptionId: 'sub_123',
      subscriptionStatus: 'active',
      createdAt: '2025-01-01',
      updatedAt: '2025-06-01',
    }
    mockGet.mockResolvedValue({ exists: true, data: () => existingDoc })

    const result = await ensureUserDoc('user-2')

    expect(mockSet).not.toHaveBeenCalled()
    expect(result).toEqual(existingDoc)
  })

  it('uses set({ merge: true }) for race-condition safety', async () => {
    // Both concurrent calls see no doc, both create with merge: true
    // Each call does: get (not exists) -> set -> get (exists)
    // 4 total get() calls across both concurrent executions
    mockGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => ({ ...FREE_DEFAULTS }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ ...FREE_DEFAULTS }) })

    // Simulate two concurrent calls
    const [result1, result2] = await Promise.all([
      ensureUserDoc('user-race'),
      ensureUserDoc('user-race'),
    ])

    // Both calls should use merge: true to avoid overwrites
    expect(mockSet).toHaveBeenCalledTimes(2)
    for (const call of mockSet.mock.calls) {
      expect(call[1]).toEqual({ merge: true })
    }

    expect(result1).toEqual(FREE_DEFAULTS)
    expect(result2).toEqual(FREE_DEFAULTS)
  })
})

describe('getUserPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns free defaults for a new user with no doc', async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => undefined })

    const result = await getUserPlan('new-user')

    expect(result).toEqual({ plan: 'free', subscriptionStatus: null })
  })

  it('returns correct plan for an existing Pro user', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ plan: 'pro', subscriptionStatus: 'active' }),
    })

    const result = await getUserPlan('pro-user')

    expect(result).toEqual({ plan: 'pro', subscriptionStatus: 'active' })
  })

  it('returns free defaults when user doc does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => undefined })

    const result = await getUserPlan('nonexistent-user')

    expect(mockCollection).toHaveBeenCalledWith('users')
    expect(mockDoc).toHaveBeenCalledWith('nonexistent-user')
    expect(result).toEqual({ plan: 'free', subscriptionStatus: null })
  })
})

describe('createOrGetStripeCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates Stripe customer and stores ID when none exists', async () => {
    // ensureUserDoc returns a doc with no stripeCustomerId
    const userDoc = { ...FREE_DEFAULTS }
    mockGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => userDoc })

    mockCustomersCreate.mockResolvedValue({ id: 'cus_new_123' })

    const customerId = await createOrGetStripeCustomer('user-new', 'new@example.com')

    expect(customerId).toBe('cus_new_123')
    expect(mockCustomersCreate).toHaveBeenCalledWith({
      email: 'new@example.com',
      metadata: { firebaseUid: 'user-new' },
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      stripeCustomerId: 'cus_new_123',
      updatedAt: 'SERVER_TIMESTAMP',
    })
  })

  it('returns existing customer ID without calling Stripe', async () => {
    const existingDoc = {
      ...FREE_DEFAULTS,
      stripeCustomerId: 'cus_already_exists',
      plan: 'pro',
    }
    mockGet.mockResolvedValue({ exists: true, data: () => existingDoc })

    const customerId = await createOrGetStripeCustomer('user-existing')

    expect(customerId).toBe('cus_already_exists')
    expect(mockCustomersCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('updateSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls update with the partial data and updatedAt timestamp', async () => {
    const partialData = {
      plan: 'pro' as const,
      subscriptionId: 'sub_456',
      subscriptionStatus: 'active' as const,
    }

    await updateSubscription('user-sub', partialData)

    expect(mockCollection).toHaveBeenCalledWith('users')
    expect(mockDoc).toHaveBeenCalledWith('user-sub')
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'pro',
      subscriptionId: 'sub_456',
      subscriptionStatus: 'active',
      updatedAt: 'SERVER_TIMESTAMP',
    })
  })
})
