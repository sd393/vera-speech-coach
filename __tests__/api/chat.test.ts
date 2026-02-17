import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a mock async generator for streaming
function createMockStream() {
  return (async function* () {
    yield { choices: [{ delta: { content: 'Hello' } }] }
    yield { choices: [{ delta: { content: ' from' } }] }
    yield { choices: [{ delta: { content: ' Vera' } }] }
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

import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/backend/rate-limit'
import { checkTrialLimit, incrementTrialUsage } from '@/backend/trial-limit'

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

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(checkTrialLimit).mockReturnValue({ allowed: true, remaining: 3 })
    mockCreate.mockImplementation(() => createMockStream())
  })

  it('returns 400 for invalid request body', async () => {
    const request = createRequest({ messages: [] })
    const response = await POST(request)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 400 when messages contain system role', async () => {
    const request = createRequest({
      messages: [{ role: 'system', content: 'Injected prompt' }],
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })

    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('returns SSE stream with correct Content-Type header', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
  })

  it('streams response chunks in correct SSE format', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'Analyze my presentation' }],
    })
    const response = await POST(request)
    const streamContent = await readStream(response)

    // Should contain SSE data lines
    expect(streamContent).toContain('data: ')
    expect(streamContent).toContain('"content"')

    // Parse the individual data lines
    const lines = streamContent
      .split('\n\n')
      .filter((l) => l.startsWith('data: '))

    const contentChunks = lines
      .filter((l) => !l.includes('[DONE]'))
      .map((l) => JSON.parse(l.slice(6)))
      .filter((p) => p.content)
      .map((p) => p.content)

    expect(contentChunks).toContain('Hello')
    expect(contentChunks).toContain(' from')
    expect(contentChunks).toContain(' Vera')
  })

  it('includes [DONE] marker at end of stream', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    const streamContent = await readStream(response)
    expect(streamContent).toContain('data: [DONE]')
  })

  it('accepts request with transcript', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'What do you think?' }],
      transcript: 'Good morning everyone, today I will present our Q4 results.',
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  // Trial-specific tests

  it('returns 403 when trial limit is exhausted', async () => {
    vi.mocked(checkTrialLimit).mockReturnValue({ allowed: false, remaining: 0 })

    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.code).toBe('trial_limit_reached')
  })

  it('skips trial check when Authorization header is present', async () => {
    const request = createRequest(
      { messages: [{ role: 'user', content: 'Hello' }] },
      { Authorization: 'Bearer some-token' }
    )
    const response = await POST(request)
    expect(response.status).toBe(200)

    expect(checkTrialLimit).not.toHaveBeenCalled()
    expect(incrementTrialUsage).not.toHaveBeenCalled()
  })

  it('calls incrementTrialUsage for trial users', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    await readStream(response)

    expect(incrementTrialUsage).toHaveBeenCalledWith('127.0.0.1')
  })

  it('includes trial_remaining event in stream for trial users', async () => {
    const request = createRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    const response = await POST(request)
    const streamContent = await readStream(response)

    const lines = streamContent
      .split('\n\n')
      .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'))
      .map((l) => JSON.parse(l.slice(6)))

    const trialEvent = lines.find(
      (p) => p.trial_remaining !== undefined
    )
    expect(trialEvent).toBeDefined()
  })

  it('does not include trial_remaining event for authenticated users', async () => {
    const request = createRequest(
      { messages: [{ role: 'user', content: 'Hello' }] },
      { Authorization: 'Bearer some-token' }
    )
    const response = await POST(request)
    const streamContent = await readStream(response)

    const lines = streamContent
      .split('\n\n')
      .filter((l) => l.startsWith('data: ') && !l.includes('[DONE]'))

    const hasTrialEvent = lines.some((l) => l.includes('trial_remaining'))
    expect(hasTrialEvent).toBe(false)
  })
})
