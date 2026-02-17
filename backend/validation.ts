import { z } from 'zod'

export const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

// Audio/video extensions that ffmpeg can process
const MEDIA_EXTENSIONS = [
  '.mp3', '.mp4', '.m4a', '.wav', '.mpeg', '.mpga', '.webm',
  '.ogg', '.flac', '.aac', '.wma', '.mov', '.avi', '.mkv',
  '.m4v', '.opus', '.3gp',
] as const

export function validateFile(
  file: { name: string; type: string; size: number }
): { valid: true } | { valid: false; error: string } {
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 500MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
    }
  }

  // Accept any audio/* or video/* MIME type (ffmpeg can convert most formats)
  const mimeValid =
    file.type.startsWith('audio/') || file.type.startsWith('video/')
  const name = file.name.toLowerCase()
  const extValid = MEDIA_EXTENSIONS.some((ext) => name.endsWith(ext))

  if (!mimeValid && !extValid) {
    return {
      valid: false,
      error: 'Unsupported file type. Please upload an audio or video file.',
    }
  }

  return { valid: true }
}

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(50_000),
})

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(200),
  transcript: z.string().max(100_000).optional(),
  researchContext: z.string().max(20_000).optional(),
})

export const researchRequestSchema = z.object({
  transcript: z.string().min(1).max(100_000),
  audienceDescription: z.string().min(1).max(10_000),
})

export const transcribeRequestSchema = z.object({
  blobUrl: z.string().url(),
  fileName: z.string().min(1).max(255),
})

export function sanitizeInput(text: string): string {
  return text.trim()
}
