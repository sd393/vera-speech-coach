import OpenAI from "openai"
import { NextRequest } from "next/server"

const openai = new OpenAI()

const VALID_EMOTIONS = new Set([
  "neutral", "interested", "skeptical", "confused",
  "amused", "impressed", "concerned", "bored",
])

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
- Each thought has an emotion tag from this set: neutral, interested, skeptical, confused, amused, impressed, concerned, bored
- Return a JSON object: {"labels": [{"text": "...", "emotion": "..."}, ...]}

Good examples:
{"labels": [{"text": "not sure that number is right", "emotion": "skeptical"}, {"text": "okay this part is actually interesting", "emotion": "interested"}, {"text": "wonder if they've tested this with real users", "emotion": "confused"}]}
{"labels": [{"text": "heard this argument before somewhere", "emotion": "bored"}, {"text": "the second point was clearer than the first", "emotion": "interested"}, {"text": "i'd want to see the data on that", "emotion": "skeptical"}]}

Bad examples (too dramatic, too generic, too third-person):
{"labels": [{"text": "A room of seasoned investors leaning forward", "emotion": "impressed"}, {"text": "The tension is palpable as the speaker continues", "emotion": "concerned"}, {"text": "Wondering if this will change everything", "emotion": "impressed"}]}`,
      },
      ...messages,
    ],
    max_tokens: 200,
    temperature: 0.8,
    response_format: { type: "json_object" },
  })

  try {
    const raw = completion.choices[0]?.message?.content ?? "{}"
    const parsed = JSON.parse(raw)
    // Accept either { labels: [...] } or a bare array as the first array value found
    const rawLabels: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.labels)
      ? parsed.labels
      : (Object.values(parsed).find(v => Array.isArray(v)) as unknown[] | undefined) ?? []

    // Normalize: accept both {text, emotion} objects and plain strings (backwards compat)
    const labels = rawLabels
      .slice(0, 3)
      .map((item) => {
        if (typeof item === "string") {
          return { text: item, emotion: "neutral" as const }
        }
        if (item && typeof item === "object" && "text" in item) {
          const obj = item as { text: unknown; emotion?: unknown }
          const text = typeof obj.text === "string" ? obj.text : ""
          const emotion = typeof obj.emotion === "string" && VALID_EMOTIONS.has(obj.emotion)
            ? obj.emotion
            : "neutral"
          return { text, emotion }
        }
        return null
      })
      .filter((item): item is { text: string; emotion: string } => item !== null && item.text.length > 0)

    return Response.json({ labels })
  } catch {
    return Response.json({ labels: [] })
  }
}
