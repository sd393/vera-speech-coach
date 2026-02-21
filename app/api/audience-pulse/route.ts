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
        content: `You are the audience watching this presentation. Based on the conversation, write exactly 3 short captions that together paint a picture of who is in the room and what's happening.

Each caption should cover a different angle:
1. Who the audience is — their role, background, or type of person
2. What they're doing or observing right now — body language, attention, comparison
3. What's going through their mind — a question, doubt, hope, or silent reaction

Rules:
- Each caption is one complete thought, 8–14 words
- Present tense, specific, human — not generic or abstract
- No trailing punctuation
- Return a JSON object with a "labels" key containing an array of 3 strings

Example output:
{"labels": ["A room of Series A investors who've seen a hundred pitches this month", "Leaning in slightly — the market size number caught their attention", "Quietly wondering if the team has actually talked to customers yet"]}`,
      },
      ...messages,
    ],
    max_tokens: 120,
    temperature: 0.9,
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
