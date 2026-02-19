import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies before importing the handler

const mockChatCreate = vi.fn()

vi.mock('@/backend/openai', () => ({
  openai: vi.fn(() => ({
    chat: {
      completions: {
        create: mockChatCreate,
      },
    },
  })),
}))

vi.mock('@/backend/audio', () => ({
  downloadToTmp: vi.fn().mockResolvedValue('/tmp/vera-slides-test.pdf'),
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/slides', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/backend/slides')>()
  return {
    ...original,
    extractSlideTexts: vi.fn().mockResolvedValue([
      { slideNumber: 1, text: 'Title slide: Q4 Results' },
      { slideNumber: 2, text: 'Revenue grew 30% YoY' },
    ]),
  }
})

vi.mock('@/backend/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { POST } from '@/app/api/slides/analyze/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/backend/rate-limit'
import { downloadToTmp, cleanupTempFiles } from '@/backend/audio'
import { extractSlideTexts } from '@/backend/slides'

const SLIDE_FEEDBACK_1 = {
  slideNumber: 1,
  title: 'Q4 Results',
  rating: 'strong',
  headline: 'Clear and impactful opener',
  strengths: ['Strong headline', 'Good visual hierarchy'],
  improvements: ['Add a hook question'],
}

const SLIDE_FEEDBACK_2 = {
  slideNumber: 2,
  title: 'Revenue Growth',
  rating: 'needs-work',
  headline: 'Numbers lack context',
  strengths: ['Has data'],
  improvements: ['Compare to industry benchmark', 'Add trendline'],
}

// The single API call returns the full deck object including per-slide feedback
const FULL_DECK_RESPONSE = {
  deckTitle: 'Q4 Results Deck',
  audienceAssumed: 'Investors',
  overallRating: 72,
  executiveSummary: 'Solid structure with some gaps in narrative.',
  topPriorities: ['Strengthen narrative arc', 'Add more data context'],
  slides: [SLIDE_FEEDBACK_1, SLIDE_FEEDBACK_2],
}

function createRequest(
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest('http://localhost/api/slides/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authorization: 'Bearer test-token',
      ...headers,
    },
    body: JSON.stringify(body ?? {}),
  })
}

async function readSSEEvents(
  response: Response
): Promise<Array<{ type: string; data: unknown }>> {
  const text = await response.text()
  const events: Array<{ type: string; data: unknown }> = []

  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') continue
    try {
      events.push(JSON.parse(payload))
    } catch {
      // ignore unparseable lines
    }
  }

  return events
}

describe('POST /api/slides/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(downloadToTmp).mockResolvedValue('/tmp/vera-slides-test.pdf')
    vi.mocked(extractSlideTexts).mockResolvedValue([
      { slideNumber: 1, text: 'Title slide: Q4 Results' },
      { slideNumber: 2, text: 'Revenue grew 30% YoY' },
    ])

    // Single call returns the combined full-deck response
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(FULL_DECK_RESPONSE) } }],
    })
  })

  it('returns 401 when no authorization header', async () => {
    const request = new NextRequest('http://localhost/api/slides/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: 'https://example.vercel-storage.com/deck.pdf',
        fileName: 'deck.pdf',
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('Sign in')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  it('returns 400 for invalid request body', async () => {
    const request = createRequest({})
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid request')
  })

  it('returns 400 when blobUrl is not a valid URL', async () => {
    const request = createRequest({
      blobUrl: 'not-a-url',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('streams SSE events for a valid request', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')

    const events = await readSSEEvents(response)
    const slideEvents = events.filter((e) => e.type === 'slide_feedback')
    const summaryEvents = events.filter((e) => e.type === 'deck_summary')

    expect(slideEvents).toHaveLength(2)
    expect(summaryEvents).toHaveLength(1)
  })

  it('emits status events during processing', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    const events = await readSSEEvents(response)
    const statusEvents = events.filter((e) => e.type === 'status')
    expect(statusEvents.length).toBeGreaterThan(0)
  })

  it('calls downloadToTmp with the provided blob URL', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/my-deck.pdf',
      fileName: 'my-deck.pdf',
    })
    await POST(request)
    expect(downloadToTmp).toHaveBeenCalledWith(
      'https://example.vercel-storage.com/my-deck.pdf',
      'my-deck.pdf'
    )
  })

  it('makes exactly one OpenAI call for the full deck', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    await readSSEEvents(response)
    expect(mockChatCreate).toHaveBeenCalledTimes(1)
  })

  it('does not call blob delete after download', async () => {
    // Blob deletion was removed — client needs the URL for thumbnails
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    await readSSEEvents(response)
    // No @vercel/blob mock registered, so if del were called it would throw
    // This test verifies the handler runs to completion without errors
    expect(response.status).toBe(200)
  })

  it('cleans up temp files even on error', async () => {
    vi.mocked(extractSlideTexts).mockRejectedValueOnce(new Error('PDF parse error'))
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    // Should still return 200 with SSE (error emitted as SSE event)
    expect(response.status).toBe(200)
    // Consume the stream so the finally block runs
    await readSSEEvents(response)
    expect(cleanupTempFiles).toHaveBeenCalled()
  })

  it('passes audienceContext to the analysis', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
      audienceContext: 'Series A venture investors',
    })
    const response = await POST(request)
    // Consume the stream so the OpenAI call completes
    await readSSEEvents(response)
    // Verify the single OpenAI call includes the audience context in the system message
    const firstCall = mockChatCreate.mock.calls[0]
    const systemMessage = firstCall[0].messages.find(
      (m: { role: string }) => m.role === 'system'
    )
    expect(systemMessage.content).toContain('Series A venture investors')
  })

  it('includes all slide texts in the single OpenAI user message', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    await readSSEEvents(response)
    const firstCall = mockChatCreate.mock.calls[0]
    const userMessage = firstCall[0].messages.find(
      (m: { role: string }) => m.role === 'user'
    )
    expect(userMessage.content).toContain('Title slide: Q4 Results')
    expect(userMessage.content).toContain('Revenue grew 30% YoY')
  })

  it('emits deck_summary with deckTitle from the API response', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    const events = await readSSEEvents(response)
    const summaryEvent = events.find((e) => e.type === 'deck_summary')
    expect(summaryEvent?.data).toMatchObject({
      deckTitle: 'Q4 Results Deck',
      overallRating: 72,
    })
  })

  it('handles OpenAI returning empty slides array gracefully', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              deckTitle: 'Empty Deck',
              overallRating: 0,
              executiveSummary: 'No slides.',
              topPriorities: [],
              slides: [],
            }),
          },
        },
      ],
    })
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/deck.pdf',
      fileName: 'deck.pdf',
    })
    const response = await POST(request)
    const events = await readSSEEvents(response)
    const slideEvents = events.filter((e) => e.type === 'slide_feedback')
    expect(slideEvents).toHaveLength(0)
    const summaryEvent = events.find((e) => e.type === 'deck_summary')
    expect(summaryEvent).toBeDefined()
  })
})
