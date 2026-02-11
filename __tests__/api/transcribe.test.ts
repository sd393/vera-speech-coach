import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTranscriptionCreate = vi.fn().mockResolvedValue({ text: 'This is the transcribed text.' })

vi.mock('@/backend/openai', () => ({
  openai: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionCreate,
      },
    },
  })),
}))

vi.mock('@/backend/audio', () => ({
  downloadToTmp: vi.fn().mockResolvedValue('/tmp/vera-test-input.mp4'),
  processFileForWhisper: vi.fn().mockResolvedValue({
    chunkPaths: ['/tmp/vera-test-chunk0.mp3'],
    allTempPaths: ['/tmp/vera-test-input.mp4', '/tmp/vera-test-compressed.mp3', '/tmp/vera-test-chunk0.mp3'],
  }),
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue('mock-stream'),
  },
  createReadStream: vi.fn().mockReturnValue('mock-stream'),
}))

import { POST } from '@/app/api/transcribe/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/backend/rate-limit'
import { downloadToTmp, processFileForWhisper } from '@/backend/audio'
import { del } from '@vercel/blob'

function createRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    mockTranscriptionCreate.mockResolvedValue({ text: 'This is the transcribed text.' })
    vi.mocked(downloadToTmp).mockResolvedValue('/tmp/vera-test-input.mp4')
    vi.mocked(processFileForWhisper).mockResolvedValue({
      chunkPaths: ['/tmp/vera-test-chunk0.mp3'],
      allTempPaths: ['/tmp/vera-test-input.mp4', '/tmp/vera-test-compressed.mp3'],
    })
  })

  it('returns 400 when body is invalid', async () => {
    const request = createRequest({})
    const response = await POST(request)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid request')
  })

  it('returns 400 when blobUrl is not a valid URL', async () => {
    const request = createRequest({ blobUrl: 'not-a-url', fileName: 'test.mp4' })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })

    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/test.mp4',
      fileName: 'test.mp4',
    })
    const response = await POST(request)
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('returns transcript on successful transcription', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/presentation.mp4',
      fileName: 'presentation.mp4',
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.transcript).toBe('This is the transcribed text.')
    expect(downloadToTmp).toHaveBeenCalledWith(
      'https://example.vercel-storage.com/presentation.mp4',
      'presentation.mp4'
    )
  })

  it('returns 500 on OpenAI API failure', async () => {
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('API error'))

    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/test.mp4',
      fileName: 'test.mp4',
    })

    const response = await POST(request)
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Failed to transcribe')
  })

  it('cleans up temp files even on error', async () => {
    const { cleanupTempFiles } = await import('@/backend/audio')
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('API error'))

    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/test.mp4',
      fileName: 'test.mp4',
    })

    await POST(request)

    expect(cleanupTempFiles).toHaveBeenCalled()
  })

  it('deletes blob after processing', async () => {
    const request = createRequest({
      blobUrl: 'https://example.vercel-storage.com/test.mp4',
      fileName: 'test.mp4',
    })

    await POST(request)

    expect(del).toHaveBeenCalledWith('https://example.vercel-storage.com/test.mp4')
  })
})
