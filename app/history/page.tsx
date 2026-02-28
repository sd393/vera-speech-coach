"use client"

import { useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Trash2, ArrowLeft, Presentation } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useSessionHistory } from "@/hooks/use-session-history"
import type { SessionSummary } from "@/lib/sessions"

/* ── Score badge ── */

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-primary/10 text-primary" :
    score >= 45 ? "bg-amber-500/10 text-amber-500" :
    "bg-muted text-muted-foreground"
  return (
    <span className={`ml-auto flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {Math.round(score)}
    </span>
  )
}

/* ── Session card ── */

function SessionCard({ session, onDelete }: { session: SessionSummary; onDelete: (id: string) => void }) {
  return (
    <Link
      href={`/feedback/${session.id}`}
      className="group relative flex items-start gap-4 rounded-xl border border-border/50 bg-card/60 p-5 transition-all hover:border-primary/20 hover:bg-primary/[0.03] active:scale-[0.99]"
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/8">
        <Presentation className="h-4 w-4 text-primary/60" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-semibold leading-snug text-foreground group-hover:text-foreground/90">
            {session.topic}
          </p>
          {session.overallScore !== null && <ScoreBadge score={session.overallScore} />}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {session.audience && (
            <span className="max-w-[10rem] truncate rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {session.audience}
            </span>
          )}
          {session.goal && (
            <span className="max-w-[10rem] truncate rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {session.goal}
            </span>
          )}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground/60">
          {session.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(session.id) }}
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        aria-label="Delete presentation"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Link>
  )
}

/* ── Skeletons ── */

function Skeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/40 bg-card/40 p-5">
          <div className="flex gap-4">
            <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
              <div className="flex gap-1.5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Page ── */

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const isSigningOut = useRef(false)

  const getAuthToken = useCallback(async () => {
    if (!user) throw new Error("Not authenticated")
    return user.getIdToken()
  }, [user])

  const { sessions, loading, error, removeSession } = useSessionHistory({
    userId: user?.uid ?? null,
    getAuthToken,
  })

  useEffect(() => {
    if (!authLoading && !user && !isSigningOut.current) {
      router.replace("/login")
    }
  }, [authLoading, user, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  async function handleDelete(sessionId: string) {
    try {
      await removeSession(sessionId)
    } catch {
      toast.error("Failed to delete presentation")
    }
  }

  return (
    <div className="relative min-h-screen px-6 py-24">
      {/* Warm glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-background" aria-hidden="true">
        <div
          className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(36 72% 50%), transparent 70%)" }}
        />
        <div
          className="absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(34 50% 68%), transparent 70%)" }}
        />
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-10">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="mt-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">History</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your past presentations and feedback</p>
            </div>
            <Link
              href="/chat"
              className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-primary/10 hover:border-primary/40"
            >
              New presentation
            </Link>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <Skeletons />
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Presentation className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-base font-medium text-muted-foreground">No presentations yet</p>
            <p className="mt-1 text-sm text-muted-foreground/60">Complete a session to see your history here.</p>
            <Link
              href="/chat"
              className="mt-6 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-primary/10"
            >
              Start your first presentation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-10 flex gap-4 text-sm text-muted-foreground">
          <Link href="/chat" className="transition-colors hover:text-foreground">New presentation</Link>
          <Link href="/account" className="transition-colors hover:text-foreground">Account</Link>
        </div>
      </div>
    </div>
  )
}
