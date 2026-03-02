import { describe, it, expect } from 'vitest'
import { buildRealtimeInstructions, BASE_IDENTITY, CORE_RULES } from '@/backend/system-prompt'

describe('buildRealtimeInstructions', () => {
  it('includes BASE_IDENTITY', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).toContain(BASE_IDENTITY)
  })

  it('includes CORE_RULES', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).toContain(CORE_RULES)
  })

  it('includes realtime-specific rules', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).toContain('1-3 sentences')
    expect(instructions).toContain('No markdown')
    expect(instructions).toContain('React immediately')
  })

  it('includes Live Practice mode label', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).toContain('CURRENT MODE: Live Practice')
  })

  it('includes setup context when provided', () => {
    const instructions = buildRealtimeInstructions({
      setupContext: {
        topic: 'Series A pitch',
        audience: 'VC investors',
        goal: 'secure funding',
      },
    })
    expect(instructions).toContain('Topic: Series A pitch')
    expect(instructions).toContain('Audience: VC investors')
    expect(instructions).toContain('Goal: secure funding')
  })

  it('includes research context when provided', () => {
    const instructions = buildRealtimeInstructions({
      researchContext: 'VCs care about TAM and team.',
    })
    expect(instructions).toContain('AUDIENCE RESEARCH BRIEFING')
    expect(instructions).toContain('VCs care about TAM and team.')
  })

  it('works with no context at all', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).toContain(BASE_IDENTITY)
    expect(instructions).toContain('Live Practice')
    expect(instructions).not.toContain('SETUP CONTEXT')
    expect(instructions).not.toContain('AUDIENCE RESEARCH')
  })

  it('does not include markdown formatting instructions', () => {
    const instructions = buildRealtimeInstructions({})
    expect(instructions).not.toContain('## Overall Impression')
    expect(instructions).not.toContain('Use this exact structure with markdown headers')
  })

  it('includes persona artifacts for matching audiences', () => {
    const instructions = buildRealtimeInstructions({
      setupContext: { audience: 'venture capital investors' },
    })
    // VC persona should be detected
    expect(instructions).toContain('PERSONA ARTIFACTS')
  })
})
