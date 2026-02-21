import OpenAI from "openai"
import { NextRequest } from "next/server"

const openai = new OpenAI()

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are the audience — the person being presented to. Based on this conversation, write exactly 3 short inner thoughts. These are the quiet things going through your head as you listen. Not dramatic, not performative — just honest.

Think of it like the text that would float above someone's head in a movie. Mundane, real, specific to what was actually said.

Rules:
- Each thought is 5–10 words, lowercase, no trailing punctuation
- First person — you are thinking these, not describing someone else
- Grounded in the actual content of the presentation, not generic
- One should be about something specific that was said
- One should be a genuine question or doubt you have
- One should be an honest feeling — interest, skepticism, confusion, agreement, whatever fits
- Return a JSON object: {"labels": ["...", "...", "..."]}

Good examples:
{"labels": ["not sure that number is right", "okay this part is actually interesting", "wonder if they've tested this with real users"]}
{"labels": ["heard this argument before somewhere", "the second point was clearer than the first", "i'd want to see the data on that"]}

Bad examples (too dramatic, too generic, too third-person):
{"labels": ["A room of seasoned investors leaning forward", "The tension is palpable as the speaker continues", "Wondering if this will change everything"]}`,
      },
      ...messages,
    ],
    max_tokens: 150,
    temperature: 0.8,
    response_format: { type: "json_object" },
  })

  try {
    const raw = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw)
    // Accept either { labels: [...] } or a bare array as the first array value found
    const raw_labels: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.labels)
      ? parsed.labels
      : (Object.values(parsed).find(v => Array.isArray(v)) as unknown[] | undefined) ?? []
    // Guard: only keep string items (prevents message objects leaking in)
    const labels = raw_labels.filter((item): item is string => typeof item === "string")
    return Response.json({ labels: labels.slice(0, 3) })
  } catch {
    return Response.json({ labels: [] })
  }
}
