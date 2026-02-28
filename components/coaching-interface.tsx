"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import { buildAuthHeaders } from "@/lib/api-utils"
import { saveSession, type SessionScores, type SessionScoresV2 } from "@/lib/sessions"
import { useCoachingSession } from "@/hooks/use-coaching-session"
import { formatAnalyticsSummary } from "@/lib/format-delivery-analytics"
import { useRecorder } from "@/hooks/use-recorder"
import { useSlideReview } from "@/hooks/use-slide-review"
import { useContextFile } from "@/hooks/use-context-file"
import { formatSlideContextForChat } from "@/lib/format-utils"
import { isValidFaceEmotion, type FaceState, type FaceEmotion } from "@/components/audience-face"
import type { SetupContext } from "@/lib/coaching-stages"
import { SetupWizard } from "@/components/setup-wizard"
import { PresentationOverlay } from "@/components/presentation-overlay"

const SlidePanel = dynamic(() => import("@/components/slide-panel").then(m => ({ default: m.SlidePanel })))

/* ── Thinking labels ── */

const LABELS_COMPRESSING = [
  "Listening closely...",
  "Tuning in...",
  "Catching every word...",
]
const LABELS_TRANSCRIBING = [
  "Taking it all in...",
  "Processing what you said...",
  "Absorbing your points...",
]
const LABELS_RESEARCHING = [
  "Getting to know your audience...",
  "Doing some homework...",
  "Learning about who you're talking to...",
]
const LABELS_STREAMING = [
  "Gathering thoughts...",
  "Thinking this through...",
  "Considering what to say...",
  "Mulling it over...",
]
const LABELS_TTS = [
  "Finding the right words...",
  "Putting thoughts together...",
  "Almost ready...",
]
const LABELS_DEFAULT = [
  "Hmm, let me think...",
  "One moment...",
  "Processing...",
  "Thinking about that...",
]

/* ── Props ── */

interface CoachingInterfaceProps {
  authToken?: string | null
}

export function CoachingInterface({ authToken }: CoachingInterfaceProps) {
  const router = useRouter()

  const {
    messages, researchMeta, researchSearchTerms, researchContext, deliveryAnalytics, isCompressing, isTranscribing, isResearching, isStreaming,
    error,
    stage, transcript, setupContext: chatSetupContext, slideContext,
    audiencePulseHistory, appendPulseLabels,
    sendMessage, uploadFile, addMessage, setSlideContext, clearError,
    startPresentation, finishPresentation, startResearchEarly,
  } = useCoachingSession(authToken)

  const { user } = useAuth()
  const recorder = useRecorder()
  const slideReview = useSlideReview(authToken)
  const contextFileHook = useContextFile(authToken)
  const hasSlidePanel = slideReview.panelOpen

  /* ── State ── */
  const [presentationMode, setPresentationMode] = useState(false)
  const [navigatingToFeedback, setNavigatingToFeedback] = useState(false)
  const sessionSaveTriggered = useRef(false)
  const presentationCommittedRef = useRef(false)
  const pendingUploadRef = useRef(false)
  const recordingInputRef = useRef<HTMLInputElement>(null)

  // Saved setup context — persists after SetupWizard unmounts
  const savedSetupRef = useRef<{ context: SetupContext | null; message: string | null }>({ context: null, message: null })

  /* ── Audience pulse ── */
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

  // Stable ref to messages for use in callbacks
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const bad = messages.find(m => m.content === undefined)
      if (bad) console.warn('[DEBUG] Message with undefined content:', bad)
    }
  }, [messages])

  function fetchPulseLabels(overrideMessages?: { role: string; content: string }[]) {
    const recent = overrideMessages ?? messagesRef.current
      .filter(m => m.content?.trim())
      .slice(-4)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
    if (recent.length === 0) return
    fetch("/api/audience-pulse", {
      method: "POST",
      headers: buildAuthHeaders(),
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
            if (l && typeof l === "object" && "text" in l) {
              const obj = l as { text: unknown; emotion?: unknown }
              const text = typeof obj.text === "string" ? obj.text : ""
              const emotion: FaceEmotion = isValidFaceEmotion(obj.emotion) ? obj.emotion : "neutral"
              return text ? { text, emotion } : null
            }
            if (typeof l === "string") return { text: l, emotion: "neutral" as FaceEmotion }
            return null
          })
          .filter((l): l is { text: string; emotion: FaceEmotion } => l !== null)
        if (validLabels.length > 0) {
          setPulseLabels(validLabels)
          setPulseIndex(0)
          appendPulseLabels(validLabels)
        }
      })
      .catch((err) => { console.warn("[audience-pulse] failed:", err) })
  }

  /* ── TTS functions ── */

  const ttsSentencesRef = useRef<{ text: string; start: number; end: number }[]>([])
  const ttsAbortRef = useRef<AbortController | null>(null)

  function speakText(text: string) {
    stopSpeaking()
    setIsTTSLoading(true)

    ttsAbortRef.current?.abort()
    const controller = new AbortController()
    ttsAbortRef.current = controller

    fetch("/api/tts", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`TTS failed: ${res.status}`)
        return res.json()
      })
      .then(({ audio, sentences }: { audio: string; sentences: { text: string; start: number; end: number }[] }) => {
        if (controller.signal.aborted) return

        ttsSentencesRef.current = sentences
        if (sentences.length > 0) setTtsCaption(sentences[0].text)

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
          toast.error("Browser blocked audio playback. Tap anywhere and try again.")
        })
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setIsTTSLoading(false)
        setTtsCaption("")
        toast.error("Vera's voice is unavailable right now.")
      })
  }

  function stopSpeaking() {
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current = null
    }
    setIsTTSLoading(false)
    setIsTTSSpeaking(false)
    setTtsCaption("")
    ttsSentencesRef.current = []
  }

  /* ── Post-streaming effects ── */

  useEffect(() => {
    if (prevStreaming.current && !isStreaming) {
      prevStreaming.current = false

      let t: ReturnType<typeof setTimeout> | undefined
      if (!presentationModeRef.current) {
        setSatisfiedWindow(true)
        t = setTimeout(() => setSatisfiedWindow(false), 2000)
      }

      fetchPulseLabels()

      if (presentationModeRef.current) {
        const lastAssistant = [...messagesRef.current].reverse().find(m => m.role === "assistant" && m.content)
        if (lastAssistant?.content) speakText(lastAssistant.content)
      }

      return () => { if (t) clearTimeout(t) }
    }
    prevStreaming.current = isStreaming
  }, [isStreaming, messages]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle through pulse labels
  useEffect(() => {
    if (pulseLabels.length <= 1) return
    const t = setInterval(() => setPulseIndex(i => (i + 1) % pulseLabels.length), 4000)
    return () => clearInterval(t)
  }, [pulseLabels])

  /* ── Held processing state ── */

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

  const isBusy = useMemo(() => isCompressing || isTranscribing || isResearching || isStreaming, [isCompressing, isTranscribing, isResearching, isStreaming])
  const isEmptyState = messages.length === 0

  const faceState: FaceState = recorder.isRecording ? "listening"
    : isProcessingHeld ? "thinking"
    : ((!presentationMode && isStreaming) || isTTSSpeaking) ? "speaking"
    : satisfiedWindow ? "satisfied"
    : "idle"

  // Pick a label once per thinking phase, not per render
  const thinkingPhaseKey = isCompressing ? "compress"
    : isTranscribing ? "transcribe"
    : isResearching ? "research"
    : (presentationMode && isStreaming) ? "stream"
    : isTTSLoading ? "tts"
    : isProcessingHeld ? "default"
    : ""
  const thinkingLabelRef = useRef({ key: "", label: "" })
  if (thinkingPhaseKey && thinkingPhaseKey !== thinkingLabelRef.current.key) {
    const pool = isCompressing ? LABELS_COMPRESSING
      : isTranscribing ? LABELS_TRANSCRIBING
      : isResearching ? LABELS_RESEARCHING
      : (presentationMode && isStreaming) ? LABELS_STREAMING
      : isTTSLoading ? LABELS_TTS
      : LABELS_DEFAULT
    thinkingLabelRef.current = { key: thinkingPhaseKey, label: pool[Math.floor(Math.random() * pool.length)] }
  }
  const thinkingLabel = thinkingLabelRef.current.label || "Thinking..."

  // Audience pulse label + emotion for presentation overlay
  const currentPulse = pulseLabels[pulseIndex] ?? null
  const currentEmotion: FaceEmotion = currentPulse?.emotion ?? "neutral"
  const audienceLabel = presentationMode
    ? (currentPulse?.text ?? null)
    : (currentPulse?.text
      ?? researchMeta?.audienceSummary
      ?? (slideReview.deckSummary?.audienceAssumed ? `Presenting to ${slideReview.deckSummary.audienceAssumed}` : null)
      ?? "In the room with you")

  /* ── Session save ── */

  async function saveAndNavigateToFeedback() {
    if (sessionSaveTriggered.current) return
    sessionSaveTriggered.current = true
    setNavigatingToFeedback(true)

    if (!user) {
      toast.error("You must be logged in to save a session")
      sessionSaveTriggered.current = false
      setNavigatingToFeedback(false)
      return
    }

    const savedCtx = savedSetupRef.current.context
    const topic = chatSetupContext?.topic || savedCtx?.topic || "Untitled presentation"
    const audience = chatSetupContext?.audience || savedCtx?.audience || "General audience"
    const goal = chatSetupContext?.goal || savedCtx?.goal || "Deliver effectively"
    const additionalContext = chatSetupContext?.additionalContext || savedCtx?.additionalContext || undefined
    const fileContext = chatSetupContext?.fileContext || savedCtx?.fileContext || undefined

    const setup = {
      topic,
      audience,
      goal,
      ...(additionalContext ? { additionalContext } : {}),
      ...(fileContext ? { fileContext } : {}),
    }

    const strippedMessages = messages
      .filter((m) => m.content?.trim())
      .map((m) => ({ role: m.role, content: m.content }))

    const slideReviewPayload = slideReview.deckSummary
      ? {
          raw: slideContext ?? formatSlideContextForChat(slideReview.deckSummary, slideReview.slideFeedbacks),
          deckSummary: slideReview.deckSummary,
          slideFeedbacks: slideReview.slideFeedbacks,
          ...(slideReview.blobUrl ? { blobUrl: slideReview.blobUrl } : {}),
          ...(slideReview.fileName ? { fileName: slideReview.fileName } : {}),
        }
      : slideContext ? { raw: slideContext } : null

    if (slideReview.blobUrl) slideReview.markBlobPersisted(slideReview.blobUrl)

    const sessionPayload = {
      userId: user.uid,
      setup,
      transcript: transcript ?? null,
      messages: strippedMessages,
      audiencePulse: audiencePulseHistory,
      slideReview: slideReviewPayload,
      researchContext: researchContext ?? null,
      scores: null as SessionScores | SessionScoresV2 | null,
      deliveryAnalyticsSummary: deliveryAnalytics ? formatAnalyticsSummary(deliveryAnalytics) : null,
    }

    let sessionId: string
    try {
      sessionId = await saveSession(sessionPayload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[session-save] Firestore save failed:", err)
      toast.error(`Failed to save session: ${msg}`)
      sessionSaveTriggered.current = false
      setNavigatingToFeedback(false)
      return
    }

    router.push(`/feedback/${sessionId}`)
  }

  // When feedback completes (stage → followup), save and navigate
  useEffect(() => {
    if (stage === "followup" && !sessionSaveTriggered.current) {
      saveAndNavigateToFeedback()
    }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Effects ── */

  useEffect(() => { if (error) { toast.error(error); clearError() } }, [error, clearError])
  useEffect(() => { if (slideReview.error) toast.error(slideReview.error) }, [slideReview.error])

  // Fetch pulse labels after transcription completes in presentation mode
  const prevTranscribingRef = useRef(false)
  useEffect(() => {
    if (prevTranscribingRef.current && !isTranscribing && presentationMode) {
      fetchPulseLabels()
    }
    prevTranscribingRef.current = isTranscribing
  }, [isTranscribing, presentationMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (slideReview.deckSummary && slideReview.slideFeedbacks.length > 0) {
      setSlideContext(formatSlideContextForChat(slideReview.deckSummary, slideReview.slideFeedbacks))
    }
  }, [slideReview.deckSummary, slideReview.slideFeedbacks, setSlideContext])

  useEffect(() => {
    return () => { ttsAudioRef.current?.pause(); ttsAudioRef.current = null }
  }, [])

  /* ── Handlers ── */

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) { pendingUploadRef.current = false; return }

    if (pendingUploadRef.current) {
      pendingUploadRef.current = false
      const context = savedSetupRef.current.message
      if (context) addMessage(context)
      setNavigatingToFeedback(true)
    }

    uploadFile(file)
    if (recordingInputRef.current) recordingInputRef.current.value = ""
  }

  function commitPresentation() {
    if (presentationCommittedRef.current) return
    presentationCommittedRef.current = true
    const setupCtx = savedSetupRef.current.context
    const contextMsg = savedSetupRef.current.message
    if (setupCtx) startPresentation(setupCtx)
    if (contextMsg) addMessage(contextMsg)
  }

  async function handleStartRecording() {
    if (isBusy || recorder.isRecording) return
    commitPresentation()
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
    if (file) {
      setIsProcessingHeld(true)
      clearTimeout(holdTimerRef.current)
      uploadFile(file)
    }
  }

  function handleModeSelectFromWizard(
    mode: "present" | "upload-recording",
    setupCtx: SetupContext | null,
    contextMsg: string | null
  ) {
    // Merge extracted file context into setup context
    if (contextFileHook.extractedText) {
      if (setupCtx) {
        setupCtx = { ...setupCtx, fileContext: contextFileHook.extractedText }
      } else {
        setupCtx = { fileContext: contextFileHook.extractedText }
      }
    }
    savedSetupRef.current = { context: setupCtx, message: contextMsg }

    if (mode === "present") {
      presentationCommittedRef.current = true
      setPresentationMode(true)
      if (setupCtx) startPresentation(setupCtx)
      if (contextMsg) addMessage(contextMsg)
      if (contextMsg) fetchPulseLabels([{ role: "user", content: `I'm about to present to you. ${contextMsg}` }])
      return
    }

    if (mode === "upload-recording") {
      pendingUploadRef.current = true
      recordingInputRef.current?.click()
      return
    }
  }

  function handlePresentationSlideUpload(file: File) {
    const ctx = savedSetupRef.current.context
    const parts: string[] = []
    if (ctx?.topic) parts.push(ctx.topic)
    if (ctx?.audience) parts.push(`Audience: ${ctx.audience}`)
    if (ctx?.goal) parts.push(`Goal: ${ctx.goal}`)
    const audienceContext = parts.length > 0 ? parts.join(". ") : undefined
    slideReview.uploadAndAnalyze(file, audienceContext)
  }

  function handlePresentationFinish() {
    stopSpeaking()
    setNavigatingToFeedback(true)
    setPresentationMode(false)
    finishPresentation()
  }

  /* ── Render ── */

  return (
    <div className="relative flex flex-1 overflow-hidden bg-background">
      <div
        className="flex flex-1 flex-col overflow-hidden min-w-0"
        style={{ marginRight: hasSlidePanel ? "62%" : 0, transition: "margin-right 0.45s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <AnimatePresence mode="wait">
          {isEmptyState ? (
            <SetupWizard
              isResearching={isResearching}
              researchMeta={researchMeta}
              researchSearchTerms={researchSearchTerms}
              isCompressing={isCompressing}
              isTranscribing={isTranscribing}
              onResearchStart={startResearchEarly}
              onModeSelect={handleModeSelectFromWizard}
              contextFile={contextFileHook.contextFile}
              isExtractingContext={contextFileHook.isExtracting}
              contextFileError={contextFileHook.error}
              onContextFileUpload={contextFileHook.uploadContextFile}
              onContextFileRemove={contextFileHook.removeContextFile}
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* Presentation overlay */}
      <AnimatePresence>
        {presentationMode && (
          <PresentationOverlay
            faceState={faceState}
            currentEmotion={currentEmotion}
            audienceLabel={audienceLabel}
            thinkingLabel={thinkingLabel}
            isTTSSpeaking={isTTSSpeaking}
            ttsCaption={ttsCaption}
            isBusy={isBusy}
            transcript={transcript}
            stage={stage}
            recorder={recorder}
            slideReview={slideReview}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onFinish={handlePresentationFinish}
            onSlideUpload={handlePresentationSlideUpload}
          />
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

      {/* Hidden file input */}
      <input ref={recordingInputRef} type="file" accept="video/*,audio/*" onChange={handleFileUpload} className="hidden" aria-label="Upload video or audio recording" />

      {/* Transition overlay */}
      {navigatingToFeedback && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          <p className="mt-4 text-sm text-muted-foreground">Preparing your feedback...</p>
        </div>
      )}

    </div>
  )
}
