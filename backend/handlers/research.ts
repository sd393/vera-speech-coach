import { NextRequest } from 'next/server'
import { researchRequestSchema, sanitizeInput } from '@/backend/validation'
import { checkRateLimit, getClientIp } from '@/backend/rate-limit'
import { generateSearchTerms } from '@/backend/research/search-terms'
import { conductResearch } from '@/backend/research/web-research'

export async function handleResearch(request: NextRequest) {
  const ip = getClientIp(request)

  // Tight rate limit — research is expensive (web search + multiple model calls)
  if (!checkRateLimit(ip, 3, 300_000).allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many research requests. Please wait.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await request.json()
    const parsed = researchRequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { transcript, audienceDescription } = parsed.data

    // Stage 1: Generate search terms
    console.log('[research] Stage 1: generating search terms...')
    const { searchTerms, audienceSummary } = await generateSearchTerms(
      sanitizeInput(transcript),
      sanitizeInput(audienceDescription)
    )
    console.log('[research] Stage 1 complete:', { audienceSummary, searchTerms })

    // Stage 2: Conduct web research
    console.log('[research] Stage 2: conducting web research...')
    const researchContext = await conductResearch(searchTerms, audienceSummary)
    console.log(
      '[research] Stage 2 complete:',
      researchContext.slice(0, 200) + '...'
    )

    return new Response(
      JSON.stringify({ researchContext, audienceSummary, searchTerms }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Research pipeline error:', error)
    return new Response(
      JSON.stringify({
        error: 'Research failed. Coaching will proceed without enrichment.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
