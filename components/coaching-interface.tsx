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
  Smile,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { useChat, type ResearchMeta, type Attachment } from "@/hooks/use-chat"
import { useRecorder } from "@/hooks/use-recorder"
import { useSlideReview, type DeckFeedback, type SlideFeedback } from "@/hooks/use-slide-review"
import { FadeIn } from "@/components/motion"
import { SlidePanel } from "@/components/slide-panel"
import { AudienceFace, type FaceState, type FaceEmotion, isValidFaceEmotion } from "@/components/audience-face"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

/* ── Utilities ── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
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
    const ratingLabel = f.rating === "needs-work" ? "NEEDS WORK" : f.rating.toUpperCase()
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
  return lines.join("\n")
}

/* ── Waveform ── */

function AudioWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!analyser || !containerRef.current) return
    const a = analyser
    const bars = Array.from(containerRef.current.querySelectorAll("[data-bar]")) as HTMLElement[]
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
        <div key={i} data-bar="" className="w-0.5 flex-shrink-0 rounded-full bg-primary/70" style={{ height: "3px" }} />
      ))}
    </div>
  )
}

/* ── Research card ── */

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
        <span className="font-medium text-white/80">Audience research completed</span>
        <span className="text-white/50">— {meta.searchTerms.length} searches</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border/60 px-4 py-3 text-sm">
          <p className="mb-2 font-medium text-white/70">{meta.audienceSummary}</p>
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/50">Search terms</p>
            <div className="flex flex-wrap gap-1.5">
              {meta.searchTerms.map((term) => (
                <span key={term} className="rounded-md border border-border/40 bg-background px-2 py-0.5 text-xs text-white/70">{term}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/50">Briefing</p>
            <div className="prose prose-sm max-w-none text-xs leading-relaxed text-white/70 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_strong]:text-white [&_strong]:font-semibold">
              <ReactMarkdown>{meta.briefing}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Constants ── */

const SETUP_EXAMPLES = [
  { topic: "my Series A pitch", audience: "VC investors", goal: "secure funding" },
  { topic: "a Q3 revenue review", audience: "the board of directors", goal: "get buy-in" },
  { topic: "our product roadmap", audience: "my engineering team", goal: "ship on time" },
  { topic: "a keynote talk", audience: "500 conference attendees", goal: "inspire action" },
  { topic: "a client proposal", audience: "the procurement team", goal: "close the deal" },
]


const FOLLOW_UPS_EARLY = [
  { label: "Define my target audience", message: "Help me clearly define who I'm presenting to — their role, expectations, and what they care about." },
  { label: "Clarify my key message",    message: "What should be the single most important takeaway my audience remembers?" },
]

const FOLLOW_UPS_LATER = [
  { label: "Strengthen my opening",      message: "Help me craft a stronger opening that grabs attention in the first 30 seconds." },
  { label: "Challenge my weakest point", message: "Play devil's advocate — where would a skeptical audience push back on my argument?" },
  { label: "Polish my closing",          message: "Help me end with a memorable, actionable closing statement." },
]

/* ── Props ── */

interface CoachingInterfaceProps {
  authToken?: string | null
  isTrialMode?: boolean
  onChatStart?: () => void
}

export function CoachingInterface({ authToken, isTrialMode, onChatStart }: CoachingInterfaceProps) {
  const router = useRouter()

  const {
    messages, researchMeta, isCompressing, isTranscribing, isResearching, isStreaming,
    error, trialMessagesRemaining, trialLimitReached, freeLimitReached,
    sendMessage, uploadFile, addMessage, setSlideContext, clearError,
  } = useChat(authToken)

  const recorder = useRecorder()
  const slideReview = useSlideReview(authToken)
  const hasSlidePanel = slideReview.panelOpen

  const [input, setInput] = useState("")
  const [inputPlaceholder, setInputPlaceholder] = useState("Describe your audience or ask for feedback...")
  const [setupTopic, setSetupTopic] = useState("")
  const [setupAudience, setSetupAudience] = useState("")
  const [setupGoal, setSetupGoal] = useState("")
  const [showTrialDialog, setShowTrialDialog] = useState(false)
  const [showFreeLimitDialog, setShowFreeLimitDialog] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  /* ── Responsive placeholder ── */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)")
    const update = () => setInputPlaceholder(mq.matches ? "Describe your audience or ask for feedback..." : "What's your presentation about?")
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  /* ── Setup example cycling + underline measurement ── */
  const [exampleIndex, setExampleIndex] = useState(0)
  // sizerIndex lags behind exampleIndex by the exit animation duration,
  // so the container doesn't resize until the old text has faded out.
  const [sizerIndex, setSizerIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setExampleIndex((i) => (i + 1) % SETUP_EXAMPLES.length), 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSizerIndex(exampleIndex), 250)
    return () => clearTimeout(t)
  }, [exampleIndex])

  const topicSizerRef = useRef<HTMLSpanElement>(null)
  const audienceSizerRef = useRef<HTMLSpanElement>(null)
  const goalSizerRef = useRef<HTMLSpanElement>(null)
  const [blankWidths, setBlankWidths] = useState({ topic: 0, audience: 0, goal: 0 })

  useEffect(() => {
    setBlankWidths({
      topic: topicSizerRef.current?.offsetWidth ?? 0,
      audience: audienceSizerRef.current?.offsetWidth ?? 0,
      goal: goalSizerRef.current?.offsetWidth ?? 0,
    })
  }, [setupTopic, setupAudience, setupGoal, sizerIndex])

  /* ── Satisfied window + audience pulse ── */
  const [satisfiedWindow, setSatisfiedWindow] = useState(false)
  const [pulseLabels, setPulseLabels] = useState<{ text: string; emotion: FaceEmotion }[]>([])
  const [pulseIndex, setPulseIndex] = useState(0)
  const prevStreaming = useRef(false)

  /* ── TTS (ElevenLabs) ── */
  const [isTTSLoading, setIsTTSLoading] = useState(false)
  const [isTTSSpeaking, setIsTTSSpeaking] = useState(false)
  const [ttsCaption, setTtsCaption] = useState("")
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const presentationModeRef = useRef(false)
  useEffect(() => { presentationModeRef.current = presentationMode }, [presentationMode])

  // Stable ref to messages for use in callbacks (fetchPulseLabels, audio.onended)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  function fetchPulseLabels() {
    const recent = messagesRef.current
      .filter(m => m.content.trim())
      .slice(-4)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    if (recent.length === 0) return
    fetch("/api/audience-pulse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: recent }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Pulse API ${r.status}`)
        return r.json()
      })
      .then(({ labels }) => {
        if (!Array.isArray(labels)) return
        const validLabels = labels
          .map((l: unknown) => {
            // Handle {text, emotion} objects from updated API
            if (l && typeof l === "object" && "text" in l) {
              const obj = l as { text: unknown; emotion?: unknown }
              const text = typeof obj.text === "string" ? obj.text : ""
              const emotion: FaceEmotion = isValidFaceEmotion(obj.emotion) ? obj.emotion : "neutral"
              return text ? { text, emotion } : null
            }
            // Backwards compat: plain string
            if (typeof l === "string") return { text: l, emotion: "neutral" as FaceEmotion }
            return null
          })
          .filter((l): l is { text: string; emotion: FaceEmotion } => l !== null)
        if (validLabels.length > 0) {
          setPulseLabels(validLabels)
          setPulseIndex(0)
        }
      })
      .catch((err) => { console.warn("[audience-pulse] failed:", err) })
  }

  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      prevStreaming.current = false

      // In presentation mode, TTS drives the satisfied state; otherwise flash immediately
      let t: ReturnType<typeof setTimeout> | undefined
      if (!presentationModeRef.current) {
        setSatisfiedWindow(true)
        t = setTimeout(() => setSatisfiedWindow(false), 2000)
      }

      fetchPulseLabels()

      if (presentationModeRef.current) {
        const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.content)
        if (lastAssistant?.content) speakText(lastAssistant.content)
      }

      return () => { if (t) clearTimeout(t) }
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, messages])

  // Cycle through pulse labels every 4s
  useEffect(() => {
    if (pulseLabels.length <= 1) return
    const t = setInterval(() => setPulseIndex(i => (i + 1) % pulseLabels.length), 4000)
    return () => clearInterval(t)
  }, [pulseLabels])

  /* ── Held processing state (prevents gap flash between phases) ── */
  const isProcessingRaw = isCompressing || isTranscribing || isResearching || isTTSLoading || (presentationMode && isStreaming)
  const [isProcessingHeld, setIsProcessingHeld] = useState(false)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (isProcessingRaw) {
      clearTimeout(holdTimerRef.current)
      setIsProcessingHeld(true)
    } else {
      holdTimerRef.current = setTimeout(() => setIsProcessingHeld(false), 500)
    }
    return () => clearTimeout(holdTimerRef.current)
  }, [isProcessingRaw])

  /* ── Derived state ── */
  const isBusy = isCompressing || isTranscribing || isResearching || isStreaming
  const isInputDisabled = isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing || recorder.isRecording
  const isEmptyState = messages.length === 1 && messages[0].role === "assistant"

  const faceState: FaceState = recorder.isRecording ? "listening"
    : isProcessingHeld ? "thinking"
    : ((!presentationMode && isStreaming) || isTTSSpeaking) ? "speaking"
    : satisfiedWindow ? "satisfied"
    : "idle"

  const thinkingLabel = isCompressing ? "Listening closely..."
    : isTranscribing ? "Taking it all in..."
    : isResearching ? "Getting to know your audience..."
    : (presentationMode && isStreaming) ? "Gathering thoughts..."
    : isTTSLoading ? "Finding the right words..."
    : "Hmm, let me think..."

  const exchangeCount = messages.filter((m) => m.role === "user").length
  const lastMessage = messages[messages.length - 1]
  const showFollowUps = !isBusy && !isEmptyState && lastMessage?.role === "assistant" && lastMessage.content.length > 0
  const followUps = exchangeCount <= 1 ? FOLLOW_UPS_EARLY : FOLLOW_UPS_LATER

  /* ── Effects ── */
  useEffect(() => { if (!isEmptyState) onChatStart?.() }, [isEmptyState, onChatStart])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isTranscribing, isStreaming])

  useEffect(() => { if (trialLimitReached) setShowTrialDialog(true) }, [trialLimitReached])
  useEffect(() => { if (freeLimitReached) setShowFreeLimitDialog(true) }, [freeLimitReached])

  useEffect(() => {
    if (error) { toast.error(error); clearError() }
  }, [error, clearError])

  useEffect(() => { if (slideReview.error) toast.error(slideReview.error) }, [slideReview.error])

  useEffect(() => {
    if (slideReview.deckSummary && slideReview.slideFeedbacks.length > 0) {
      setSlideContext(formatSlideContextForChat(slideReview.deckSummary, slideReview.slideFeedbacks))
    }
  }, [slideReview.deckSummary, slideReview.slideFeedbacks, setSlideContext])

  useEffect(() => {
    if (hasSlidePanel && presentationMode) setPresentationMode(false)
  }, [hasSlidePanel, presentationMode])

  useEffect(() => {
    if (!presentationMode) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setPresentationMode(false); stopSpeaking() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [presentationMode])

  useEffect(() => {
    return () => { ttsAudioRef.current?.pause(); ttsAudioRef.current = null }
  }, [])

  /* ── TTS functions (ElevenLabs with forced alignment) ── */

  const ttsSentencesRef = useRef<{ text: string; start: number; end: number }[]>([])

  function speakText(text: string) {
    stopSpeaking()
    setIsTTSLoading(true)

    fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`TTS failed: ${res.status}`)
        return res.json()
      })
      .then(({ audio, sentences }: { audio: string; sentences: { text: string; start: number; end: number }[] }) => {
        ttsSentencesRef.current = sentences
        if (sentences.length > 0) setTtsCaption(sentences[0].text)

        // Decode base64 audio → blob → Audio element
        const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: "audio/mpeg" })
        const url = URL.createObjectURL(blob)
        const audioEl = new Audio(url)
        ttsAudioRef.current = audioEl

        audioEl.onplaying = () => {
          setIsTTSLoading(false)
          setIsTTSSpeaking(true)
        }
        audioEl.ontimeupdate = () => {
          // Show caption 0.3s ahead of speech
          const t = audioEl.currentTime + 0.3
          const hit = ttsSentencesRef.current.find(s => t >= s.start && t < s.end)
          if (hit) setTtsCaption(hit.text)
        }
        audioEl.onended = () => {
          URL.revokeObjectURL(url)
          setIsTTSSpeaking(false)
          setTtsCaption("")
          ttsAudioRef.current = null
          if (presentationModeRef.current) {
            fetchPulseLabels()
            setSatisfiedWindow(true)
            setTimeout(() => setSatisfiedWindow(false), 3000)
          }
        }
        audioEl.onerror = () => {
          URL.revokeObjectURL(url)
          setIsTTSLoading(false)
          setIsTTSSpeaking(false)
          setTtsCaption("")
          ttsAudioRef.current = null
        }

        audioEl.play().catch(() => {
          setIsTTSLoading(false)
          setIsTTSSpeaking(false)
          setTtsCaption("")
          URL.revokeObjectURL(url)
          ttsAudioRef.current = null
        })
      })
      .catch(() => {
        setIsTTSLoading(false)
        setTtsCaption("")
      })
  }

  function stopSpeaking() {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setIsTTSLoading(false)
    setIsTTSSpeaking(false)
    setTtsCaption("")
    ttsSentencesRef.current = []
  }

  /* ── Handlers ── */
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isInputDisabled) return
    setInput("")
    sendMessage(trimmed)
  }

  function handlePdfAnalysis(file: File) {
    const attachment: Attachment = { name: file.name, type: file.type || "application/pdf", size: file.size }
    const messageId = addMessage("", attachment)
    slideReview.uploadAndAnalyze(file, undefined, messageId)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    isPdf ? handlePdfAnalysis(file) : uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handlePdfAnalysis(file)
    if (pdfInputRef.current) pdfInputRef.current.value = ""
  }

  async function handleStartRecording() {
    if (isTrialMode) { router.push("/login"); return }
    const err = await recorder.startRecording()
    if (err) {
      const msgs: Record<string, string> = {
        not_allowed: "Please allow microphone access to record",
        not_found: "No microphone found",
        no_media_support: "Your browser doesn't support audio recording",
        unknown: "Could not start recording",
      }
      toast.error(msgs[err] ?? "Could not start recording")
    }
  }

  async function handleStopRecording() {
    const file = await recorder.stopRecording()
    if (file) uploadFile(file)
  }

  function buildContextMessage(): string | null {
    const parts: string[] = []
    if (setupTopic.trim()) parts.push(`I'm presenting on: ${setupTopic.trim()}`)
    if (setupAudience.trim()) parts.push(`My audience is: ${setupAudience.trim()}`)
    if (setupGoal.trim()) parts.push(`My goal is to: ${setupGoal.trim()}`)
    return parts.length > 0 ? parts.join(". ") + "." : null
  }

  function handleStartAction(action: "present" | "upload-recording" | "upload-slides" | "just-chat") {
    const context = buildContextMessage()
    switch (action) {
      case "present":
        if (context) addMessage(context)
        setPresentationMode(true)
        break
      case "upload-recording":
        if (isTrialMode) { router.push("/login"); return }
        if (context) addMessage(context)
        fileInputRef.current?.click()
        break
      case "upload-slides":
        if (isTrialMode) { router.push("/login"); return }
        if (context) addMessage(context)
        pdfInputRef.current?.click()
        break
      case "just-chat":
        sendMessage(context ?? "Hey, I'm getting ready for a presentation.")
        break
    }
  }

  function handleSetupKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleStartAction("just-chat")
    }
  }

  /* ── Shared recording overlay (used in both input bars) ── */
  const recordingContent = (
    <div className="flex w-full items-center gap-2 px-3">
      <div className="relative flex-shrink-0">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
      </div>
      <div className="flex-1 min-w-0">
        <AudioWaveform analyser={recorder.analyserNode} />
      </div>
      <span className="flex-shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatElapsed(recorder.elapsed)}
      </span>
      <button type="button" onClick={recorder.cancelRecording}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Cancel recording">
        <X className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={handleStopRecording}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
        aria-label="Stop recording and send">
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  )

  /* ── User message bubble (active chat) ── */
  function UserBubble({ msg }: { msg: (typeof messages)[number] }) {
    const isPdfAttachment = !!msg.attachment && (msg.attachment.type === "application/pdf" || msg.attachment.name.toLowerCase().endsWith(".pdf"))
    const hasReview = isPdfAttachment && !!slideReview.reviews[msg.id]
    const isActiveAnalysis = isPdfAttachment && slideReview.activeReviewKey === msg.id && slideReview.isAnalyzing
    const isCurrentlyShown = slideReview.displayedKey === msg.id && slideReview.panelOpen

    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          {msg.attachment && (
            <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
              {msg.attachment.type.startsWith("video") ? <FileVideo className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                : isPdfAttachment ? <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                : <FileAudio className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{msg.attachment.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(msg.attachment.size)}</p>
              </div>
              {(hasReview || isActiveAnalysis) && !isCurrentlyShown && (
                <button type="button"
                  onClick={() => slideReview.reviews[msg.id] ? slideReview.openReview(msg.id) : slideReview.openPanel()}
                  className="ml-1 flex-shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
                  {isActiveAnalysis ? "View progress" : "View review"}
                </button>
              )}
            </div>
          )}
          {msg.content && !msg.content.startsWith("[Presentation transcript]") && (
            <div className="rounded-xl bg-muted px-4 py-2.5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{msg.content}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Sub-label beneath face (active chat only) ── */
  const currentPulse = pulseLabels[pulseIndex] ?? null
  const currentEmotion: FaceEmotion = currentPulse?.emotion ?? "neutral"
  const audienceLabel = currentPulse?.text
    ?? researchMeta?.audienceSummary
    ?? (slideReview.deckSummary?.audienceAssumed ? `Presenting to ${slideReview.deckSummary.audienceAssumed}` : null)
    ?? "In the room with you"

  const faceSubLabel = (isTranscribing || isResearching) ? (
    <span className="animate-pulse text-xs text-muted-foreground/70">
      {isTranscribing ? "Transcribing..." : "Thinking..."}
    </span>
  ) : (!isStreaming && !recorder.isRecording) ? (
    <AnimatePresence mode="wait">
      <motion.span
        key={pulseLabels.length > 0 ? pulseIndex : audienceLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-[300px] text-center text-xs leading-snug text-muted-foreground/50"
      >
        {audienceLabel}
      </motion.span>
    </AnimatePresence>
  ) : null

  /* ── Render ── */
  return (
    <div className="relative flex flex-1 overflow-hidden bg-background">
      <div
        className="flex flex-1 flex-col overflow-hidden min-w-0"
        style={{ marginRight: hasSlidePanel ? "62%" : 0, transition: "margin-right 0.45s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <AnimatePresence mode="wait">
          {isEmptyState ? (

            /* ════════════════════════════════════════════════
               EMPTY STATE — structured setup fields
            ════════════════════════════════════════════════ */
            <motion.div
              key="empty-state"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-8"
            >
              {/* Ambient glow */}
              <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-3xl">
                  <div className="h-full w-full rounded-full" style={{ background: "radial-gradient(circle, hsl(36 56% 48% / 0.6), transparent 70%)" }} />
                </div>
                <div className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full opacity-[0.06] blur-3xl">
                  <div className="h-full w-full rounded-full" style={{ background: "radial-gradient(circle, hsl(34 35% 74%), transparent 70%)" }} />
                </div>
              </div>

              <div className="flex w-full max-w-2xl flex-col items-center overflow-hidden">
                <FadeIn delay={0.1}>
                  <div className="mt-2 flex w-full flex-col items-center gap-6 font-display text-center text-lg text-muted-foreground sm:text-xl md:text-2xl">
                    {/* Topic */}
                    <div className="flex flex-col items-center">
                      <span>I&apos;m presenting</span>
                      <span className="relative mt-1 inline-block max-w-full pb-1">
                        <span ref={topicSizerRef} className="invisible whitespace-nowrap">{setupTopic.length > SETUP_EXAMPLES[sizerIndex].topic.length ? setupTopic : SETUP_EXAMPLES[sizerIndex].topic}</span>
                        <input
                          type="text"
                          value={setupTopic}
                          onChange={(e) => setSetupTopic(e.target.value)}
                          onKeyDown={handleSetupKeyDown}
                          className="absolute inset-x-0 top-0 z-10 w-full bg-transparent text-center text-foreground caret-primary focus:outline-none"
                        />
                        {!setupTopic && (
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={SETUP_EXAMPLES[exampleIndex].topic}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="pointer-events-none absolute inset-x-0 top-0 whitespace-nowrap text-center text-muted-foreground/30"
                            >
                              {SETUP_EXAMPLES[exampleIndex].topic}
                            </motion.span>
                          </AnimatePresence>
                        )}
                        <motion.span
                          className="absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-primary/30"
                          animate={{ width: blankWidths.topic + 20 }}
                          transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                      </span>
                    </div>

                    {/* Audience */}
                    <div className="flex flex-col items-center">
                      <span>to</span>
                      <span className="relative mt-1 inline-block max-w-full pb-1">
                        <span ref={audienceSizerRef} className="invisible whitespace-nowrap">{setupAudience.length > SETUP_EXAMPLES[sizerIndex].audience.length ? setupAudience : SETUP_EXAMPLES[sizerIndex].audience}</span>
                        <input
                          type="text"
                          value={setupAudience}
                          onChange={(e) => setSetupAudience(e.target.value)}
                          onKeyDown={handleSetupKeyDown}
                          className="absolute inset-x-0 top-0 z-10 w-full bg-transparent text-center text-foreground caret-primary focus:outline-none"
                        />
                        {!setupAudience && (
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={SETUP_EXAMPLES[exampleIndex].audience}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="pointer-events-none absolute inset-x-0 top-0 whitespace-nowrap text-center text-muted-foreground/30"
                            >
                              {SETUP_EXAMPLES[exampleIndex].audience}
                            </motion.span>
                          </AnimatePresence>
                        )}
                        <motion.span
                          className="absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-primary/30"
                          animate={{ width: blankWidths.audience + 20 }}
                          transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                      </span>
                    </div>

                    {/* Goal */}
                    <div className="flex flex-col items-center">
                      <span>and I want to</span>
                      <span className="relative mt-1 inline-block max-w-full pb-1">
                        <span ref={goalSizerRef} className="invisible whitespace-nowrap">{setupGoal.length > SETUP_EXAMPLES[sizerIndex].goal.length ? setupGoal : SETUP_EXAMPLES[sizerIndex].goal}</span>
                        <input
                          type="text"
                          value={setupGoal}
                          onChange={(e) => setSetupGoal(e.target.value)}
                          onKeyDown={handleSetupKeyDown}
                          className="absolute inset-x-0 top-0 z-10 w-full bg-transparent text-center text-foreground caret-primary focus:outline-none"
                        />
                        {!setupGoal && (
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={SETUP_EXAMPLES[exampleIndex].goal}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeInOut" }}
                              className="pointer-events-none absolute inset-x-0 top-0 whitespace-nowrap text-center text-muted-foreground/30"
                            >
                              {SETUP_EXAMPLES[exampleIndex].goal}
                            </motion.span>
                          </AnimatePresence>
                        )}
                        <motion.span
                          className="absolute bottom-0 left-1/2 h-[2.5px] -translate-x-1/2 rounded-full bg-primary/30"
                          animate={{ width: blankWidths.goal + 20 }}
                          transition={{ duration: 0.35, ease: "easeInOut" }}
                        />
                      </span>
                    </div>
                  </div>
                </FadeIn>

                <FadeIn delay={0.2}>
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartAction("present")}
                      className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground active:scale-[0.98]"
                    >
                      <Mic className="h-3.5 w-3.5 text-primary/60" />
                      Present live
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartAction("upload-recording")}
                      className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground active:scale-[0.98]"
                    >
                      <Upload className="h-3.5 w-3.5 text-primary/60" />
                      Upload recording
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartAction("upload-slides")}
                      className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground active:scale-[0.98]"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary/60" />
                      Upload slides
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartAction("just-chat")}
                      className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground active:scale-[0.98]"
                    >
                      <Send className="h-3.5 w-3.5 text-primary/60" />
                      Just chat
                    </button>
                  </div>
                </FadeIn>

                {isTrialMode && (
                  <FadeIn delay={0.3}>
                    <p className="mt-6 text-xs text-primary sm:text-sm">Try 4 free messages — no account needed</p>
                  </FadeIn>
                )}
              </div>
            </motion.div>

          ) : (

            /* ════════════════════════════════════════════════
               ACTIVE CHAT — face + feed + toolbar
            ════════════════════════════════════════════════ */
            <motion.div
              key="active-chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Scrollable feed */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                <div className="mx-auto flex max-w-2xl flex-col gap-6">
                  {messages.map((msg) => {
                    if (msg.role === "assistant" && !msg.content) return null
                    return (
                      <div key={msg.id}>
                        {msg.role === "assistant" ? (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                            <div className="prose prose-sm max-w-none text-[0.9375rem] leading-[1.7] text-foreground/90 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-foreground/70 [&_strong]:text-foreground [&_blockquote]:border-primary/20 [&_blockquote]:text-foreground/70 [&_li]:marker:text-primary/40">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </motion.div>
                        ) : (
                          <UserBubble msg={msg} />
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
                  {isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].content === "" && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Analyzing your presentation</span>
                    </div>
                  )}

                  {showFollowUps && (
                    <div className="pt-2">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Continue with</p>
                      <div className="flex flex-wrap gap-2">
                        {followUps.map((f) => (
                          <button key={f.label} type="button"
                            onClick={() => { setInput(""); sendMessage(f.message) }}
                            disabled={isInputDisabled}
                            className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground/80 transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground active:scale-[0.98] disabled:opacity-50">
                            {f.label}
                            <ArrowRight className="h-3 w-3 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom input bar */}
              <div className="flex-shrink-0 px-4 pb-4 pt-2 sm:px-6">
                <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
                  <div className={`relative flex h-12 sm:h-14 items-center overflow-hidden rounded-2xl border bg-muted transition-colors ${
                    recorder.isRecording ? "border-red-500/40" : "border-border focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20"
                  }`}>
                    {recorder.isRecording ? recordingContent : (
                      <>
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          disabled={isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing}
                          className="absolute left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label="Attach a file">
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <textarea value={input} onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
                          placeholder="Describe your audience or ask for feedback..."
                          rows={1} disabled={isInputDisabled}
                          className="h-full w-full resize-none bg-transparent py-3 pl-12 pr-20 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50 sm:py-3.5"
                        />
                        <button type="button" onClick={handleStartRecording}
                          disabled={isBusy || trialLimitReached || freeLimitReached || slideReview.isAnalyzing || !!input.trim()}
                          className="absolute right-11 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                          aria-label="Start recording">
                          <Mic className="h-4 w-4" />
                        </button>
                        {input.trim() ? (
                          <button type="submit" disabled={isInputDisabled}
                            className="absolute right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
                            aria-label="Send message">
                            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                        ) : (
                          <button type="button"
                            onClick={() => setPresentationMode(true)}
                            disabled={isBusy || trialLimitReached || freeLimitReached}
                            className="absolute right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
                            aria-label="Enter presentation mode">
                            <Smile className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </form>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Presentation overlay */}
      <AnimatePresence>
        {presentationMode && (
          <motion.div
            key="presentation-overlay"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Exit button */}
            <button
              type="button"
              onClick={() => { setPresentationMode(false); stopSpeaking() }}
              className="absolute top-4 right-4 flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-muted hover:border-border/80"
            >
              <X className="h-3.5 w-3.5" />
              Exit
            </button>

            {/* Face */}
            <AudienceFace state={faceState} analyserNode={recorder.analyserNode} size={280} emotion={currentEmotion} />

            {/* Caption area — audience thoughts when idle, current sentence when speaking */}
            <div className="mt-4 flex h-12 items-center justify-center px-6">
              <AnimatePresence mode="wait">
                {isTTSSpeaking && ttsCaption ? (
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
                ) : (
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
                )}
              </AnimatePresence>
            </div>

            {/* Record controls */}
            <div className="mt-8 flex items-center justify-center">
              {(faceState === "idle" || faceState === "satisfied") && (
                <button
                  type="button"
                  onClick={() => { setSatisfiedWindow(false); handleStartRecording() }}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-5 py-2.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Continue
                </button>
              )}

              {recorder.isRecording && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
                  </div>
                  <div className="w-40">
                    <AudioWaveform analyser={recorder.analyserNode} />
                  </div>
                  <span className="flex-shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
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
                    onClick={handleStopRecording}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                    aria-label="Stop recording and send"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide panel */}
      <AnimatePresence>
        {hasSlidePanel && (
          <motion.div key="slide-panel"
            className="absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden border-l border-border/60 bg-background md:w-[62%]"
            initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            <SlidePanel slideReview={slideReview} onClose={slideReview.closePanel} onReset={slideReview.reset} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="video/*,audio/*,.pdf,application/pdf" onChange={handleFileUpload} className="hidden" aria-label="Upload video, audio, or PDF" />
      <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" onChange={handlePdfUpload} className="hidden" aria-label="Upload PDF slides" />

      {/* Trial limit dialog */}
      <Dialog open={showTrialDialog} onOpenChange={setShowTrialDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You&apos;ve used your free messages</DialogTitle>
            <DialogDescription>Create a free account to keep coaching with Vera.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <a href="/login" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
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
            <DialogDescription>You&apos;ve used all 20 of your daily messages. Upgrade to Pro for unlimited access.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <a href="/premium" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Upgrade to Pro
            </a>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
