"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { SlideFeedback } from "@/backend/slides"

const RATING_STYLES = {
  strong: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    dot: "bg-emerald-500",
    label: "Strong",
  },
  "needs-work": {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    dot: "bg-amber-500",
    label: "Needs Work",
  },
  critical: {
    badge: "bg-red-500/10 text-red-600 border-red-500/20",
    dot: "bg-red-500",
    label: "Critical",
  },
} as const

interface SlideFeedbackCardProps {
  feedback: SlideFeedback
  isHighlighted?: boolean
  thumbnail?: string
}

export function SlideFeedbackCard({
  feedback,
  isHighlighted,
  thumbnail,
}: SlideFeedbackCardProps) {
  const [strengthsOpen, setStrengthsOpen] = useState(false)
  const [improvementsOpen, setImprovementsOpen] = useState(true)

  const style = RATING_STYLES[feedback.rating]

  return (
    <div
      id={`slide-${feedback.slideNumber}`}
      className={`rounded-xl border bg-card overflow-hidden transition-shadow ${
        isHighlighted
          ? "border-primary/40 shadow-md shadow-primary/5"
          : "border-border/60"
      }`}
    >
      {thumbnail && (
        <div className="border-b border-border/60 bg-muted/20">
          <img
            src={thumbnail}
            alt={`Slide ${feedback.slideNumber}`}
            className="w-full object-contain"
            loading="lazy"
          />
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
          {feedback.slideNumber}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {feedback.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{feedback.headline}</p>
        </div>
      </div>

      {/* Quote callout */}
      {feedback.quote && (
        <div className="mx-5 mb-3 rounded-lg border-l-2 border-primary/40 bg-primary/5 px-4 py-2">
          <p className="text-xs italic text-foreground/70">
            &ldquo;{feedback.quote}&rdquo;
          </p>
        </div>
      )}

      {/* Collapsible sections */}
      <div className="border-t border-border/60">
        {/* Strengths */}
        <button
          type="button"
          onClick={() => setStrengthsOpen(!strengthsOpen)}
          className="flex w-full items-center gap-2 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-emerald-600 transition-colors hover:bg-emerald-500/5"
        >
          {strengthsOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Strengths
        </button>
        {strengthsOpen && (
          <ul className="px-5 pb-3">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 py-1 text-sm text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                {s}
              </li>
            ))}
          </ul>
        )}

        {/* Improvements */}
        <button
          type="button"
          onClick={() => setImprovementsOpen(!improvementsOpen)}
          className="flex w-full items-center gap-2 border-t border-border/60 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-amber-600 transition-colors hover:bg-amber-500/5"
        >
          {improvementsOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Improvements
        </button>
        {improvementsOpen && (
          <ul className="px-5 pb-4">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 py-1 text-sm text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
