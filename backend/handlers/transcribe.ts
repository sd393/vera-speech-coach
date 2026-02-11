import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { del } from '@vercel/blob'
import { openai } from '@/backend/openai'
import { transcribeRequestSchema } from '@/backend/validation'
import { checkRateLimit, getClientIp } from '@/backend/rate-limit'
import { downloadToTmp, processFileForWhisper, cleanupTempFiles } from '@/backend/audio'

export async function handleTranscribe(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 5, 60_000).allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before uploading again.' },
      { status: 429 }
    )
  }

  let tempPaths: string[] = []
  let blobUrl: string | undefined

  try {
    const body = await request.json()
    const parsed = transcribeRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Provide blobUrl and fileName.' },
        { status: 400 }
      )
    }

    blobUrl = parsed.data.blobUrl
    const { fileName } = parsed.data

    // Download from blob storage to a temp file
    const inputPath = await downloadToTmp(blobUrl, fileName)

    // Process file: extract audio, compress, split if needed
    const { chunkPaths, allTempPaths } = await processFileForWhisper(inputPath)
    tempPaths = allTempPaths

    // Transcribe chunks in parallel (capped at 3 concurrent requests)
    const client = openai()
    const MAX_CONCURRENCY = 3

    async function transcribeWithConcurrencyLimit(
      paths: string[],
      limit: number
    ): Promise<string[]> {
      const results: string[] = new Array(paths.length)
      let nextIndex = 0

      async function worker() {
        while (nextIndex < paths.length) {
          const i = nextIndex++
          const fileStream = fs.createReadStream(paths[i])
          const transcription = await client.audio.transcriptions.create({
            model: 'gpt-4o-mini-transcribe',
            file: fileStream,
          })
          results[i] = transcription.text
        }
      }

      const workers = Array.from(
        { length: Math.min(limit, paths.length) },
        () => worker()
      )
      await Promise.all(workers)
      return results
    }

    const transcriptParts = await transcribeWithConcurrencyLimit(
      chunkPaths,
      MAX_CONCURRENCY
    )
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
    // Delete the blob from Vercel Blob storage
    if (blobUrl) {
      await del(blobUrl).catch(() => {
        // Best-effort cleanup — blob TTL will handle it if this fails
      })
    }
  }
}
