import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}))

const { mockExtractText } = vi.hoisted(() => {
  const mockExtractText = vi.fn()
  return { mockExtractText }
})

vi.mock('unpdf', () => ({
  extractText: mockExtractText,
}))

import fs from 'fs/promises'
import { extractSlideTexts, slidesTempPath, MAX_SLIDES } from '@/backend/slides'

describe('slidesTempPath', () => {
  it('returns a path ending with the given extension', () => {
    const p = slidesTempPath('.pdf')
    expect(p).toMatch(/\.pdf$/)
  })

  it('returns unique paths on each call', () => {
    const p1 = slidesTempPath('.pdf')
    const p2 = slidesTempPath('.pdf')
    expect(p1).not.toBe(p2)
  })
})

describe('extractSlideTexts', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('fake-pdf-bytes'))

    mockExtractText.mockResolvedValue({
      totalPages: 3,
      text: [
        'Heading 1  Content for slide 1',
        'Heading 2  Content for slide 2',
        'Heading 3  Content for slide 3',
      ],
    })
  })

  it('returns text for each page', async () => {
    const slides = await extractSlideTexts('/tmp/test.pdf')
    expect(slides).toHaveLength(3)
    expect(slides[0].slideNumber).toBe(1)
    expect(slides[0].text).toContain('Heading 1')
    expect(slides[2].slideNumber).toBe(3)
  })

  it('calls extractText with mergePages: false', async () => {
    await extractSlideTexts('/tmp/test.pdf')
    expect(mockExtractText).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      { mergePages: false }
    )
  })

  it('fills blank slides with placeholder text', async () => {
    mockExtractText.mockResolvedValue({ totalPages: 1, text: [''] })

    const slides = await extractSlideTexts('/tmp/blank.pdf')
    expect(slides[0].text).toContain('No text')
  })

  it('trims whitespace-only text and uses placeholder', async () => {
    mockExtractText.mockResolvedValue({ totalPages: 1, text: ['   \n  \t  '] })

    const slides = await extractSlideTexts('/tmp/blank.pdf')
    expect(slides[0].text).toContain('No text')
  })

  it('caps at MAX_SLIDES pages', async () => {
    const pages = Array.from({ length: MAX_SLIDES + 5 }, (_, i) => `slide text ${i + 1}`)
    mockExtractText.mockResolvedValue({ totalPages: MAX_SLIDES + 5, text: pages })

    const slides = await extractSlideTexts('/tmp/big.pdf')
    expect(slides).toHaveLength(MAX_SLIDES)
  })

  it('propagates errors from extractText', async () => {
    mockExtractText.mockRejectedValue(new Error('parse error'))

    await expect(extractSlideTexts('/tmp/bad.pdf')).rejects.toThrow('parse error')
  })
})
