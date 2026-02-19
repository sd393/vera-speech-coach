"use client"

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderError = 'not_allowed' | 'not_found' | 'no_media_support' | 'unknown'

export interface UseRecorderReturn {
  isRecording: boolean
  elapsed: number
  analyserNode: AnalyserNode | null
  startRecording: () => Promise<RecorderError | null>
  stopRecording: () => Promise<File | null>
  cancelRecording: () => void
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const resolveRef = useRef<((file: File | null) => void) | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    setAnalyserNode(null)
    setIsRecording(false)
    setElapsed(0)
    chunksRef.current = []
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startRecording = useCallback(async (): Promise<RecorderError | null> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'no_media_support'

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.75
      source.connect(analyser)
      setAnalyserNode(analyser)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType.includes('webm') ? 'webm' : 'ogg'
        const file = new File([blob], `live-presentation.${ext}`, { type: mimeType })
        resolveRef.current?.(file)
        resolveRef.current = null
        cleanup()
      }

      mr.start()
      setIsRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      return null
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') return 'not_allowed'
        if (err.name === 'NotFoundError') return 'not_found'
      }
      return 'unknown'
    }
  }, [cleanup])

  const stopRecording = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null)
        return
      }
      resolveRef.current = resolve
      mediaRecorderRef.current.stop()
    })
  }, [isRecording])

  const cancelRecording = useCallback(() => {
    resolveRef.current = null
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    cleanup()
  }, [cleanup])

  return { isRecording, elapsed, analyserNode, startRecording, stopRecording, cancelRecording }
}
