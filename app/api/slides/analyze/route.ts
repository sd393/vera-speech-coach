import { handleSlidesAnalyze } from '@/backend/handlers/slides'
import type { NextRequest } from 'next/server'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  return handleSlidesAnalyze(request)
}
