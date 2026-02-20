import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // "Sarah" — natural, warm female voice

export async function handleTTS(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  let text: string
  try {
    const body = await req.json()
    text = body.text
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  // Strip markdown before sending to ElevenLabs
  const cleaned = text
    .replace(/#{1,6} /g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+] /gm, '')
    .replace(/^\d+\. /gm, '')
    .replace(/---+/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

  if (!cleaned) {
    return NextResponse.json({ error: 'text is empty after cleaning' }, { status: 400 })
  }

  // Use the streaming endpoint for faster first-byte delivery
  const response = await fetch(`${ELEVENLABS_API_URL}/${DEFAULT_VOICE_ID}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: cleaned,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.4,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error')
    console.error('[TTS] ElevenLabs error:', response.status, errorText)
    return NextResponse.json(
      { error: 'TTS generation failed' },
      { status: response.status },
    )
  }

  if (!response.body) {
    return NextResponse.json({ error: 'No response body from ElevenLabs' }, { status: 500 })
  }

  // Pipe the stream through — client gets audio chunks as ElevenLabs generates them
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
