import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyIdToken = vi.fn()

vi.mock('@/backend/firebase-admin', () => ({
  adminAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}))

import { verifyAuth, requireAuth } from '@/backend/auth'

function createRequest(headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/test', {
    method: 'GET',
    headers: { ...headers },
  })
}

describe('verifyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns uid and email for a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-123',
      email: 'test@example.com',
    })

    const request = createRequest({ Authorization: 'Bearer valid-token' })
    const result = await verifyAuth(request)

    expect(result).toEqual({ uid: 'user-123', email: 'test@example.com' })
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token')
  })

  it('returns null when Authorization header is missing', async () => {
    const request = createRequest()
    const result = await verifyAuth(request)

    expect(result).toBeNull()
    expect(mockVerifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 Response for malformed header without Bearer prefix', async () => {
    const request = createRequest({ Authorization: 'Basic some-credentials' })
    const result = await verifyAuth(request)

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Invalid authorization format')
    expect(mockVerifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 Response when token is expired or invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'))

    const request = createRequest({ Authorization: 'Bearer expired-token' })
    const result = await verifyAuth(request)

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Invalid or expired token')
  })

  it('returns uid with undefined email when token has no email claim', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-no-email',
    })

    const request = createRequest({ Authorization: 'Bearer token-no-email' })
    const result = await verifyAuth(request)

    expect(result).toEqual({ uid: 'user-no-email', email: undefined })
  })
})

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns uid and email for a valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-456',
      email: 'admin@example.com',
    })

    const request = createRequest({ Authorization: 'Bearer valid-token' })
    const result = await requireAuth(request)

    expect(result).toEqual({ uid: 'user-456', email: 'admin@example.com' })
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token')
  })

  it('returns 401 Response when Authorization header is missing', async () => {
    const request = createRequest()
    const result = await requireAuth(request)

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Authentication required')
    expect(mockVerifyIdToken).not.toHaveBeenCalled()
  })

  it('returns 401 Response when token is invalid', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const request = createRequest({ Authorization: 'Bearer bad-token' })
    const result = await requireAuth(request)

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Invalid or expired token')
  })
})
