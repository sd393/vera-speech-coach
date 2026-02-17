"use client"

import React, { useState, useRef, useEffect, type FormEvent } from "react"
import ReactMarkdown from "react-markdown"
import {
  Send,
  Paperclip,
  FileVideo,
  FileAudio,
  Loader2,
  Upload,
  Target,
  MessageSquare,
  Mic,
  ArrowRight,
} from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { useChat } from "@/hooks/use-chat"
import { FadeIn, motion } from "@/components/motion"
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

/* ── Empty-state starter prompts ── */

const SUGGESTIONS = [
  {
    icon: Target,
    label: "Prep for a board presentation",
    message:
      "I'm preparing for a board presentation next week. Can you help me rehearse?",
  },
  {
    icon: MessageSquare,
    label: "Get feedback on my pitch",
    message:
      "I have a startup pitch deck I'd like feedback on. Where should I start?",
  },
  {
    icon: Mic,
    label: "Analyze my recorded talk",
    message:
      "I have a recording of a practice talk I'd like you to analyze.",
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
    message:
      "Help me end with a memorable, actionable closing statement.",
  },
]

interface ChatInterfaceProps {
  authToken?: string | null
  isTrialMode?: boolean
}

export function ChatInterface({
  authToken,
  isTrialMode,
}: ChatInterfaceProps) {
  const {
    messages,
    isCompressing,
    isTranscribing,
    isStreaming,
    error,
    trialMessagesRemaining,
    trialLimitReached,
    sendMessage,
    uploadFile,
    clearError,
  } = useChat(authToken)

  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBusy = isCompressing || isTranscribing || isStreaming
  const isInputDisabled = isBusy || trialLimitReached
  const isEmptyState =
    messages.length === 1 && messages[0].role === "assistant"

  // Derived session state
  const exchangeCount = messages.filter((m) => m.role === "user").length
  const hasUpload = messages.some((m) => m.attachment)
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
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isInputDisabled) return

    setInput("")
    sendMessage(trimmed)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    uploadFile(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <AnimatePresence mode="wait">
        {isEmptyState ? (
          /* ────────────────────────────────────────────
             MODE 1: EMPTY STATE
             ──────────────────────────────────────────── */
          <motion.div
            key="empty-state"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6"
          >
            {/* Subtle ambient glow — empty state only */}
            <div
              className="pointer-events-none absolute inset-0 -z-10"
              aria-hidden="true"
            >
              <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-3xl">
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(192 80% 55%), transparent 70%)",
                  }}
                />
              </div>
              <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full opacity-[0.06] blur-3xl">
                <div
                  className="h-full w-full rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(165 55% 50%), transparent 70%)",
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <FadeIn delay={0}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary/70">
                  Presentation Coaching
                </p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                  Ready to rehearse?
                </h1>
              </FadeIn>
              <FadeIn delay={0.15}>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
                  Describe your audience and Vera will simulate them, giving you
                  feedback that actually matters.
                </p>
                {isTrialMode && (
                  <p className="mt-2 text-sm text-primary/70">
                    Try 4 free messages — no account needed
                  </p>
                )}
              </FadeIn>

              <FadeIn delay={0.25}>
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setInput("")
                        sendMessage(s.message)
                      }}
                      disabled={isInputDisabled}
                      className="group flex items-center gap-2.5 rounded-xl border border-border bg-white px-5 py-3 text-sm font-medium text-foreground shadow-sm transition-all duration-150 hover:border-primary/30 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                    >
                      <s.icon className="h-4 w-4 text-primary/70 transition-colors group-hover:text-primary" />
                      {s.label}
                    </button>
                  ))}
                </div>
              </FadeIn>

              <FadeIn delay={0.35}>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isInputDisabled}
                    className="group flex items-center gap-3 rounded-xl border-2 border-dashed border-border bg-white px-8 py-4 text-sm font-medium text-muted-foreground transition-all duration-150 hover:border-primary/30 hover:text-foreground disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5 text-primary/50 transition-colors group-hover:text-primary/70" />
                    Upload a video or audio recording
                  </button>
                </div>
              </FadeIn>
            </div>
          </motion.div>
        ) : (
          /* ────────────────────────────────────────────
             MODE 2: ACTIVE COACHING WORKSPACE
             ──────────────────────────────────────────── */
          <motion.div
            key="active-chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* Session context bar */}
            <div className="flex-shrink-0 border-b border-border/60 bg-white px-6 py-3">
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
                      <span className="font-medium text-primary/70">
                        {trialMessagesRemaining} free{" "}
                        {trialMessagesRemaining === 1
                          ? "message"
                          : "messages"}{" "}
                        left
                      </span>
                    )}
                  {hasUpload && (
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
            </div>

            {/* Messages area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-8"
            >
              <div className="mx-auto flex max-w-2xl flex-col gap-8">
                {messages.map((msg) => {
                  // Skip empty assistant messages — streaming indicator handles this
                  if (msg.role === "assistant" && !msg.content) return null

                  return (
                    <div key={msg.id}>
                      {msg.role === "assistant" ? (
                        /* ── Coaching card ── */
                        <div className="rounded-2xl border border-border/60 border-l-2 border-l-primary/25 bg-white px-6 py-5 shadow-sm">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary/60">
                            Vera
                          </p>
                          <div className="prose prose-sm max-w-none text-[0.9375rem] leading-[1.7] text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-foreground/70 [&_strong]:text-foreground [&_blockquote]:border-primary/20 [&_blockquote]:text-foreground/70 [&_li]:marker:text-primary/40">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      ) : (
                        /* ── User message ── */
                        <div className="flex justify-end">
                          <div className="max-w-[80%]">
                            {msg.attachment && (
                              <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2">
                                {msg.attachment.type.startsWith("video") ? (
                                  <FileVideo className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
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
                              </div>
                            )}
                            <div className="rounded-xl bg-muted px-4 py-2.5">
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Compressing indicator */}
                {isCompressing && (
                  <div className="rounded-2xl border border-border/60 bg-white px-6 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Compressing audio
                      </span>
                    </div>
                  </div>
                )}

                {/* Transcription indicator */}
                {isTranscribing && !isCompressing && (
                  <div className="rounded-2xl border border-border/60 bg-white px-6 py-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        Transcribing your recording
                      </span>
                    </div>
                  </div>
                )}

                {/* Streaming indicator */}
                {isStreaming &&
                  messages.length > 0 &&
                  messages[messages.length - 1].role === "assistant" &&
                  messages[messages.length - 1].content === "" && (
                    <div className="rounded-2xl border border-border/60 border-l-2 border-l-primary/25 bg-white px-6 py-5 shadow-sm">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary/60">
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

                {/* Follow-up suggestions */}
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
                          onClick={() => {
                            setInput("")
                            sendMessage(f.message)
                          }}
                          disabled={isInputDisabled}
                          className="group flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm text-foreground/80 shadow-sm transition-all duration-150 hover:border-primary/30 hover:text-foreground hover:shadow-md active:scale-[0.98] disabled:opacity-50"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload video or audio file"
      />

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-border/60 bg-white px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-2xl items-center"
        >
          <div className="relative flex flex-1 items-center">
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
              placeholder="Describe your audience or ask for feedback..."
              rows={1}
              disabled={isInputDisabled}
              className="h-12 w-full resize-none rounded-xl border border-border bg-background pl-12 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />

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
          </div>
        </form>
      </div>

      {/* Trial limit reached dialog */}
      <Dialog open={trialLimitReached} onOpenChange={() => {}}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>You&apos;ve used your free messages</DialogTitle>
            <DialogDescription>
              Create a free account to keep coaching with Vera.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Log in to existing account
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign up free
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
