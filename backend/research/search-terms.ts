import { openai } from '@/backend/openai'

export interface SearchTermsResult {
  searchTerms: string[]
  audienceSummary: string
}

const SEARCH_TERM_PROMPT = `You are a research assistant for a presentation coaching tool.
Given a presentation transcript excerpt and a description of the target audience, generate 5-7 web search terms that would help understand:

1. What this specific audience cares about and prioritizes
2. Common concerns or objections this audience would have about this topic
3. Industry/domain terminology and expectations
4. Recent trends or developments relevant to this audience and topic
5. Communication styles and formats this audience responds to

Return a JSON object with:
- "searchTerms": array of 5-7 specific, diverse search queries (not generic)
- "audienceSummary": a one-sentence summary of who the audience is

Each search term should be a complete search query, not just keywords.
Make them specific enough to return useful results.
Do NOT include generic terms like "how to give a good presentation".
Focus on the AUDIENCE's domain knowledge and expectations.`

export async function generateSearchTerms(
  transcript: string,
  audienceDescription: string
): Promise<SearchTermsResult> {
  const client = openai()

  // Truncate transcript to keep token costs low — topic is clear from the opening
  const truncatedTranscript = transcript.slice(0, 3000)

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SEARCH_TERM_PROMPT },
      {
        role: 'user',
        content: `PRESENTATION TRANSCRIPT (excerpt):\n"""\n${truncatedTranscript}\n"""\n\nTARGET AUDIENCE DESCRIPTION:\n"""\n${audienceDescription}\n"""`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 500,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('No response from search term generation')

  const parsed = JSON.parse(content) as SearchTermsResult
  if (!Array.isArray(parsed.searchTerms) || parsed.searchTerms.length === 0) {
    throw new Error('Invalid search terms response')
  }

  return parsed
}
