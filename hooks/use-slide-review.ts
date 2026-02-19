"use client"

import { useState, useCallback, useRef } from 'react'
import { upload } from '@vercel/blob/client'
import { validateSlideFile } from '@/backend/validation'
import type { SlideFeedback, DeckFeedback } from '@/backend/slides'

export type { SlideFeedback, DeckFeedback }

export type AnalysisStep =
  | 'idle'
  | 'uploading'
  | 'downloading'
  | 'rendering'
  | 'analyzing'
  | 'done'
  | 'error'

export interface AnalysisProgress {
  step: AnalysisStep
  slidesCompleted: number
  slidesTotal: number
}

export interface UseSlideReviewReturn {
  slideFeedbacks: SlideFeedback[]
  deckSummary: DeckFeedback | null
  progress: AnalysisProgress
  error: string | null
  panelOpen: boolean
  thumbnails: Record<number, string>
  uploadAndAnalyze: (file: File, audienceContext?: string) => Promise<void>
  reanalyze: (audienceContext: string) => Promise<void>
  openPanel: () => void
  closePanel: () => void
  reset: () => void
}

const INITIAL_PROGRESS: AnalysisProgress = {
  step: 'idle',
  slidesCompleted: 0,
  slidesTotal: 0,
}

export function useSlideReview(authToken?: string | null): UseSlideReviewReturn {
  const [slideFeedbacks, setSlideFeedbacks] = useState<SlideFeedback[]>([])
  const [deckSummary, setDeckSummary] = useState<DeckFeedback | null>(null)
  const [progress, setProgress] = useState<AnalysisProgress>(INITIAL_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})

  // Store blob URL so reanalyze can skip re-uploading
  const storedBlobUrlRef = useRef<string | null>(null)
  const storedFileNameRef = useRef<string | null>(null)

  const openPanel = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])

  const reset = useCallback(() => {
    setSlideFeedbacks([])
    setDeckSummary(null)
    setProgress(INITIAL_PROGRESS)
    setError(null)
    setThumbnails({})
    storedBlobUrlRef.current = null
    storedFileNameRef.current = null
    setPanelOpen(false)
  }, [])

  const runAnalysis = useCallback(
    async (blobUrl: string, fileName: string, audienceContext?: string) => {
      setSlideFeedbacks([])
      setDeckSummary(null)
      setError(null)
      setProgress({ step: 'downloading', slidesCompleted: 0, slidesTotal: 0 })

      const response = await fetch('/api/slides/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ blobUrl, fileName, audienceContext }),
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(
          json.error ?? `Server error ${response.status}`
        )
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream available')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()

          if (payload === '[DONE]') {
            setProgress((p) => ({ ...p, step: 'done' }))
            continue
          }

          let event: { type: string; data: unknown }
          try {
            event = JSON.parse(payload)
          } catch {
            continue
          }

          if (event.type === 'status') {
            const d = event.data as {
              step: string
              total?: number
              completed?: number
            }
            setProgress({
              step: d.step as AnalysisStep,
              slidesTotal: d.total ?? 0,
              slidesCompleted: d.completed ?? 0,
            })
          } else if (event.type === 'slide_feedback') {
            const feedback = event.data as SlideFeedback
            setSlideFeedbacks((prev) => [...prev, feedback])
            setProgress((p) => ({
              ...p,
              slidesCompleted: p.slidesCompleted + 1,
            }))
          } else if (event.type === 'deck_summary') {
            setDeckSummary(event.data as DeckFeedback)
          } else if (event.type === 'error') {
            const d = event.data as { message: string }
            throw new Error(d.message)
          }
        }
      }
    },
    [authToken]
  )

  const uploadAndAnalyze = useCallback(
    async (file: File, audienceContext?: string) => {
      const validation = validateSlideFile({
        name: file.name,
        type: file.type,
        size: file.size,
      })
      if (!validation.valid) {
        setError(validation.error)
        return
      }

      // Clear previous results and open the panel before starting
      setSlideFeedbacks([])
      setDeckSummary(null)
      setError(null)
      storedBlobUrlRef.current = null
      storedFileNameRef.current = null
      setPanelOpen(true)

      try {
        setProgress({ step: 'uploading', slidesCompleted: 0, slidesTotal: 0 })

        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        })

        storedBlobUrlRef.current = blob.url
        storedFileNameRef.current = file.name

        // Render thumbnails client-side in the background (non-blocking)
        import('@/lib/pdf-thumbnails').then(({ renderPdfThumbnails }) =>
          renderPdfThumbnails(blob.url)
        ).then((t) => setThumbnails(t)).catch(() => {})

        await runAnalysis(blob.url, file.name, audienceContext)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(message)
        setProgress((p) => ({ ...p, step: 'error' }))
      }
    },
    [runAnalysis]
  )

  const reanalyze = useCallback(
    async (audienceContext: string) => {
      const blobUrl = storedBlobUrlRef.current
      const fileName = storedFileNameRef.current
      if (!blobUrl || !fileName) {
        setError('No slide deck loaded. Please upload a file first.')
        return
      }

      try {
        await runAnalysis(blobUrl, fileName, audienceContext)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(message)
        setProgress((p) => ({ ...p, step: 'error' }))
      }
    },
    [runAnalysis]
  )

  return {
    slideFeedbacks,
    deckSummary,
    progress,
    error,
    panelOpen,
    thumbnails,
    uploadAndAnalyze,
    reanalyze,
    openPanel,
    closePanel,
    reset,
  }
}
