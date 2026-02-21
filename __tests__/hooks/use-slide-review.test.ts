import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSlideReview } from '@/hooks/use-slide-review'

// Mock @vercel/blob/client upload
vi.mock('@vercel/blob/client', () => ({
  upload: vi.fn(),
}))

// Mock validateSlideFile from validation
vi.mock('@/backend/validation', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/backend/validation')>()
  return {
    ...original,
    validateSlideFile: vi.fn().mockReturnValue({ valid: true }),
  }
})

import { upload } from '@vercel/blob/client'
import { validateSlideFile } from '@/backend/validation'

// Helper: build a ReadableStream from an array of SSE-formatted strings
function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

function sseData(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`
}

const SLIDE_FEEDBACK = {
  slideNumber: 1,
  title: 'Intro',
  rating: 'strong' as const,
  headline: 'Good slide',
  strengths: ['Clear'],
  improvements: ['Add data'],
}

const DECK_SUMMARY = {
  deckTitle: 'My Deck',
  audienceAssumed: 'Investors',
  overallRating: 75,
  executiveSummary: 'Solid deck.',
  slides: [SLIDE_FEEDBACK],
  topPriorities: ['Fix slide 3'],
}

describe('useSlideReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Prevent cleanup blob-delete fetch from hitting the real network
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn().mockReturnValue(true) })
    vi.mocked(upload).mockResolvedValue({
      url: 'https://example.vercel-storage.com/deck.pdf',
      downloadUrl: 'https://example.vercel-storage.com/deck.pdf',
      pathname: 'deck.pdf',
      contentType: 'application/pdf',
      contentDisposition: 'inline',
      etag: '"abc123"',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with idle state and panel closed', () => {
    const { result } = renderHook(() => useSlideReview('test-token'))
    expect(result.current.progress.step).toBe('idle')
    expect(result.current.slideFeedbacks).toHaveLength(0)
    expect(result.current.deckSummary).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.panelOpen).toBe(false)
  })

  it('openPanel and closePanel toggle panelOpen', () => {
    const { result } = renderHook(() => useSlideReview('test-token'))
    expect(result.current.panelOpen).toBe(false)
    act(() => { result.current.openPanel() })
    expect(result.current.panelOpen).toBe(true)
    act(() => { result.current.closePanel() })
    expect(result.current.panelOpen).toBe(false)
  })

  it('uploadAndAnalyze opens the panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(['data: [DONE]\n\n']),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    expect(result.current.panelOpen).toBe(false)

    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })
    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    expect(result.current.panelOpen).toBe(true)
  })

  it('reset clears panelOpen', async () => {
    const { result } = renderHook(() => useSlideReview('test-token'))
    act(() => { result.current.openPanel() })
    expect(result.current.panelOpen).toBe(true)
    act(() => { result.current.reset() })
    expect(result.current.panelOpen).toBe(false)
  })

  it('validates file before uploading', async () => {
    vi.mocked(validateSlideFile).mockReturnValueOnce({
      valid: false,
      error: 'Unsupported file type. Please upload a PDF file.',
    })

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['content'], 'video.mp4', { type: 'video/mp4' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    expect(result.current.error).toContain('PDF')
    expect(upload).not.toHaveBeenCalled()
  })

  it('accumulates slide feedbacks as SSE events arrive', async () => {
    const streamLines = [
      sseData('status', { step: 'analyzing', total: 2 }),
      sseData('slide_feedback', SLIDE_FEEDBACK),
      sseData('slide_feedback', {
        ...SLIDE_FEEDBACK,
        slideNumber: 2,
        title: 'Problem',
      }),
      sseData('deck_summary', DECK_SUMMARY),
      'data: [DONE]\n\n',
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(streamLines),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    await waitFor(() => {
      expect(result.current.slideFeedbacks).toHaveLength(2)
    })

    expect(result.current.deckSummary).not.toBeNull()
    expect(result.current.deckSummary?.deckTitle).toBe('My Deck')
    expect(result.current.progress.step).toBe('done')
  })

  it('sets error state on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: 'Server error' }),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
    expect(result.current.progress.step).toBe('error')
  })

  it('sets error when reanalyze called without uploaded file', async () => {
    const { result } = renderHook(() => useSlideReview('test-token'))

    await act(async () => {
      await result.current.reanalyze('investors')
    })

    expect(result.current.error).toContain('No slide deck loaded')
  })

  it('reset clears all state', async () => {
    // First trigger some state
    const streamLines = [
      sseData('slide_feedback', SLIDE_FEEDBACK),
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(streamLines),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    await waitFor(() => {
      expect(result.current.slideFeedbacks).toHaveLength(1)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.slideFeedbacks).toHaveLength(0)
    expect(result.current.deckSummary).toBeNull()
    expect(result.current.progress.step).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.panelOpen).toBe(false)
  })

  it('stores a review snapshot keyed by reviewKey after analysis', async () => {
    const streamLines = [
      sseData('slide_feedback', SLIDE_FEEDBACK),
      sseData('deck_summary', DECK_SUMMARY),
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(streamLines),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file, undefined, 'msg-abc')
    })

    await waitFor(() => {
      expect(result.current.reviews['msg-abc']).toBeDefined()
    })

    const snapshot = result.current.reviews['msg-abc']
    expect(snapshot.slideFeedbacks).toHaveLength(1)
    expect(snapshot.deckSummary?.deckTitle).toBe('My Deck')
    expect(snapshot.blobUrl).toBe('https://example.vercel-storage.com/deck.pdf')
    expect(snapshot.fileName).toBe('deck.pdf')
  })

  it('openReview restores snapshot and opens panel', async () => {
    const streamLines = [
      sseData('slide_feedback', SLIDE_FEEDBACK),
      sseData('deck_summary', DECK_SUMMARY),
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(streamLines),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file, undefined, 'msg-xyz')
    })

    await waitFor(() => {
      expect(result.current.reviews['msg-xyz']).toBeDefined()
    })

    // Close the panel, then clear display state by reopening via a different path
    act(() => { result.current.closePanel() })
    expect(result.current.panelOpen).toBe(false)

    // openReview should restore the snapshot and open panel
    act(() => { result.current.openReview('msg-xyz') })
    expect(result.current.panelOpen).toBe(true)
    expect(result.current.slideFeedbacks).toHaveLength(1)
    expect(result.current.deckSummary?.deckTitle).toBe('My Deck')
    expect(result.current.progress.step).toBe('done')
  })

  it('openReview is a no-op for unknown key', () => {
    const { result } = renderHook(() => useSlideReview('test-token'))
    act(() => { result.current.openReview('nonexistent-key') })
    expect(result.current.panelOpen).toBe(false)
    expect(result.current.slideFeedbacks).toHaveLength(0)
  })

  it('reset clears reviews state', async () => {
    const streamLines = [
      sseData('slide_feedback', SLIDE_FEEDBACK),
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: makeSSEStream(streamLines),
        json: vi.fn(),
      })
    )

    const { result } = renderHook(() => useSlideReview('test-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file, undefined, 'msg-reset')
    })

    await waitFor(() => {
      expect(result.current.reviews['msg-reset']).toBeDefined()
    })

    act(() => { result.current.reset() })
    expect(result.current.reviews).toEqual({})
  })

  it('includes authorization header when authToken provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: [DONE]\n\n']),
      json: vi.fn(),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useSlideReview('my-auth-token'))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    const fetchCall = fetchSpy.mock.calls[0]
    const headers = fetchCall[1].headers
    expect(headers.authorization).toBe('Bearer my-auth-token')
  })

  it('omits authorization header when no authToken', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: [DONE]\n\n']),
      json: vi.fn(),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useSlideReview(null))
    const file = new File(['%PDF-1.4'], 'deck.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAndAnalyze(file)
    })

    const fetchCall = fetchSpy.mock.calls[0]
    const headers = fetchCall[1].headers
    expect(headers.authorization).toBeUndefined()
  })
})
