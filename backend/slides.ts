import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { PDFParse } from 'pdf-parse'

export interface SlideText {
  slideNumber: number
  text: string
}

export interface SlideFeedback {
  slideNumber: number
  title: string
  rating: 'strong' | 'needs-work' | 'critical'
  headline: string
  strengths: string[]
  improvements: string[]
  quote?: string
}

export interface DeckFeedback {
  deckTitle: string
  audienceAssumed: string
  overallRating: number
  executiveSummary: string
  slides: SlideFeedback[]
  topPriorities: string[]
}

export const MAX_SLIDES = 30

export function slidesTempPath(ext: string): string {
  const id = crypto.randomBytes(8).toString('hex')
  return path.join(os.tmpdir(), `vera-slides-${id}${ext}`)
}

/**
 * Extract text content from each page of a PDF.
 * Uses pdf-parse which handles Node.js worker setup internally.
 * Caps at MAX_SLIDES pages.
 */
export async function extractSlideTexts(pdfPath: string): Promise<SlideText[]> {
  const pdfBuffer = await fs.readFile(pdfPath)
  const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })
  try {
    const result = await parser.getText({ first: MAX_SLIDES })
    return result.pages.map((page) => ({
      slideNumber: page.num,
      text: page.text.trim() || '[No text content on this slide]',
    }))
  } finally {
    await parser.destroy()
  }
}
