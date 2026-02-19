"use client"

import type { SlideFeedback } from "@/backend/slides"

const RATING_DOT: Record<SlideFeedback["rating"], string> = {
  strong: "bg-emerald-500",
  "needs-work": "bg-amber-500",
  critical: "bg-red-500",
}

interface SlideNavigatorProps {
  feedbacks: SlideFeedback[]
  totalSlides: number
  activeSlide: number | null
  onSlideSelect: (slideNumber: number) => void
}

export function SlideNavigator({
  feedbacks,
  totalSlides,
  activeSlide,
  onSlideSelect,
}: SlideNavigatorProps) {
  // Build a map of slideNumber → feedback for quick lookup
  const feedbackMap = new Map(feedbacks.map((f) => [f.slideNumber, f]))

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-b border-border/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {feedbacks.length} of {totalSlides || "?"} slides analyzed
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
          {Array.from({ length: totalSlides || feedbacks.length }, (_, i) => {
            const slideNumber = i + 1
            const feedback = feedbackMap.get(slideNumber)
            const isActive = activeSlide === slideNumber
            const isPending = !feedback

            return (
              <button
                key={slideNumber}
                type="button"
                onClick={() => {
                  if (!isPending) {
                    onSlideSelect(slideNumber)
                  }
                }}
                disabled={isPending}
                className={`group relative flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : isPending
                    ? "border-border/40 opacity-40"
                    : "border-border/60 hover:border-primary/20 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Slide {slideNumber}
                  </span>
                  {feedback && (
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${RATING_DOT[feedback.rating]}`}
                    />
                  )}
                </div>
                {feedback ? (
                  <p className="line-clamp-2 text-xs text-foreground/70">
                    {feedback.title}
                  </p>
                ) : (
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
