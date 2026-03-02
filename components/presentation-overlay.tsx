"use client"

import React, { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { AnimatePresence, motion } from "framer-motion"
import { X, FileText, Loader2, Presentation, Square, PhoneOff, Play } from "lucide-react"
import { toast } from "sonner"
import { AudienceFace } from "@/components/audience-face"

const AudioWaveform = dynamic(() => import("@/components/audio-waveform").then(m => ({ default: m.AudioWaveform })), { ssr: false })
const PresentationSlideViewer = dynamic(() => import("@/components/presentation-slide-viewer").then(m => ({ default: m.PresentationSlideViewer })))
import { validateSlideFile } from "@/backend/validation"
import { formatElapsed } from "@/lib/format-utils"
import type { FaceState, FaceEmotion } from "@/components/audience-face"
import type { AnalysisProgress } from "@/hooks/use-slide-review"
import type { RealtimeConnectionState, RealtimeVoiceState } from "@/hooks/use-realtime-session"

interface PresentationOverlayProps {
  faceState: FaceState
  currentEmotion: FaceEmotion
  audienceLabel: string | null
  thinkingLabel: string
  isTTSSpeaking: boolean
  ttsCaption: string
  isBusy: boolean
  transcript: string | null
  stage: string
  recorder: {
    isRecording: boolean
    analyserNode: AnalyserNode | null
    elapsed: number
    cancelRecording: () => void
  }
  slideReview: {
    thumbnails: Record<number, string>
    progress: AnalysisProgress
  }
  onStartRecording: () => void
  onStopRecording: () => void
  onFinish: () => void
  onSlideUpload: (file: File) => void
  // Realtime mode props
  realtimeMode?: boolean
  realtimeConnectionState?: RealtimeConnectionState
  realtimeVoiceState?: RealtimeVoiceState
  realtimeCaption?: string
  realtimeElapsed?: number
  realtimeAnalyserNode?: AnalyserNode | null
  onRealtimeStart?: () => void
  onRealtimeDisconnect?: () => void
}

export const PresentationOverlay = React.memo(function PresentationOverlay({
  faceState,
  currentEmotion,
  audienceLabel,
  thinkingLabel,
  isTTSSpeaking,
  ttsCaption,
  isBusy,
  transcript,
  stage,
  recorder,
  slideReview,
  onStartRecording,
  onStopRecording,
  onFinish,
  onSlideUpload,
  realtimeMode,
  realtimeConnectionState,
  realtimeVoiceState,
  realtimeCaption,
  realtimeElapsed,
  realtimeAnalyserNode,
  onRealtimeStart,
  onRealtimeDisconnect,
}: PresentationOverlayProps) {
  const [presentationSlideIndex, setPresentationSlideIndex] = useState(1)
  const [mobileSlideOverlay, setMobileSlideOverlay] = useState(false)
  const continueRef = useRef<HTMLButtonElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  /* ── Enter key to start recording (segment mode only) ── */
  useEffect(() => {
    if (realtimeMode) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") handleRecord()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }) // Re-attaches each render to capture latest props

  function handleRecord() {
    if (isBusy || recorder.isRecording) return
    if (continueRef.current) continueRef.current.style.visibility = "hidden"
    onStartRecording()
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (pdfInputRef.current) pdfInputRef.current.value = ""

    const validation = validateSlideFile({ name: file.name, type: file.type, size: file.size })
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    onSlideUpload(file)
  }

  /* ── Render ── */
  const hasPresentationSlides = Object.keys(slideReview.thumbnails).length > 0
  const faceSize = hasPresentationSlides ? 220 : 280

  const faceColumn = (
    <div className="flex flex-1 flex-col items-center justify-center">
      {/* Face — use realtime analyser when Vera is speaking in realtime mode */}
      <AudienceFace
        state={faceState}
        analyserNode={realtimeMode && realtimeVoiceState === 'vera-speaking' ? (realtimeAnalyserNode ?? null) : recorder.analyserNode}
        size={faceSize}
        emotion={currentEmotion}
      />

      {/* Caption area */}
      <div className="mt-4 flex h-12 items-center justify-center px-3 sm:px-6">
        <AnimatePresence mode="wait">
          {realtimeMode && realtimeConnectionState === 'connecting' ? (
            <motion.span
              key="rt-connecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-muted-foreground/70"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting to Vera...
            </motion.span>
          ) : realtimeMode && realtimeCaption ? (
            <motion.p
              key={realtimeCaption.slice(-40)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg text-center text-sm leading-relaxed text-muted-foreground"
            >
              {realtimeCaption}
            </motion.p>
          ) : realtimeMode && faceState === 'satisfied' && audienceLabel ? (
            <motion.span
              key={audienceLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-[300px] text-center text-xs leading-snug text-muted-foreground/50"
            >
              {audienceLabel}
            </motion.span>
          ) : realtimeMode && realtimeVoiceState === 'listening' ? (
            <motion.span
              key="rt-listening"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground/70"
            >
              Listening...
            </motion.span>
          ) : realtimeMode && realtimeVoiceState === 'processing' ? (
            <motion.span
              key="rt-thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="animate-pulse text-xs text-muted-foreground/70"
            >
              Thinking...
            </motion.span>
          ) : realtimeMode && realtimeConnectionState === 'idle' ? (
            <motion.span
              key="rt-idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs text-muted-foreground/50"
            >
              Ready when you are
            </motion.span>
          ) : realtimeMode && realtimeVoiceState === 'idle' && realtimeConnectionState === 'connected' ? (
            <motion.span
              key="rt-ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-xs text-muted-foreground/50"
            >
              Go ahead, start speaking
            </motion.span>
          ) : isTTSSpeaking && ttsCaption ? (
            <motion.p
              key={ttsCaption}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg text-center text-sm leading-relaxed text-muted-foreground"
            >
              {ttsCaption}
            </motion.p>
          ) : faceState === "thinking" ? (
            <motion.span
              key="thinking-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="animate-pulse text-xs text-muted-foreground/70"
            >
              {thinkingLabel}
            </motion.span>
          ) : audienceLabel ? (
            <motion.span
              key={audienceLabel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-[300px] text-center text-xs leading-snug text-muted-foreground/50"
            >
              {audienceLabel}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Record controls (segment mode) */}
      {!realtimeMode && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {/* Mobile slides button */}
          {hasPresentationSlides && (
            <button
              type="button"
              onClick={() => setMobileSlideOverlay(true)}
              className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors md:hidden"
            >
              <Presentation className="h-3 w-3" />
              Slides
            </button>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {(faceState === "idle" || faceState === "satisfied") && !isBusy && (
              <>
                {/* "Add slides" button or loading indicator — hidden once user has recorded without slides */}
                {!hasPresentationSlides && !transcript && (
                  slideReview.progress.step !== 'idle' && slideReview.progress.step !== 'done' && slideReview.progress.step !== 'error' ? (
                    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading slides...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Add slides
                    </button>
                  )
                )}
                <button
                  ref={continueRef}
                  type="button"
                  onClick={handleRecord}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Continue
                </button>
                {transcript && stage === 'present' && (
                  <button
                    type="button"
                    onClick={onFinish}
                    className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    I&apos;m done
                  </button>
                )}
              </>
            )}

            {recorder.isRecording && (
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
                </div>
                <div className="w-28 sm:w-40">
                  <AudioWaveform analyser={recorder.analyserNode} />
                </div>
                <span className="flex-shrink-0 font-mono text-xs sm:text-sm tabular-nums text-muted-foreground">
                  {formatElapsed(recorder.elapsed)}
                </span>
                <button
                  type="button"
                  onClick={recorder.cancelRecording}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Cancel recording"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onStopRecording}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                  aria-label="Stop recording and send"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Realtime mode controls */}
      {realtimeMode && realtimeConnectionState === 'idle' && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onRealtimeStart}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-5 py-2.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </button>
        </div>
      )}
      {realtimeMode && (realtimeConnectionState === 'connected' || realtimeConnectionState === 'connecting') && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <div className="relative flex-shrink-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
              </div>
              Live
            </div>
            {/* Elapsed time */}
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatElapsed(realtimeElapsed ?? 0)}
            </span>
          </div>

          {/* End Practice button */}
          <button
            type="button"
            onClick={onRealtimeDisconnect}
            className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition-all hover:bg-red-500/10 hover:border-red-500/30 active:scale-[0.98]"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            End Practice
          </button>
        </div>
      )}
    </div>
  )

  return (
    <motion.div
      key="presentation-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {hasPresentationSlides ? (
        <div className="flex h-full w-full">
          {/* Left: face + captions + controls */}
          <div className="flex flex-1 flex-col md:w-[55%]">
            {faceColumn}
          </div>
          {/* Right: slide viewer — hidden on mobile, animates in */}
          <motion.div
            className="hidden md:flex w-[45%] border-l border-border/60"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "45%", opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <PresentationSlideViewer
              thumbnails={slideReview.thumbnails}
              currentSlide={presentationSlideIndex}
              onSlideChange={setPresentationSlideIndex}
              progress={slideReview.progress}
            />
          </motion.div>

          {/* Mobile slide overlay */}
          <AnimatePresence>
            {mobileSlideOverlay && (
              <motion.div
                key="mobile-slide-overlay"
                className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              >
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">Slides</span>
                  <button
                    type="button"
                    onClick={() => setMobileSlideOverlay(false)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Close slides"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1">
                  <PresentationSlideViewer
                    thumbnails={slideReview.thumbnails}
                    currentSlide={presentationSlideIndex}
                    onSlideChange={setPresentationSlideIndex}
                    progress={slideReview.progress}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : faceColumn}

      {/* Hidden PDF input */}
      <input ref={pdfInputRef} type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={handlePdfChange} className="hidden" aria-label="Add slides to presentation" />
    </motion.div>
  )
})
