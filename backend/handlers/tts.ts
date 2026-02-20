import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // "Sarah" — natural, warm female voice

interface AlignmentChunk {
  audio_base64?: string
  alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
  normalized_alignment?: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
}

export interface TTSSentence {
  text: string
  start: number
  end: number
}

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

  // Use the with-timestamps endpoint for forced alignment
  const response = await fetch(`${ELEVENLABS_API_URL}/${DEFAULT_VOICE_ID}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
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

  // Parse NDJSON response — each line is a JSON chunk with audio + alignment
  const responseText = await response.text()
  const lines = responseText.split('\n').filter(l => l.trim())

  let audioBase64 = ''
  const allChars: string[] = []
  const allStarts: number[] = []
  const allEnds: number[] = []

  for (const line of lines) {
    try {
      const chunk: AlignmentChunk = JSON.parse(line)
      if (chunk.audio_base64) audioBase64 += chunk.audio_base64
      const align = chunk.alignment ?? chunk.normalized_alignment
      if (align) {
        allChars.push(...align.characters)
        allStarts.push(...align.character_start_times_seconds)
        allEnds.push(...align.character_end_times_seconds)
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!audioBase64) {
    return NextResponse.json({ error: 'No audio in ElevenLabs response' }, { status: 500 })
  }

  // Build sentences from character-level timestamps
  const sentences: TTSSentence[] = []
  let sentStart = 0
  let sentChars: string[] = []

  for (let i = 0; i < allChars.length; i++) {
    sentChars.push(allChars[i])
    const c = allChars[i]
    // Sentence boundary: .!? followed by space or end of text
    if ('.!?'.includes(c) && (i === allChars.length - 1 || /\s/.test(allChars[i + 1] ?? ''))) {
      const text = sentChars.join('').trim()
      if (text.length > 0) {
        sentences.push({
          text,
          start: allStarts[sentStart],
          end: allEnds[i],
        })
      }
      // Skip whitespace after punctuation
      let next = i + 1
      while (next < allChars.length && /\s/.test(allChars[next])) next++
      sentStart = next
      sentChars = []
      i = next - 1 // loop will i++
    }
  }

  // Handle trailing text without sentence-ending punctuation
  if (sentChars.length > 0) {
    const text = sentChars.join('').trim()
    if (text.length > 0) {
      sentences.push({
        text,
        start: allStarts[sentStart],
        end: allEnds[allChars.length - 1],
      })
    }
  }

  return NextResponse.json({ audio: audioBase64, sentences })
}
