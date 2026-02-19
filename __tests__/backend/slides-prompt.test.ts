import { describe, it, expect } from 'vitest'
import {
  buildFullDeckSystemPrompt,
  buildFullDeckUserMessage,
} from '@/backend/slides-prompt'
import type { SlideText } from '@/backend/slides'

describe('buildFullDeckSystemPrompt', () => {
  it('includes Vera persona', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('Vera')
  })

  it('includes the total slide count', () => {
    const prompt = buildFullDeckSystemPrompt(15)
    expect(prompt).toContain('15')
  })

  it('includes JSON schema instructions', () => {
    const prompt = buildFullDeckSystemPrompt(5)
    expect(prompt).toContain('JSON object')
    expect(prompt).toContain('slideNumber')
    expect(prompt).toContain('overallRating')
    expect(prompt).toContain('topPriorities')
  })

  it('includes audience context when provided', () => {
    const prompt = buildFullDeckSystemPrompt(10, 'venture capital investors')
    expect(prompt).toContain('venture capital investors')
  })

  it('instructs to infer audience when no context provided', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('Infer the intended audience')
  })

  it('instructs to return only valid JSON', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt.toLowerCase()).toContain('only valid json')
  })

  it('includes rating calibration guide', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('"strong"')
    expect(prompt).toContain('"needs-work"')
    expect(prompt).toContain('"critical"')
  })

  it('includes executiveSummary in schema', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('executiveSummary')
  })

  it('includes deckTitle in schema', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('deckTitle')
  })

  it('instructs holistic analysis of the full deck', () => {
    const prompt = buildFullDeckSystemPrompt(10)
    expect(prompt).toContain('holistically')
  })
})

describe('buildFullDeckUserMessage', () => {
  const slides: SlideText[] = [
    { slideNumber: 1, text: 'Title slide: Q4 Results' },
    { slideNumber: 2, text: 'Revenue grew 30% YoY' },
    { slideNumber: 3, text: 'Customer acquisition cost down 15%' },
  ]

  it('includes all slide texts', () => {
    const msg = buildFullDeckUserMessage(slides)
    expect(msg).toContain('Title slide: Q4 Results')
    expect(msg).toContain('Revenue grew 30% YoY')
    expect(msg).toContain('Customer acquisition cost down 15%')
  })

  it('includes slide numbers in separator headers', () => {
    const msg = buildFullDeckUserMessage(slides)
    expect(msg).toContain('Slide 1')
    expect(msg).toContain('Slide 2')
    expect(msg).toContain('Slide 3')
  })

  it('includes total slide count in each separator', () => {
    const msg = buildFullDeckUserMessage(slides)
    // Each separator should say "of 3"
    expect(msg).toContain('of 3')
  })

  it('separates slides with delimiters', () => {
    const msg = buildFullDeckUserMessage(slides)
    expect(msg).toContain('---')
  })

  it('handles a single slide', () => {
    const single: SlideText[] = [{ slideNumber: 1, text: 'Only slide' }]
    const msg = buildFullDeckUserMessage(single)
    expect(msg).toContain('Only slide')
    expect(msg).toContain('Slide 1 of 1')
  })

  it('handles an empty slide list', () => {
    const msg = buildFullDeckUserMessage([])
    expect(msg).toBe('')
  })
})
