/**
 * Centralized rate limit configurations.
 *
 * Each config is { limit, windowMs } — passed to `checkRateLimit(identifier, limit, windowMs)`.
 */

export const RATE_LIMITS = {
  /** Chat endpoint — IP-level burst protection */
  chatIp: { limit: 10, windowMs: 60_000 },
  /** Transcription — heavier compute, tighter IP limit */
  transcribe: { limit: 20, windowMs: 60_000 },
  /** File upload — IP-level burst protection */
  upload: { limit: 10, windowMs: 60_000 },
  /** Slide analysis — heavier compute, tighter IP limit */
  slidesAnalyze: { limit: 5, windowMs: 60_000 },
  /** Research pipeline — expensive (web search + multiple model calls) */
  research: { limit: 3, windowMs: 300_000 },
  /** Stripe checkout creation — per user */
  checkout: { limit: 3, windowMs: 60_000 },
  /** Checkout session verification — per user */
  verifyCheckout: { limit: 5, windowMs: 60_000 },
  /** Context file extraction — heavier compute, tighter IP limit */
  contextExtract: { limit: 5, windowMs: 60_000 },
  /** Blob deletion — IP-level burst protection */
  blobDelete: { limit: 10, windowMs: 60_000 },
  /** Realtime token — expensive resource (~$0.06/min), per-user limit */
  realtimeToken: { limit: 3, windowMs: 300_000 },
} as const satisfies Record<string, { limit: number; windowMs: number }>

/** Longest window across all configs — used for cleanup sweep threshold. */
export const MAX_WINDOW_MS = Math.max(
  ...Object.values(RATE_LIMITS).map((c) => c.windowMs)
)
