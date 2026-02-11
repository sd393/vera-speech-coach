const CLIENT_EXTRACTION_THRESHOLD = 50 * 1024 * 1024 // 50MB

/**
 * Check whether client-side audio extraction should be attempted.
 */
export function shouldExtractClientSide(file: File): boolean {
  return file.size > CLIENT_EXTRACTION_THRESHOLD && file.type.startsWith('video/')
}

/**
 * Extract and compress audio from a video file using ffmpeg.wasm (single-threaded).
 * Returns a compressed MP3 File, or null if extraction fails.
 *
 * The WASM module is lazy-loaded to avoid impacting initial page load.
 * Uses the single-threaded core — no COOP/COEP headers required.
 */
export async function extractAudioClientSide(file: File): Promise<File | null> {
  try {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const ffmpeg = new FFmpeg()

    await ffmpeg.load()

    const inputName = 'input' + getExtension(file.name)
    const outputName = 'output.mp3'

    const arrayBuffer = await file.arrayBuffer()
    await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer))

    await ffmpeg.exec([
      '-i', inputName,
      '-vn',                  // strip video
      '-ac', '1',             // mono
      '-ar', '16000',         // 16kHz sample rate
      '-b:a', '64k',          // 64kbps bitrate
      '-f', 'mp3',
      outputName,
    ])

    const data = await ffmpeg.readFile(outputName)
    if (!(data instanceof Uint8Array) || data.length === 0) {
      return null
    }

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([data], `${baseName}.mp3`, { type: 'audio/mpeg' })
  } catch {
    // Graceful fallback — caller will upload the original file
    return null
  }
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot) : ''
}
