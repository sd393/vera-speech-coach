import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}))

// Use vi.hoisted so mock functions are available inside the vi.mock factory
const { mockGetText, mockDestroy, MockPDFParse } = vi.hoisted(() => {
  const mockGetText = vi.fn()
  const mockDestroy = vi.fn()

  function MockPDFParse(this: Record<string, unknown>, _options: unknown) {
    this.getText = mockGetText
    this.destroy = mockDestroy
  }

  return { mockGetText, mockDestroy, MockPDFParse }
})

vi.mock('pdf-parse', () => ({
  PDFParse: MockPDFParse,
}))

import fs from 'fs/promises'
import { extractSlideTexts, slidesTempPath, MAX_SLIDES } from '@/backend/slides'

function makeTextResult(pages: Array<{ num: number; text: string }>) {
  return {
    pages,
    total: pages.length,
    text: pages.map((p) => p.text).join('\n'),
  }
}

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
    mockDestroy.mockResolvedValue(undefined)

    mockGetText.mockResolvedValue(
      makeTextResult([
        { num: 1, text: `Heading 1  Content for slide 1` },
        { num: 2, text: `Heading 2  Content for slide 2` },
        { num: 3, text: `Heading 3  Content for slide 3` },
      ])
    )
  })

  it('returns text for each page', async () => {
    const slides = await extractSlideTexts('/tmp/test.pdf')
    expect(slides).toHaveLength(3)
    expect(slides[0].slideNumber).toBe(1)
    expect(slides[0].text).toContain('Heading 1')
    expect(slides[2].slideNumber).toBe(3)
  })

  it('passes first: MAX_SLIDES to getText', async () => {
    await extractSlideTexts('/tmp/test.pdf')
    expect(mockGetText).toHaveBeenCalledWith({ first: MAX_SLIDES })
  })

  it('fills blank slides with placeholder text', async () => {
    mockGetText.mockResolvedValue(makeTextResult([{ num: 1, text: '' }]))

    const slides = await extractSlideTexts('/tmp/blank.pdf')
    expect(slides[0].text).toContain('No text')
  })

  it('trims whitespace-only text and uses placeholder', async () => {
    mockGetText.mockResolvedValue(
      makeTextResult([{ num: 1, text: '   \n  \t  ' }])
    )

    const slides = await extractSlideTexts('/tmp/blank.pdf')
    expect(slides[0].text).toContain('No text')
  })

  it('caps at MAX_SLIDES pages', async () => {
    const pages = Array.from({ length: MAX_SLIDES }, (_, i) => ({
      num: i + 1,
      text: `slide text ${i + 1}`,
    }))
    mockGetText.mockResolvedValue(makeTextResult(pages))

    const slides = await extractSlideTexts('/tmp/big.pdf')
    expect(slides).toHaveLength(MAX_SLIDES)
  })

  it('destroys the parser after extraction', async () => {
    await extractSlideTexts('/tmp/test.pdf')
    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it('destroys the parser even when getText throws', async () => {
    mockGetText.mockRejectedValue(new Error('parse error'))

    await expect(extractSlideTexts('/tmp/bad.pdf')).rejects.toThrow('parse error')
    expect(mockDestroy).toHaveBeenCalledOnce()
  })
})
