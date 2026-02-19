"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  X,
} from "lucide-react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"
import { FadeIn } from "@/components/motion"
import { useSlideReview, type AnalysisStep } from "@/hooks/use-slide-review"
import { SlideNavigator } from "@/components/slide-navigator"
import { SlideFeedbackCard } from "@/components/slide-feedback-card"
import { DeckSummaryCard } from "@/components/deck-summary-card"

const STEP_LABELS: Record<AnalysisStep, string> = {
  idle: "Ready",
  uploading: "Uploading to secure storage...",
  downloading: "Downloading for processing...",
  rendering: "Extracting slide content...",
  analyzing: "Analyzing slides...",
  summarizing: "Writing summary...",
  done: "Analysis complete",
  error: "Error",
}

interface SlideReviewInterfaceProps {
  authToken?: string | null
}

export function SlideReviewInterface({ authToken }: SlideReviewInterfaceProps) {
  const router = useRouter()
  const {
    slideFeedbacks,
    deckSummary,
    progress,
    error,
    uploadAndAnalyze,
    reanalyze,
    reset,
  } = useSlideReview(authToken)

  const [dragOver, setDragOver] = useState(false)
  const [audienceContext, setAudienceContext] = useState("")
  const [refineInput, setRefineInput] = useState("")
  const [activeSlide, setActiveSlide] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const feedbackScrollRef = useRef<HTMLDivElement>(null)

  const isProcessing =
    progress.step !== "idle" &&
    progress.step !== "done" &&
    progress.step !== "error"

  const hasResults = deckSummary !== null || slideFeedbacks.length > 0
  const isDone = progress.step === "done"

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  // Scroll to newly completed slide in the feed
  useEffect(() => {
    if (slideFeedbacks.length > 0 && feedbackScrollRef.current) {
      feedbackScrollRef.current.scrollTop =
        feedbackScrollRef.current.scrollHeight
    }
  }, [slideFeedbacks.length])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      uploadAndAnalyze(file, audienceContext || undefined)
    },
    [uploadAndAnalyze, audienceContext]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  function handleSlideSelect(slideNumber: number) {
    setActiveSlide(slideNumber)
    const el = document.getElementById(`slide-${slideNumber}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleRefine(e: React.FormEvent) {
    e.preventDefault()
    if (!refineInput.trim() || isProcessing) return
    reanalyze(refineInput.trim())
  }

  // ── Phase 1: Upload ──────────────────────────────────────────────────────
  if (progress.step === "idle" && !hasResults) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.06] blur-3xl">
            <div
              className="h-full w-full rounded-full"
              style={{
                background:
                  "radial-gradient(circle, hsl(36 56% 48% / 0.6), transparent 70%)",
              }}
            />
          </div>
        </div>

        <FadeIn delay={0}>
          <div className="w-full max-w-lg text-center">
            <p className="font-display mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              Vera
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Slide Deck Review
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Upload your PDF and Vera will analyze each slide, then give you
              an actionable breakdown.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-8 w-full max-w-lg space-y-4">
            {/* Drag-drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Drop your PDF here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF files up to 50MB
                </p>
              </div>
            </div>

            {/* Audience context */}
            <div>
              <label
                htmlFor="audience-context"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Who are you presenting to?{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="audience-context"
                type="text"
                value={audienceContext}
                onChange={(e) => setAudienceContext(e.target.value)}
                placeholder="e.g. Series A investors, technical hiring panel, enterprise sales prospects..."
                className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>
          </div>
        </FadeIn>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          aria-label="Upload PDF"
        />
      </div>
    )
  }

  // ── Phase 2: Processing ───────────────────────────────────────────────────
  if (isProcessing && !hasResults) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-semibold text-foreground">
              {STEP_LABELS[progress.step]}
            </p>
            {progress.step === "analyzing" && progress.slidesTotal > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Slide {progress.slidesCompleted} of {progress.slidesTotal}
              </p>
            )}
          </div>

          {/* Progress steps */}
          <ol className="space-y-3">
            {(
              [
                { key: "uploading", label: "Upload to secure storage" },
                { key: "rendering", label: "Extract slide content" },
                { key: "analyzing", label: "Vera reads each slide" },
                { key: "summarizing", label: "Write deck summary" },
              ] as const
            ).map(({ key, label }) => {
              const steps: AnalysisStep[] = [
                "uploading",
                "downloading",
                "rendering",
                "analyzing",
                "summarizing",
              ]
              const currentIdx = steps.indexOf(progress.step)
              const stepIdx = steps.indexOf(key)
              const isDoneStep = currentIdx > stepIdx
              const isActiveStep = currentIdx === stepIdx

              return (
                <li key={key} className="flex items-center gap-3">
                  {isDoneStep ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : isActiveStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-border" />
                  )}
                  <span
                    className={`text-sm ${
                      isDoneStep
                        ? "text-foreground/60 line-through"
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
      </div>
    )
  }

  // ── Phase 2.5: Processing with partial results streaming in ──────────────
  // ── Phase 3: Results (or partial results while still processing) ─────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Results header bar */}
      <div className="flex-shrink-0 border-b border-border/60 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                reset()
                router.push("/chat?mode=slides")
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Upload a new deck"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-sm font-semibold text-foreground">
              {isProcessing ? "Analyzing..." : "Deck Review"}
            </span>
            {isProcessing && progress.slidesTotal > 0 && (
              <span className="text-xs text-muted-foreground">
                ({progress.slidesCompleted}/{progress.slidesTotal} slides)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDone && (
              <button
                type="button"
                onClick={() => {
                  reset()
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                <Upload className="h-3.5 w-3.5" />
                New deck
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex min-h-0 flex-1">
        {/* Mobile: stacked layout */}
        <div className="flex w-full flex-col md:hidden">
          {/* Horizontal thumbnail strip */}
          <div className="flex-shrink-0 overflow-x-auto border-b border-border/60 bg-card">
            <div className="flex gap-2 p-3">
              {(progress.slidesTotal > 0
                ? Array.from({ length: progress.slidesTotal }, (_, i) => i + 1)
                : slideFeedbacks.map((f) => f.slideNumber)
              ).map((num) => {
                const feedback = slideFeedbacks.find(
                  (f) => f.slideNumber === num
                )
                const dotClass = feedback
                  ? {
                      strong: "bg-emerald-500",
                      "needs-work": "bg-amber-500",
                      critical: "bg-red-500",
                    }[feedback.rating]
                  : ""
                return (
                  <button
                    key={num}
                    type="button"
                    disabled={!feedback}
                    onClick={() => handleSlideSelect(num)}
                    className={`flex h-14 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 ${
                      activeSlide === num
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/20"
                    }`}
                  >
                    {num}
                    {feedback && (
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${dotClass}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Feed */}
          <div ref={feedbackScrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <SlideReviewFeed
              slideFeedbacks={slideFeedbacks}
              deckSummary={deckSummary}
              activeSlide={activeSlide}
              isProcessing={isProcessing}
              onRefine={isDone ? handleRefine : undefined}
              refineInput={refineInput}
              onRefineInputChange={setRefineInput}
            />
          </div>
        </div>

        {/* Desktop: resizable panels */}
        <PanelGroup direction="horizontal" className="hidden md:flex">
          <Panel
            defaultSize={35}
            minSize={25}
            maxSize={50}
            className="overflow-hidden"
          >
            <SlideNavigator
              feedbacks={slideFeedbacks}
              totalSlides={progress.slidesTotal || slideFeedbacks.length}
              activeSlide={activeSlide}
              onSlideSelect={handleSlideSelect}
            />
          </Panel>

          <PanelResizeHandle className="w-px bg-border/60 transition-colors hover:bg-primary/30 data-[resize-handle-active]:bg-primary/40" />

          <Panel defaultSize={65} minSize={50} className="overflow-hidden">
            <div
              ref={feedbackScrollRef}
              className="h-full overflow-y-auto px-6 py-6"
            >
              <SlideReviewFeed
                slideFeedbacks={slideFeedbacks}
                deckSummary={deckSummary}
                activeSlide={activeSlide}
                isProcessing={isProcessing}
                onRefine={isDone ? handleRefine : undefined}
                refineInput={refineInput}
                onRefineInputChange={setRefineInput}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}

// ── Internal feed component ───────────────────────────────────────────────

interface SlideReviewFeedProps {
  slideFeedbacks: ReturnType<typeof useSlideReview>["slideFeedbacks"]
  deckSummary: ReturnType<typeof useSlideReview>["deckSummary"]
  activeSlide: number | null
  isProcessing: boolean
  onRefine?: (e: React.FormEvent) => void
  refineInput: string
  onRefineInputChange: (v: string) => void
}

function SlideReviewFeed({
  slideFeedbacks,
  deckSummary,
  activeSlide,
  isProcessing,
  onRefine,
  refineInput,
  onRefineInputChange,
}: SlideReviewFeedProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Deck summary at top (when ready) */}
      {deckSummary && <DeckSummaryCard summary={deckSummary} />}

      {/* Per-slide cards */}
      {slideFeedbacks.map((feedback) => (
        <SlideFeedbackCard
          key={feedback.slideNumber}
          feedback={feedback}
          isHighlighted={activeSlide === feedback.slideNumber}
        />
      ))}

      {/* Analyzing spinner */}
      {isProcessing && (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Vera is reviewing...
          </span>
        </div>
      )}

      {/* Audience refinement */}
      {onRefine && (
        <form
          onSubmit={onRefine}
          className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-3"
        >
          <RefreshCw className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={refineInput}
            onChange={(e) => onRefineInputChange(e.target.value)}
            placeholder="Re-analyze for a specific audience (e.g. enterprise CTOs)..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!refineInput.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Re-analyze
          </button>
        </form>
      )}
    </div>
  )
}
