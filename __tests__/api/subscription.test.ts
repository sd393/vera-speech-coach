import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/backend/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'user123' }),
}))

vi.mock('@/backend/subscription', () => ({
  getUserPlan: vi.fn().mockResolvedValue({ plan: 'pro', subscriptionStatus: 'active' }),
}))

import { GET } from '@/app/api/subscription/route'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/backend/auth'
import { getUserPlan } from '@/backend/subscription'

function createRequest(): NextRequest {
  return new NextRequest('http://localhost/api/subscription', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer valid-token',
    },
  })
}

describe('GET /api/subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(requireAuth).mockResolvedValue({ uid: 'user123' })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'pro', subscriptionStatus: 'active' })
  })

  it('returns pro plan and active status for authenticated Pro user', async () => {
    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ plan: 'pro', subscriptionStatus: 'active' })

    expect(requireAuth).toHaveBeenCalled()
    expect(getUserPlan).toHaveBeenCalledWith('user123')
  })

  it('returns free plan and null status for authenticated free user', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ plan: 'free', subscriptionStatus: null })
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Sign in to continue.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const response = await GET(createRequest())
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('Sign in')
  })

  it('returns free defaults for a new user', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })

    const response = await GET(createRequest())
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toEqual({ plan: 'free', subscriptionStatus: null })

    expect(getUserPlan).toHaveBeenCalledWith('user123')
  })
})
