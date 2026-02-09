import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTranscriptionCreate = vi.fn().mockResolvedValue('This is the transcribed text.')

vi.mock('@/lib/openai', () => ({
  openai: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionCreate,
      },
    },
  })),
}))

vi.mock('@/lib/audio', () => ({
  processFileForWhisper: vi.fn().mockResolvedValue({
    chunkPaths: ['/tmp/vera-test-chunk0.mp3'],
    allTempPaths: ['/tmp/vera-test-input.mp4', '/tmp/vera-test-compressed.mp3', '/tmp/vera-test-chunk0.mp3'],
  }),
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn().mockReturnValue('mock-stream'),
  },
  createReadStream: vi.fn().mockReturnValue('mock-stream'),
}))

import { POST } from '@/app/api/transcribe/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { processFileForWhisper } from '@/lib/audio'

function createRequest(file?: File): NextRequest {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  }
  return new NextRequest('http://localhost/api/transcribe', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/transcribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    mockTranscriptionCreate.mockResolvedValue('This is the transcribed text.')
    vi.mocked(processFileForWhisper).mockResolvedValue({
      chunkPaths: ['/tmp/vera-test-chunk0.mp3'],
      allTempPaths: ['/tmp/vera-test-input.mp4', '/tmp/vera-test-compressed.mp3'],
    })
  })

  it('returns 400 when no file is provided', async () => {
    const request = createRequest()
    const response = await POST(request)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('No file')
  })

  it('returns 415 when file type is unsupported', async () => {
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' })

    const request = createRequest(file)
    const response = await POST(request)
    expect(response.status).toBe(415)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })

    const file = new File(['audio content'], 'test.mp3', {
      type: 'audio/mpeg',
    })
    const request = createRequest(file)
    const response = await POST(request)
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('returns transcript on successful transcription', async () => {
    const file = new File(['audio content'], 'presentation.mp4', {
      type: 'video/mp4',
    })

    const request = createRequest(file)
    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.transcript).toBe('This is the transcribed text.')
  })

  it('returns 500 on OpenAI API failure', async () => {
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('API error'))

    const file = new File(['audio content'], 'test.mp4', {
      type: 'video/mp4',
    })

    const request = createRequest(file)
    const response = await POST(request)
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toContain('Failed to transcribe')
  })

  it('cleans up temp files even on error', async () => {
    const { cleanupTempFiles } = await import('@/lib/audio')
    mockTranscriptionCreate.mockRejectedValueOnce(new Error('API error'))

    const file = new File(['audio content'], 'test.mp4', {
      type: 'video/mp4',
    })

    const request = createRequest(file)
    await POST(request)

    expect(cleanupTempFiles).toHaveBeenCalled()
  })
})
