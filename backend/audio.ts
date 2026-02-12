import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import fs from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const WHISPER_MAX_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_CHUNK_DURATION = 1400 // seconds — gpt-4o-mini-transcribe limit is 1500s

function tempPath(ext: string): string {
  const id = crypto.randomBytes(8).toString('hex')
  return path.join(os.tmpdir(), `vera-${id}${ext}`)
}

/**
 * Extract and compress audio from a video or audio file to 64kbps mono mp3.
 * This dramatically reduces file size — a 200MB video typically yields ~10MB of audio.
 */
export function extractAndCompressAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .audioChannels(1)
      .audioFrequency(16000)
      .format('mp3')
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve())
      .save(outputPath)
  })
}

/**
 * Get the duration of an audio file in seconds.
 */
function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(metadata.format.duration ?? 0)
    })
  })
}

/**
 * Split an audio file into chunks that each fit under the Whisper API size limit.
 * Returns an array of file paths (in order). If the file is already small enough,
 * returns a single-element array with the original path.
 */
export async function splitAudioIfNeeded(
  filePath: string,
  maxSizeBytes: number = WHISPER_MAX_SIZE
): Promise<string[]> {
  const stat = statSync(filePath)
  // Estimate duration from file size — the input is always our 64kbps MP3,
  // so duration ≈ fileSize / 8000. This avoids needing ffprobe on Vercel.
  const estimatedDuration = stat.size / 8000

  const sizeChunks = Math.ceil(stat.size / maxSizeBytes)
  const durationChunks = Math.ceil(estimatedDuration / MAX_CHUNK_DURATION)
  const numChunks = Math.max(sizeChunks, durationChunks)

  if (numChunks <= 1) {
    return [filePath]
  }

  const chunkDuration = Math.floor(estimatedDuration / numChunks)

  const chunkPaths: string[] = []

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDuration
    const chunkPath = tempPath(`-chunk${i}.mp3`)
    chunkPaths.push(chunkPath)

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(filePath)
        .setStartTime(startTime)
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('mp3')

      // For all chunks except the last, set duration
      if (i < numChunks - 1) {
        cmd = cmd.setDuration(chunkDuration)
      }

      cmd
        .on('error', (err: Error) => reject(err))
        .on('end', () => resolve())
        .save(chunkPath)
    })
  }

  return chunkPaths
}

/**
 * Write an uploaded File/Blob to a temp path on disk.
 */
export async function writeUploadToTmp(file: File): Promise<string> {
  const ext = path.extname(file.name) || '.bin'
  const tmpFile = tempPath(ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(tmpFile, buffer)
  return tmpFile
}

/**
 * Download a file from a URL to a temp path on disk.
 * Retries on failure to handle CDN propagation delays after Vercel Blob uploads.
 */
export async function downloadToTmp(url: string, fileName: string): Promise<string> {
  const ext = path.extname(fileName) || '.bin'
  const tmpFile = tempPath(ext)

  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 2000

  let lastStatus = 0
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
    const response = await fetch(url)
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(tmpFile, buffer)
      return tmpFile
    }
    lastStatus = response.status
  }

  throw new Error(`Failed to download file: ${lastStatus}`)
}

/**
 * Remove temp files. Silently ignores files that don't exist.
 */
export async function cleanupTempFiles(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((p) =>
      fs.unlink(p).catch(() => {
        // File may already be deleted or never created
      })
    )
  )
}

/**
 * Full pipeline: extract audio from a file already on disk, compress, split if needed.
 * Returns the list of chunk paths ready for Whisper, plus all temp paths for cleanup.
 *
 * @param inputPath - Path to the file already on disk
 */
export async function processFileForWhisper(inputPath: string): Promise<{
  chunkPaths: string[]
  allTempPaths: string[]
}> {
  const compressedPath = tempPath('.mp3')
  const allTempPaths = [inputPath, compressedPath]

  await extractAndCompressAudio(inputPath, compressedPath)

  const chunkPaths = await splitAudioIfNeeded(compressedPath)

  // If chunks were created (different from compressedPath), track them too
  for (const cp of chunkPaths) {
    if (cp !== compressedPath) {
      allTempPaths.push(cp)
    }
  }

  return { chunkPaths, allTempPaths }
}
