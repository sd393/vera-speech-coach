import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/backend/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { POST } from '@/app/api/blob/delete/route'
import { NextRequest } from 'next/server'
import { checkRateLimit } from '@/backend/rate-limit'
import { del } from '@vercel/blob'

function createRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/blob/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

describe('POST /api/blob/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true })
    vi.mocked(del).mockResolvedValue(undefined)
  })

  it('returns 400 when body is invalid', async () => {
    const response = await POST(createRequest({}))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid request')
  })

  it('returns 400 when urls is empty', async () => {
    const response = await POST(createRequest({ urls: [] }))
    expect(response.status).toBe(400)
  })

  it('returns 400 when urls contains invalid URLs', async () => {
    const response = await POST(createRequest({ urls: ['not-a-url'] }))
    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false })

    const response = await POST(
      createRequest({ urls: ['https://example.vercel-storage.com/test.pdf'] })
    )
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toContain('Too many requests')
  })

  it('returns 200 and calls del on success', async () => {
    const urls = [
      'https://example.vercel-storage.com/a.pdf',
      'https://example.vercel-storage.com/b.pdf',
    ]

    const response = await POST(createRequest({ urls }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.deleted).toBe(true)
    expect(del).toHaveBeenCalledWith(urls)
  })

  it('returns 200 even if del() throws', async () => {
    vi.mocked(del).mockRejectedValueOnce(new Error('Blob not found'))

    const response = await POST(
      createRequest({ urls: ['https://example.vercel-storage.com/gone.pdf'] })
    )
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.deleted).toBe(true)
  })
})
