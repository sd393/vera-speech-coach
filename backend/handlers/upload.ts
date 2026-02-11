import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { checkRateLimit, getClientIp } from '@/backend/rate-limit'

export async function handleUploadRoute(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 10, 60_000).allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before uploading again.' },
      { status: 429 }
    )
  }

  try {
    const body = (await request.json()) as HandleUploadBody
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => {
        return {
          allowedContentTypes: ['audio/*', 'video/*'],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
        }
      },
      onUploadCompleted: async () => {
        // No action needed — transcribe handler will process and delete the blob
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Upload token error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload token.' },
      { status: 500 }
    )
  }
}
