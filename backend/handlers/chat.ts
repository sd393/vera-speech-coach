import { NextRequest } from 'next/server'
import { openai } from '@/backend/openai'
import { chatRequestSchema, sanitizeInput } from '@/backend/validation'
import { buildSystemPrompt } from '@/backend/system-prompt'
import { checkRateLimit, getClientIp } from '@/backend/rate-limit'
import {
  checkTrialLimit,
  incrementTrialUsage,
} from '@/backend/trial-limit'

export async function handleChat(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 10, 60_000).allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const isTrialUser = !request.headers.get('authorization')

  if (isTrialUser) {
    const trial = checkTrialLimit(ip)
    if (!trial.allowed) {
      return new Response(
        JSON.stringify({
          error: 'You\'ve used all your free messages. Sign up to continue.',
          code: 'trial_limit_reached',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
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

    const { messages, transcript, researchContext, slideContext } = parsed.data

    const systemPrompt = buildSystemPrompt(transcript, researchContext, slideContext)

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

    if (isTrialUser) {
      incrementTrialUsage(ip)
    }

    const trialRemaining = isTrialUser
      ? checkTrialLimit(ip).remaining
      : undefined

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
          if (trialRemaining !== undefined) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ trial_remaining: trialRemaining })}\n\n`
              )
            )
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('Stream error:', err)
          controller.error(err)
        }
      },
    })

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }

    if (trialRemaining !== undefined) {
      headers['X-Trial-Remaining'] = String(trialRemaining)
    }

    return new Response(readable, { headers })
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
