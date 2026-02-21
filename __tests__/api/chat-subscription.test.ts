import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a mock async generator for streaming
function createMockStream() {
  return (async function* () {
    yield { choices: [{ delta: { content: 'Hello' } }] }
  })()
}

const mockCreate = vi.fn().mockImplementation(() => createMockStream())

vi.mock('@/backend/openai', () => ({
  openai: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}))

vi.mock('@/backend/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/backend/trial-limit', () => ({
  checkTrialLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 3 }),
  incrementTrialUsage: vi.fn(),
}))

vi.mock('@/backend/auth', () => ({
  verifyAuth: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/backend/subscription', () => ({
  getUserPlan: vi.fn().mockResolvedValue({ plan: 'free', subscriptionStatus: null }),
}))

import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/backend/rate-limit'
import { checkTrialLimit } from '@/backend/trial-limit'
import { verifyAuth } from '@/backend/auth'
import { getUserPlan } from '@/backend/subscription'

function createRequest(
  body: object,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  return result
}

const validBody = { messages: [{ role: 'user', content: 'Hello' }] }

describe('POST /api/chat — subscription enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(checkTrialLimit).mockReturnValue({ allowed: true, remaining: 3 })
    vi.mocked(verifyAuth).mockResolvedValue(null)
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })
    mockCreate.mockImplementation(() => createMockStream())
  })

  it('allows trial user (no auth) with existing 4-message limit', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(null)
    vi.mocked(checkTrialLimit).mockReturnValue({ allowed: true, remaining: 3 })

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(checkTrialLimit).toHaveBeenCalledWith('127.0.0.1')
    expect(getUserPlan).not.toHaveBeenCalled()
  })

  it('allows authenticated Pro user with unlimited messages', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'pro-user', email: 'pro@test.com' })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'pro', subscriptionStatus: 'active' })

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(getUserPlan).toHaveBeenCalledWith('pro-user')

    // checkRateLimit is called for IP rate limiting, but NOT for the free plan check
    const rateLimitCalls = vi.mocked(checkRateLimit).mock.calls
    const freePlanCalls = rateLimitCalls.filter(
      (call) => typeof call[0] === 'string' && call[0].startsWith('free:')
    )
    expect(freePlanCalls).toHaveLength(0)
  })

  it('allows authenticated free user when under daily limit', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'free-user', email: 'free@test.com' })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(getUserPlan).toHaveBeenCalledWith('free-user')

    const rateLimitCalls = vi.mocked(checkRateLimit).mock.calls
    const freePlanCalls = rateLimitCalls.filter(
      (call) => typeof call[0] === 'string' && call[0].startsWith('free:')
    )
    expect(freePlanCalls).toHaveLength(1)
    expect(freePlanCalls[0][0]).toBe('free:free-user')
  })

  it('returns 403 with free_limit_reached when free user exceeds daily limit', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'free-user', email: 'free@test.com' })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })
    vi.mocked(checkRateLimit).mockImplementation((id: string) => {
      if (id.startsWith('free:')) return { allowed: false }
      return { allowed: true }
    })

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.code).toBe('free_limit_reached')
    expect(body.error).toContain('daily message limit')
  })

  it('returns 401 for invalid token and does not check trial or plan', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('Invalid or expired token')

    expect(checkTrialLimit).not.toHaveBeenCalled()
    expect(getUserPlan).not.toHaveBeenCalled()
  })

  it('allows free user again after rate limit window resets', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ uid: 'free-user', email: 'free@test.com' })
    vi.mocked(getUserPlan).mockResolvedValue({ plan: 'free', subscriptionStatus: null })
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })

    const request = createRequest(validBody)
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    // Verify the stream completes successfully
    const streamContent = await readStream(response)
    expect(streamContent).toContain('data: [DONE]')
  })
})
