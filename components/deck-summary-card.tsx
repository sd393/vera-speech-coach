"use client"

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts"
import type { DeckFeedback } from "@/backend/slides"

interface DeckSummaryCardProps {
  summary: DeckFeedback
}

function ratingColor(score: number): string {
  if (score >= 75) return "hsl(142 71% 45%)" // green
  if (score >= 50) return "hsl(36 56% 48%)"  // amber/primary
  return "hsl(0 84% 60%)"                    // red
}

export function DeckSummaryCard({ summary }: DeckSummaryCardProps) {
  const score = Math.max(0, Math.min(100, summary.overallRating))
  const chartData = [{ value: score }]
  const color = ratingColor(score)

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      {/* Title + score */}
      <div className="flex items-start gap-4 px-5 pt-5">
        <div className="relative flex-shrink-0">
          <RadialBarChart
            width={88}
            height={88}
            innerRadius="62%"
            outerRadius="100%"
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              dataKey="value"
              cornerRadius={6}
              background={{ fill: "hsl(var(--muted))" }}
              fill={color}
            />
          </RadialBarChart>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tabular-nums" style={{ color }}>
              {score}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-primary">
            Deck Review
          </p>
          <h2 className="mt-0.5 text-base font-bold text-foreground">
            {summary.deckTitle}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Audience assumed: {summary.audienceAssumed}
          </p>
        </div>
      </div>

      {/* Executive summary */}
      <p className="px-5 pb-4 pt-3 text-sm leading-relaxed text-foreground/80">
        {summary.executiveSummary}
      </p>

      {/* Top priorities */}
      {summary.topPriorities.length > 0 && (
        <div className="border-t border-border/60 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top priorities
          </p>
          <ol className="space-y-2">
            {summary.topPriorities.map((priority, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                {priority}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
