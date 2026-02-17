import { openai } from '@/backend/openai'

const RESEARCH_PROMPT = `You are a research assistant preparing a briefing for a presentation coach.
The coach needs to understand a specific audience in order to give useful feedback on a presentation.

Search the web using the provided search terms, then synthesize your findings into a concise AUDIENCE BRIEFING. The briefing should include:

1. **Audience Profile**: Who they are, what they care about, their decision-making criteria
2. **Domain Context**: Key industry trends, terminology, or recent developments they'd know about
3. **Communication Expectations**: How this audience prefers to receive information (data-heavy? story-driven? concise? detailed?)
4. **Likely Concerns**: What objections, questions, or pushback this audience would have about this topic
5. **Success Criteria**: What would make them consider this presentation successful

Keep the briefing under 800 words. Be specific and grounded in what you find.
Cite specific facts, statistics, or trends where possible.
Do NOT make up information. If search results are thin for a topic, say so.`

export async function conductResearch(
  searchTerms: string[],
  audienceSummary: string
): Promise<string> {
  const client = openai()

  const response = await client.responses.create({
    model: 'gpt-4o-mini',
    tools: [{ type: 'web_search', search_context_size: 'medium' }],
    input: [
      { role: 'system', content: RESEARCH_PROMPT },
      {
        role: 'user',
        content: `AUDIENCE: ${audienceSummary}\n\nSEARCH TERMS TO INVESTIGATE:\n${searchTerms.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nPlease search the web using these terms, then compile your findings into the audience briefing format described above.`,
      },
    ],
  })

  const text = response.output_text
  if (!text) {
    throw new Error('No text output from research')
  }

  return text
}
