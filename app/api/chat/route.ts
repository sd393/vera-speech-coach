import { NextRequest } from 'next/server'
import { openai } from '@/lib/openai'
import { chatRequestSchema, sanitizeInput } from '@/lib/validation'
import { buildSystemPrompt } from '@/lib/system-prompt'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 10, 60_000).allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await request.json()

    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { messages, transcript } = parsed.data

    const systemPrompt = buildSystemPrompt(transcript)

    const openaiMessages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }> = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: sanitizeInput(m.content),
      })),
    ]

    const client = openai()
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('Stream error:', err)
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to generate response. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
