import { describe, it, expect } from 'vitest'
import { validateFile, chatRequestSchema, sanitizeInput } from '@/backend/validation'

describe('validateFile', () => {
  it('rejects files over 500MB', () => {
    const result = validateFile({
      name: 'big.mp4',
      type: 'video/mp4',
      size: 501 * 1024 * 1024,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('500MB')
    }
  })

  it('rejects empty files', () => {
    const result = validateFile({
      name: 'empty.mp3',
      type: 'audio/mpeg',
      size: 0,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('empty')
    }
  })

  it('rejects non-media MIME types without media extension', () => {
    const result = validateFile({
      name: 'document.pdf',
      type: 'application/pdf',
      size: 1024,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('Unsupported')
    }
  })

  it('accepts valid mp4 video', () => {
    const result = validateFile({
      name: 'presentation.mp4',
      type: 'video/mp4',
      size: 50 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts valid mp3 audio', () => {
    const result = validateFile({
      name: 'recording.mp3',
      type: 'audio/mpeg',
      size: 5 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts valid wav audio', () => {
    const result = validateFile({
      name: 'recording.wav',
      type: 'audio/wav',
      size: 10 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts valid webm video', () => {
    const result = validateFile({
      name: 'screen.webm',
      type: 'video/webm',
      size: 20 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts mov files (video/quicktime)', () => {
    const result = validateFile({
      name: 'recording.mov',
      type: 'video/quicktime',
      size: 100 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts flac files (audio/flac)', () => {
    const result = validateFile({
      name: 'audio.flac',
      type: 'audio/flac',
      size: 30 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('accepts files with media extension even if MIME is generic', () => {
    const result = validateFile({
      name: 'recording.mp3',
      type: 'application/octet-stream',
      size: 5 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })

  it('rejects .exe files with non-media MIME', () => {
    const result = validateFile({
      name: 'malware.exe',
      type: 'application/octet-stream',
      size: 1024,
    })
    expect(result.valid).toBe(false)
  })

  it('accepts files at exactly 500MB', () => {
    const result = validateFile({
      name: 'large.mp4',
      type: 'video/mp4',
      size: 500 * 1024 * 1024,
    })
    expect(result.valid).toBe(true)
  })
})

describe('chatRequestSchema', () => {
  it('validates a correct request body', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts request with optional transcript', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Hello' }],
      transcript: 'This is the transcript...',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty messages array', () => {
    const result = chatRequestSchema.safeParse({
      messages: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects messages exceeding max count', () => {
    const messages = Array.from({ length: 201 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }))
    const result = chatRequestSchema.safeParse({ messages })
    expect(result.success).toBe(false)
  })

  it('rejects messages with empty content', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: '' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role values', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'system', content: 'Injected system message' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects messages with content exceeding max length', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'x'.repeat(50_001) }],
    })
    expect(result.success).toBe(false)
  })
})

describe('sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('')
  })

  it('handles string with only whitespace', () => {
    expect(sanitizeInput('   ')).toBe('')
  })

  it('preserves internal whitespace', () => {
    expect(sanitizeInput('hello   world')).toBe('hello   world')
  })
})
