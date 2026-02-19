import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { blobDeleteRequestSchema } from '@/backend/validation'
import { checkRateLimit, getClientIp } from '@/backend/rate-limit'

export async function handleBlobDelete(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(ip, 10, 60_000).allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = blobDeleteRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request. Provide an array of blob URLs.' },
      { status: 400 }
    )
  }

  // Best-effort deletion — don't fail the request if blob deletion fails
  await del(parsed.data.urls).catch(() => {})

  return NextResponse.json({ deleted: true })
}
