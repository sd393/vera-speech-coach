"use client"

import React, { useState, useRef, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import {
  Send,
  Paperclip,
  FileVideo,
  FileAudio,
  Loader2,
  Upload,
  FileText,
  Mic,
  Square,
  X,
  ArrowRight,
  Search,
  ChevronDown,
  PanelRight,
} from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"

import { useChat, type ResearchMeta, type Attachment } from "@/hooks/use-chat"
import { useRecorder } from "@/hooks/use-recorder"
import { useSlideReview, type DeckFeedback, type SlideFeedback } from "@/hooks/use-slide-review"
import { FadeIn, motion } from "@/components/motion"
import { SlidePanel } from "@/components/slide-panel"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatSlideContextForChat(deck: DeckFeedback, feedbacks: SlideFeedback[]): string {
  const lines: string[] = [
    `Deck: "${deck.deckTitle}"`,
    `Overall Score: ${deck.overallRating}/100`,
    `Audience Assumed: ${deck.audienceAssumed}`,
    ``,
    `Executive Summary:`,
    deck.executiveSummary,
    ``,
    `Top Priorities:`,
    ...deck.topPriorities.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `Slide-by-Slide Feedback:`,
  ]

  for (const f of feedbacks) {
    const ratingLabel = f.rating === 'needs-work' ? 'NEEDS WORK' : f.rating.toUpperCase()
    lines.push(``)
    lines.push(`Slide ${f.slideNumber}: "${f.title}" — ${ratingLabel}`)
    lines.push(`  ${f.headline}`)
    if (f.quote) lines.push(`  (Quote from slide: "${f.quote}")`)
    if (f.strengths.length > 0) {
      lines.push(`  Strengths:`)
      f.strengths.forEach((s) => lines.push(`    - ${s}`))
    }
    if (f.improvements.length > 0) {
      lines.push(`  Improvements:`)
      f.improvements.forEach((s) => lines.push(`    - ${s}`))
    }
  }

  return lines.join('\n')
}

/* ── Waveform visualization (reads real audio levels from AnalyserNode) ── */

function AudioWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!analyser || !containerRef.current) return
    const a = analyser
    const bars = Array.from(
      containerRef.current.querySelectorAll('[data-bar]')
    ) as HTMLElement[]
    const dataArray = new Uint8Array(a.frequencyBinCount)
    let rafId: number

    function update() {
      a.getByteFrequencyData(dataArray)
      const step = Math.max(1, Math.floor(dataArray.length / bars.length))
      bars.forEach((bar, i) => {
        const value = dataArray[i * step] / 255
        bar.style.height = `${Math.max(3, Math.round(value * 22))}px`
      })
      rafId = requestAnimationFrame(update)
    }

    rafId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafId)
  }, [analyser])

  return (
    <div ref={containerRef} className="flex w-[90%] mx-auto items-center justify-between overflow-hidden">
      {Array.from({ length: 56 }).map((_, i) => (
        <div
          key={i}
          data-bar=""
          className="w-0.5 flex-shrink-0 rounded-full bg-primary/70"
          style={{ height: '3px' }}
        />
      ))}
    </div>
  )
}

/* ── Empty-state starter prompts ── */

const AUDIENCES = [
  "investors",
  "your class",
  "customers",
  "your team",
  "a jury",
  "prospects",
  "colleagues",
  "reviewers",
  "patients",
  "delegates",
]

const SUGGESTIONS = [
  {
    icon: FileText,
    label: "Review my slide deck",
    action: "upload-pdf" as const,
  },
  {
    icon: Mic,
    label: "Listen to my live presentation",
    message: "",
    action: "record" as const,
  },
  {
    icon: Upload,
    label: "Upload a video or audio recording",
    action: "upload" as const,
  },
]

/* ── Follow-up prompts for active coaching ── */

const FOLLOW_UPS_EARLY = [
  {
    label: "Define my target audience",
    message:
      "Help me clearly define who I'm presenting to — their role, expectations, and what they care about.",
  },
  {
    label: "Clarify my key message",
    message:
      "What should be the single most important takeaway my audience remembers?",
  },
]

const FOLLOW_UPS_LATER = [
  {
    label: "Strengthen my opening",
    message:
      "Help me craft a stronger opening that grabs attention in the first 30 seconds.",
  },
  {
    label: "Challenge my weakest point",
    message:
      "Play devil's advocate — where would a skeptical audience push back on my argument?",
  },
  {
    label: "Polish my closing",
    message: "Help me end with a memorable, actionable closing statement.",
  },
]

function ResearchCard({ meta }: { meta: ResearchMeta }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm"
      >
        <Search className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-medium text-white/80">
          Audience research completed
        </span>
        <span className="text-white/50">
          — {meta.searchTerms.length} searches
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-border/60 px-4 py-3 text-sm">
          <p className="mb-2 font-medium text-white/70">
            {meta.audienceSummary}
          </p>
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/50">
              Search terms
            </p>
            <div className="flex flex-wrap gap-1.5">
              {meta.searchTerms.map((term) => (
                <span
                  key={term}
                  className="rounded-md border border-border/40 bg-background px-2 py-0.5 text-xs text-white/70"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/50">
              Briefing
            </p>
            <div className="prose prose-sm max-w-none text-xs leading-relaxed text-white/70 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-white [&_strong]:font-semibold">
              <ReactMarkdown>{meta.briefing}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ChatInterfaceProps {
  authToken?: string | null
  isTrialMode?: boolean
  onChatStart?: () => void
}

export function ChatInterface({
  authToken,
  isTrialMode,
  onChatStart,
}: ChatInterfaceProps) {
  const router = useRouter()

  const {
    messages,
    researchMeta,
    isCompressing,
    isTranscribing,
    isResearching,
    isStreaming,
    error,
    trialMessagesRemaining,
    trialLimitReached,
    freeLimitReached,
    sendMessage,
    uploadFile,
    addMessage,
    setSlideContext,
    clearError,
  } = useChat(authToken)

  const {
    isRecording,
    elapsed,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useRecorder()

  const slideReview = useSlideReview(authToken)
  const hasSlidePanel = slideReview.panelOpen
  const recorder = useRecorder()

  const [input, setInput] = useState("")
  const [showTrialDialog, setShowTrialDialog] = useState(false)
  const [showFreeLimitDialog, setShowFreeLimitDialog] = useState(false)
  const [inputPlaceholder, setInputPlaceholder] = useState(
    "Describe your audience or ask for feedback..."
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => {
      setInputPlaceholder(
        mq.matches
          ? "Describe your audience or ask for feedback..."
          : "What's your presentation about?"
      )
    }
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  const [audienceIndex, setAudienceIndex] = useState(0)
  const [audienceWidth, setAudienceWidth] = useState(0)
  const audienceRefCallback = React.useCallback(
    (node: HTMLSpanElement | null) => {
      if (node) setAudienceWidth(node.offsetWidth)
    },
    []
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setAudienceIndex((prev) => (prev + 1) % AUDIENCES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const isBusy = isCompressing || isTranscribing || isResearching || isStreaming
  const isInputDisabled = isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing || recorder.isRecording
  const isEmptyState = messages.length === 1 && messages[0].role === "assistant"

  useEffect(() => {
    if (!isEmptyState) onChatStart?.()
  }, [isEmptyState, onChatStart])

  const exchangeCount = messages.filter((m) => m.role === "user").length
  const hasAudioUpload = messages.some(
    (m) =>
      m.attachment &&
      m.attachment.type !== "application/pdf" &&
      !m.attachment.name.toLowerCase().endsWith(".pdf")
  )
  const lastMessage = messages[messages.length - 1]
  const showFollowUps =
    !isBusy &&
    !isEmptyState &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.length > 0
  const followUps = exchangeCount <= 1 ? FOLLOW_UPS_EARLY : FOLLOW_UPS_LATER

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTranscribing, isStreaming])

  useEffect(() => {
    if (trialLimitReached) setShowTrialDialog(true)
  }, [trialLimitReached])

  useEffect(() => {
    if (freeLimitReached) setShowFreeLimitDialog(true)
  }, [freeLimitReached])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  useEffect(() => {
    if (slideReview.error) toast.error(slideReview.error)
  }, [slideReview.error])

  // Feed completed slide analysis into the chat context so Vera can reference it
  useEffect(() => {
    if (slideReview.deckSummary && slideReview.slideFeedbacks.length > 0) {
      setSlideContext(
        formatSlideContextForChat(slideReview.deckSummary, slideReview.slideFeedbacks)
      )
    }
  }, [slideReview.deckSummary, slideReview.slideFeedbacks, setSlideContext])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isInputDisabled) return
    setInput("")
    sendMessage(trimmed)
  }

  function handlePdfAnalysis(file: File) {
    const attachment: Attachment = { name: file.name, type: file.type || 'application/pdf', size: file.size }
    const messageId = addMessage('', attachment)
    slideReview.uploadAndAnalyze(file, undefined, messageId)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      handlePdfAnalysis(file)
    } else {
      uploadFile(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handlePdfAnalysis(file)
    if (pdfInputRef.current) pdfInputRef.current.value = ""
  }

  async function handleStartRecording() {
    if (isTrialMode) {
      router.push("/login")
      return
    }
    const err = await recorder.startRecording()
    if (err) {
      const messages: Record<string, string> = {
        not_allowed: "Please allow microphone access to record",
        not_found: "No microphone found",
        no_media_support: "Your browser doesn't support audio recording",
        unknown: "Could not start recording",
      }
      toast.error(messages[err] ?? "Could not start recording")
    }
  }

  async function handleStopRecording() {
    const file = await recorder.stopRecording()
    if (file) uploadFile(file)
  }

  function handleSuggestionClick(s: (typeof SUGGESTIONS)[number]) {
    if (isTrialMode) {
      router.push("/login")
      return
    }
    if (s.action === "upload-pdf") {
      pdfInputRef.current?.click()
    } else if (s.action === "upload") {
      fileInputRef.current?.click()
    } else if (s.action === "record") {
      handleStartRecording()
    }
  }

  /* ─────────────────────────────────────────────────
     Shared input bar — used in both layout branches
  ───────────────────────────────────────────────── */

  // Shared recording overlay content (same in both input bars)
  const recordingContent = (
    <div className="flex w-full items-center gap-2 px-3">
      {/* Pulsing red indicator */}
      <div className="relative flex-shrink-0">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
      </div>
      {/* Real-time waveform */}
      <div className="flex-1 min-w-0">
        <AudioWaveform analyser={recorder.analyserNode} />
      </div>
      {/* Elapsed time */}
      <span className="flex-shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatElapsed(recorder.elapsed)}
      </span>
      {/* Cancel */}
      <button
        type="button"
        onClick={recorder.cancelRecording}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Cancel recording"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Stop + upload */}
      <button
        type="button"
        onClick={handleStopRecording}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
        aria-label="Stop recording and send"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  )

  // The compact input bar (active chat)
  const compactInputBar = (
    <div className="flex-shrink-0 px-4 pb-4 pt-2 sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
        <div
          className={`relative flex h-12 sm:h-14 items-center overflow-hidden rounded-2xl border bg-muted transition-colors ${
            recorder.isRecording
              ? "border-red-500/40"
              : "border-border focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20"
          }`}
        >
          {recorder.isRecording ? recordingContent : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing}
                className="absolute left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Attach a file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={inputPlaceholder}
                rows={1}
                disabled={isInputDisabled}
                className="h-full w-full resize-none bg-transparent py-3 pl-12 pr-20 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 sm:py-3.5"
              />
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing || !!input.trim()}
                className="absolute right-11 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                aria-label="Start recording"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isInputDisabled}
                className="absolute right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
                aria-label="Send message"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )

  /* ─────────────────────────────────────────────────
     Message feed
  ───────────────────────────────────────────────── */

  const messagesFeed = (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        {messages.map((msg) => {
          if (msg.role === "assistant" && !msg.content) return null
          const isPdfAttachment =
            !!msg.attachment &&
            (msg.attachment.type === "application/pdf" ||
              msg.attachment.name.toLowerCase().endsWith(".pdf"))
          const hasReview = isPdfAttachment && !!slideReview.reviews[msg.id]
          const isActiveAnalysis =
            isPdfAttachment &&
            slideReview.activeReviewKey === msg.id &&
            slideReview.isAnalyzing
          const isCurrentlyShown =
            slideReview.displayedKey === msg.id && slideReview.panelOpen
          return (
            <div key={msg.id}>
              {msg.role === "assistant" ? (
                <div>
                  <p className="font-display mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    Vera
                  </p>
                  <div className="prose prose-sm max-w-none text-[0.9375rem] leading-[1.7] text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-foreground/70 [&_strong]:text-foreground [&_blockquote]:border-primary/20 [&_blockquote]:text-foreground/70 [&_li]:marker:text-primary/40">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-[80%]">
                    {msg.attachment && (
                      <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                        {msg.attachment.type.startsWith("video") ? (
                          <FileVideo className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        ) : isPdfAttachment ? (
                          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        ) : (
                          <FileAudio className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {msg.attachment.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(msg.attachment.size)}
                          </p>
                        </div>
                        {(hasReview || isActiveAnalysis) && !isCurrentlyShown && (
                          <button
                            type="button"
                            onClick={() =>
                              slideReview.reviews[msg.id]
                                ? slideReview.openReview(msg.id)
                                : slideReview.openPanel()
                            }
                            title={isActiveAnalysis ? "View progress" : "View review"}
                            className="ml-1 flex-shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                          >
                            {hasSlidePanel ? (
                              <PanelRight className="h-3.5 w-3.5" />
                            ) : (
                              isActiveAnalysis ? "View progress" : "View review"
                            )}
                          </button>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="rounded-xl bg-muted px-4 py-2.5">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {msg.content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {isCompressing && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Compressing audio</span>
          </div>
        )}
        {isTranscribing && !isCompressing && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Transcribing your recording</span>
          </div>
        )}
        {isResearching && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Researching your audience</span>
          </div>
        )}
        {researchMeta && !isResearching && <ResearchCard meta={researchMeta} />}
        {isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "assistant" &&
          messages[messages.length - 1].content === "" && (
            <div>
              <p className="font-display mb-2 text-xs font-semibold uppercase tracking-wide text-primary/60">
                Vera
              </p>
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Analyzing your presentation
                </span>
              </div>
            </div>
          )}
        {showFollowUps && (
          <div className="pt-2">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              Continue with
            </p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => { setInput(""); sendMessage(f.message) }}
                  disabled={isInputDisabled}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground/80 transition-all duration-150 hover:border-primary/30 hover:bg-accent hover:text-foreground active:scale-[0.98] disabled:opacity-50"
                >
                  {f.label}
                  <ArrowRight className="h-3 w-3 text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  /* ─────────────────────────────────────────────────
     Unified layout — slide panel slides in from right
  ───────────────────────────────────────────────── */

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background">
      {/* ── Chat area (always rendered; makes room for panel on desktop) ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{
          marginRight: hasSlidePanel ? "62%" : 0,
          transition: "margin-right 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <AnimatePresence mode="wait">
          {isEmptyState ? (
            /* ── Empty state ── */
            <motion.div
              key="empty-state"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6"
            >
              {/* Ambient glow */}
              <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-3xl">
                  <div
                    className="h-full w-full rounded-full"
                    style={{ background: "radial-gradient(circle, hsl(36 56% 48% / 0.6), transparent 70%)" }}
                  />
                </div>
                <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full opacity-[0.06] blur-3xl">
                  <div
                    className="h-full w-full rounded-full"
                    style={{ background: "radial-gradient(circle, hsl(34 35% 74%), transparent 70%)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <FadeIn delay={0}>
                  <p className="font-display mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                    Vera
                  </p>
                </FadeIn>
                <FadeIn delay={0.1}>
                  <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                    Rehearse with
                    <span className="mt-1 block text-primary">
                      <span className="relative inline-block pb-3">
                        <AnimatePresence mode="wait">
                          <motion.span
                            ref={audienceRefCallback}
                            key={AUDIENCES[audienceIndex]}
                            className="relative z-10 inline-block"
                            style={{
                              textShadow: [
                                "-4px 0", "4px 0", "0 4px", "0 -4px",
                                "-3px 3px", "3px 3px", "-3px -3px", "3px -3px",
                                "-2px 4px", "2px 4px", "-4px 2px", "4px 2px",
                                "-2px -4px", "2px -4px", "-4px -2px", "4px -2px",
                              ]
                                .map((o) => `${o} 0 hsl(var(--background))`)
                                .join(", "),
                            }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                          >
                            {AUDIENCES[audienceIndex]}
                          </motion.span>
                        </AnimatePresence>
                        <motion.span
                          className="absolute bottom-[0.18em] left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-primary/30"
                          animate={{ width: audienceWidth + 20 }}
                          transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                      </span>
                    </span>
                  </h1>
                </FadeIn>
                <FadeIn delay={0.15}>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
                    Describe your audience and Vera will simulate them, giving you
                    feedback that feels human.
                  </p>
                  {isTrialMode && (
                    <p className="mt-2 text-xs text-primary sm:text-sm">
                      Try 4 free messages — no account needed
                    </p>
                  )}
                </FadeIn>

                <FadeIn delay={0.25}>
                  <form onSubmit={handleSubmit} className="mt-10 w-full max-w-3xl">
                    <div
                      className={`relative flex h-12 sm:h-14 items-center overflow-hidden rounded-2xl border bg-muted transition-colors ${
                        recorder.isRecording
                          ? "border-red-500/40"
                          : "border-border focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20"
                      }`}
                    >
                      {recorder.isRecording ? recordingContent : (
                        <>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isInputDisabled}
                            className="absolute left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                            aria-label="Attach a file"
                          >
                            <Paperclip className="h-4 w-4" />
                          </button>
                          <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSubmit(e)
                              }
                            }}
                            placeholder={inputPlaceholder}
                            rows={1}
                            disabled={isInputDisabled}
                            className="h-full w-full resize-none bg-transparent py-3 pl-14 pr-20 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 sm:pl-12 sm:py-3.5 sm:text-base"
                          />
                          <button
                            type="button"
                            onClick={handleStartRecording}
                            disabled={isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing || !!input.trim()}
                            className="absolute right-11 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                            aria-label="Start recording"
                          >
                            <Mic className="h-4 w-4" />
                          </button>
                          <button
                            type="submit"
                            disabled={!input.trim() || isInputDisabled}
                            className="absolute right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
                            aria-label="Send message"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap justify-center gap-2 px-1">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          disabled={isInputDisabled}
                          className="group flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-all duration-150 hover:border-primary/30 hover:text-foreground active:scale-[0.98] disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-xs"
                        >
                          <s.icon className="h-3 w-3 flex-shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
                          <span className="whitespace-nowrap">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </form>
                </FadeIn>
              </div>
            </motion.div>
          ) : (
            /* ── Active coaching workspace ── */
            <motion.div
              key="active-chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Session context bar — compact when slide panel is open */}
              <div
                className="flex-shrink-0 border-b border-border/60"
                style={{
                  padding: hasSlidePanel ? "10px 16px" : "12px 24px",
                  transition: "padding 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {hasSlidePanel ? (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="font-semibold text-foreground">Coaching</span>
                    </div>
                    <span>
                      {exchangeCount} {exchangeCount === 1 ? "exchange" : "exchanges"}
                    </span>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-2xl items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Coaching Session
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {isTrialMode &&
                        trialMessagesRemaining !== null &&
                        trialMessagesRemaining > 0 && (
                          <span className="font-medium text-primary">
                            {trialMessagesRemaining} free{" "}
                            {trialMessagesRemaining === 1 ? "message" : "messages"}{" "}
                            left
                          </span>
                        )}
                      {hasAudioUpload && (
                        <span className="flex items-center gap-1.5">
                          <FileAudio className="h-3 w-3" />
                          Recording uploaded
                        </span>
                      )}
                      <span>
                        {exchangeCount}{" "}
                        {exchangeCount === 1 ? "exchange" : "exchanges"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {messagesFeed}
            </motion.div>
          )}
        </AnimatePresence>

        {!isEmptyState && (
          hasSlidePanel
            ? <div className="hidden md:block">{compactInputBar}</div>
            : compactInputBar
        )}
      </div>

      {/* ── Slide panel (absolutely positioned, slides in from the right) ── */}
      <AnimatePresence>
        {hasSlidePanel && (
          <motion.div
            key="slide-panel"
            className="absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-border/60 bg-background md:w-[62%]"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <SlidePanel
              slideReview={slideReview}
              onClose={slideReview.closePanel}
              onReset={slideReview.reset}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.pdf,application/pdf"
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload video or audio file"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handlePdfUpload}
        className="hidden"
        aria-label="Upload PDF"
      />

      {/* Recording bar */}
      {isRecording && (
        <div className="flex-shrink-0 px-6 pb-4 pt-2">
          <div className="mx-auto flex max-w-2xl items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-medium text-foreground">
                Recording...
              </span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatElapsed(elapsed)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cancel recording"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                aria-label="Stop recording"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial limit dialog */}
      <Dialog open={showTrialDialog} onOpenChange={setShowTrialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You&apos;ve used your free messages</DialogTitle>
            <DialogDescription>
              Create a free account to keep coaching with Vera.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free plan limit dialog */}
      <Dialog open={showFreeLimitDialog} onOpenChange={setShowFreeLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daily message limit reached</DialogTitle>
            <DialogDescription>
              You&apos;ve used all 20 of your daily messages. Upgrade to Pro for unlimited access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/premium"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Upgrade to Pro
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
