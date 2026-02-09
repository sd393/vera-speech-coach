import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { openai } from '@/lib/openai'
import { validateFile, MAX_FILE_SIZE } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { processFileForWhisper, cleanupTempFiles } from '@/lib/audio'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 5, 60_000).allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before uploading again.' },
      { status: 429 }
    )
  }

  let tempPaths: string[] = []

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Server-side validation
    const validation = validateFile({
      name: file.name,
      type: file.type,
      size: file.size,
    })

    if (!validation.valid) {
      const status = file.size > MAX_FILE_SIZE ? 413 : 415
      return NextResponse.json(
        { error: validation.error },
        { status }
      )
    }

    // Process file: extract audio, compress, split if needed
    const { chunkPaths, allTempPaths } = await processFileForWhisper(file)
    tempPaths = allTempPaths

    // Transcribe each chunk
    const client = openai()
    const transcriptParts: string[] = []

    for (const chunkPath of chunkPaths) {
      const fileStream = fs.createReadStream(chunkPath)
      const transcription = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file: fileStream,
        response_format: 'text',
      })
      transcriptParts.push(transcription as unknown as string)
    }

    const transcript = transcriptParts.join(' ')

    return NextResponse.json({ transcript })
  } catch (error: unknown) {
    console.error('Transcription error:', error)

    return NextResponse.json(
      { error: 'Failed to transcribe file. Please try again.' },
      { status: 500 }
    )
  } finally {
    // Always clean up temp files
    if (tempPaths.length > 0) {
      await cleanupTempFiles(tempPaths)
    }
  }
}
