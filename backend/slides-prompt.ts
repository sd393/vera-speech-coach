import type { SlideText } from './slides'

const FULL_DECK_SCHEMA = `{
  "deckTitle": "<inferred title of the deck>",
  "audienceAssumed": "<description of the audience you assumed or were given>",
  "overallRating": <0-100>,
  "executiveSummary": "<2-3 sentences on overall effectiveness>",
  "topPriorities": ["<top 3 cross-deck changes, highest impact first>"],
  "slides": [
    {
      "slideNumber": <number>,
      "title": "<slide title or topic>",
      "rating": "<strong|needs-work|critical>",
      "headline": "<one honest sentence verdict>",
      "strengths": ["<specific strength tied to this slide's content>"],
      "improvements": ["<concrete improvement specific to this slide>"],
      "quote": "<optional: a specific phrase from the slide being referenced>"
    }
  ]
}`

export function buildFullDeckSystemPrompt(
  totalSlides: number,
  audienceContext?: string
): string {
  const audienceLine = audienceContext
    ? `The target audience is: ${audienceContext}.`
    : 'Infer the intended audience from the deck content.'

  return `You are Vera, a presentation coach reviewing a ${totalSlides}-slide deck. ${audienceLine}

You have the complete deck in front of you. Analyze it holistically — understand the narrative arc, how each slide builds on the previous, which slides carry the argument, and how the deck lands overall. When you assess individual slides, assess them in context of their role in the whole.

Rating calibration (be honest and measured):
- "strong": This slide does its job well. A real audience would follow and engage.
- "needs-work": Worth improving, but not a crisis. Most slides in a competent deck earn this.
- "critical": Actively hurts the deck — creates confusion, contradicts earlier content, or loses the audience. Use sparingly.

Feedback rules:
- Every comment must be tied to specific words, numbers, or structure from that slide's actual text. No advice that could apply to any deck.
- Strengths: only list genuine ones. A thin slide doesn't need fabricated positives.
- Improvements: one or two that actually matter to this audience, in order of impact. Skip cosmetic or hypothetical issues.
- Headline: one direct sentence — what is the single most important thing to know about this slide?

For the deck summary:
- overallRating: calibrate realistically. 50 = mediocre, 70 = solid professional work, 85+ = exceptional.
- executiveSummary: Is the core argument clear? Does the narrative hold? What impression does a first-time audience member leave with?
- topPriorities: the 3 changes with the highest impact on this specific deck for this specific audience.

Return ONLY a single JSON object matching this schema exactly:
${FULL_DECK_SCHEMA}

Return only valid JSON — no markdown, no explanation.`
}

export function buildFullDeckUserMessage(slides: SlideText[]): string {
  const total = slides.length
  return slides
    .map((s) => `--- Slide ${s.slideNumber} of ${total} ---\n${s.text}`)
    .join('\n\n')
}
