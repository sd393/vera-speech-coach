"use client"

import { useRef, useEffect, useState } from "react"
import {
  X,
  Loader2,
  CheckCircle2,
  RefreshCw,
  FileText,
  AlertCircle,
  UploadCloud,
} from "lucide-react"
import { DeckSummaryCard } from "@/components/deck-summary-card"
import { SlideFeedbackCard } from "@/components/slide-feedback-card"
import type { UseSlideReviewReturn, AnalysisStep } from "@/hooks/use-slide-review"

const STEP_LABELS: Record<AnalysisStep, string> = {
  idle: "Ready",
  uploading: "Uploading...",
  downloading: "Processing...",
  rendering: "Extracting slides...",
  analyzing: "Analyzing slides...",
  done: "Done",
  error: "Error",
}

const STEP_ORDER: AnalysisStep[] = [
  "uploading",
  "downloading",
  "rendering",
  "analyzing",
]

const PROGRESS_STEPS = [
  { key: "uploading" as const, label: "Upload to secure storage" },
  { key: "rendering" as const, label: "Extract slide content" },
  { key: "analyzing" as const, label: "Vera analyzes the full deck" },
]

interface SlidePanelProps {
  slideReview: UseSlideReviewReturn
  onClose: () => void
  onReset: () => void
}

export function SlidePanel({ slideReview, onClose, onReset }: SlidePanelProps) {
  const { slideFeedbacks, deckSummary, progress, thumbnails } = slideReview
  const [refineInput, setRefineInput] = useState("")
  const feedRef = useRef<HTMLDivElement>(null)

  const isProcessing =
    progress.step !== "idle" &&
    progress.step !== "done" &&
    progress.step !== "error"
  const hasResults = deckSummary !== null || slideFeedbacks.length > 0
  const isDone = progress.step === "done"

  // Scroll feed to bottom as new cards arrive
  useEffect(() => {
    if (feedRef.current && slideFeedbacks.length > 0) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [slideFeedbacks.length])

  function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    if (!refineInput.trim() || isProcessing) return
    slideReview.reanalyze(refineInput.trim())
    setRefineInput("")
  }

  const currentStepIdx = STEP_ORDER.indexOf(progress.step)

  return (
    <div className="flex h-full flex-col bg-background/50">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="truncate text-sm font-semibold text-foreground">
            {deckSummary?.deckTitle ?? "Slide Review"}
          </span>
          {isProcessing && (
            <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress.step === "analyzing" && progress.slidesTotal > 0
                ? `${progress.slidesCompleted} / ${progress.slidesTotal} slides`
                : STEP_LABELS[progress.step]}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close slide panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* Progress timeline — shown before any results arrive */}
        {isProcessing && !hasResults && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="mb-5 h-8 w-8 animate-spin text-primary" />
            <p className="mb-6 text-sm font-medium text-foreground">
              {STEP_LABELS[progress.step]}
              {progress.step === "analyzing" && progress.slidesTotal > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({progress.slidesCompleted}/{progress.slidesTotal})
                </span>
              )}
            </p>
            <ol className="w-full max-w-xs space-y-3">
              {PROGRESS_STEPS.map(({ key, label }) => {
                const stepIdx = STEP_ORDER.indexOf(key)
                const isDoneStep = currentStepIdx > stepIdx
                const isActiveStep = currentStepIdx === stepIdx
                return (
                  <li key={key} className="flex items-center gap-3">
                    {isDoneStep ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    ) : isActiveStep ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-border" />
                    )}
                    <span
                      className={`text-sm ${
                        isDoneStep
                          ? "text-foreground/50 line-through"
                          : isActiveStep
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Error state */}
        {progress.step === "error" && !hasResults && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="mb-4 h-8 w-8 text-destructive/70" />
            <p className="mb-1 text-sm font-medium text-foreground">
              Analysis failed
            </p>
            <p className="mb-6 max-w-xs text-xs text-muted-foreground">
              {slideReview.error ?? "Something went wrong. Please try again."}
            </p>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload a different file
            </button>
          </div>
        )}

        {/* Results feed — populated incrementally */}
        {hasResults && (
          <div className="space-y-4">
            {deckSummary && <DeckSummaryCard summary={deckSummary} />}
            {slideFeedbacks.map((f) => (
              <SlideFeedbackCard
                key={f.slideNumber}
                feedback={f}
                thumbnail={thumbnails[f.slideNumber]}
              />
            ))}
            {progress.step === "error" && (
              <div className="flex items-center gap-2 py-1 text-xs text-destructive/80">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {slideReview.error ?? "Analysis failed"}
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                {STEP_LABELS[progress.step]}
                {progress.step === "analyzing" && progress.slidesTotal > 0
                  ? ` (${progress.slidesCompleted}/${progress.slidesTotal})`
                  : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audience refinement footer */}
      {isDone && (
        <div className="flex-shrink-0 border-t border-border/60 px-4 py-3">
          <form onSubmit={handleRefine} className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              placeholder="Re-analyze for a different audience..."
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!refineInput.trim()}
              className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Re-analyze
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
