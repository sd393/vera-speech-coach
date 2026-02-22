"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { validateFile } from '@/backend/validation'
import { shouldExtractClientSide, extractAudioClientSide } from '@/lib/client-audio'

export interface Attachment {
  name: string
  type: string
  size: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachment?: Attachment
}

export interface ResearchMeta {
  searchTerms: string[]
  audienceSummary: string
  briefing: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

const INITIAL_MESSAGE: Message = {
  id: generateId(),
  role: 'assistant',
  content:
    "Hey — I'm Vera. I'll be your audience. Whenever you're ready, go ahead.",
}

export function useChat(authToken?: string | null) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [transcript, setTranscript] = useState<string | null>(null)
  const [researchContext, setResearchContext] = useState<string | null>(null)
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null)
  const [slideContext, setSlideContext] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialMessagesRemaining, setTrialMessagesRemaining] = useState<
    number | null
  >(null)
  const [trialLimitReached, setTrialLimitReached] = useState(false)
  const [freeLimitReached, setFreeLimitReached] = useState(false)
  const [awaitingAudience, setAwaitingAudience] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<Message[]>([INITIAL_MESSAGE])
  const transcriptRef = useRef<string | null>(null)
  const researchContextRef = useRef<string | null>(null)
  const slideContextRef = useRef<string | null>(null)
  const authTokenRef = useRef<string | null>(null)
  const awaitingAudienceRef = useRef(false)

  // Keep refs in sync with state on each render
  messagesRef.current = messages
  transcriptRef.current = transcript
  researchContextRef.current = researchContext
  slideContextRef.current = slideContext
  authTokenRef.current = authToken ?? null
  awaitingAudienceRef.current = awaitingAudience

  // On mount for trial users, check cookie for prior trial usage
  useEffect(() => {
    if (authToken) return
    const match = document.cookie.match(/vera_trial_remaining=(\d+)/)
    if (match) {
      const remaining = parseInt(match[1], 10)
      setTrialMessagesRemaining(remaining)
      if (remaining <= 0) {
        setTrialLimitReached(true)
      }
    }
  }, [authToken])

  function abortInFlight() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const streamChatResponse = useCallback(
    async (
      currentMessages: Message[],
      currentTranscript: string | null
    ) => {
      setIsStreaming(true)

      const assistantMessageId = generateId()
      setMessages((prev) => [
        ...prev,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ])

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        const token = authTokenRef.current
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: currentMessages
              .filter((m) => m.content !== '')
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
            transcript: currentTranscript ?? undefined,
            researchContext: researchContextRef.current ?? undefined,
            slideContext: slideContextRef.current ?? undefined,
            awaitingAudience: awaitingAudienceRef.current || undefined,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          if (err.code === 'trial_limit_reached') {
            setTrialLimitReached(true)
            setMessages((prev) =>
              prev.filter((m) => m.id !== assistantMessageId)
            )
            setIsStreaming(false)
            return
          }
          if (err.code === 'free_limit_reached') {
            setFreeLimitReached(true)
            setMessages((prev) =>
              prev.filter((m) => m.id !== assistantMessageId)
            )
            setIsStreaming(false)
            return
          }
          throw new Error(
            err.error || `Request failed with status ${response.status}`
          )
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accumulated = ''
        let rafId: number | null = null

        // Flush accumulated content to state via requestAnimationFrame
        function flushToState() {
          const snapshot = accumulated
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: snapshot }
                : m
            )
          )
          rafId = null
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') break

            try {
              const parsed = JSON.parse(data)
              if (parsed.trial_remaining !== undefined) {
                const remaining = parsed.trial_remaining as number
                setTrialMessagesRemaining(remaining)
                if (remaining <= 0) {
                  setTrialLimitReached(true)
                }
                document.cookie = `vera_trial_remaining=${remaining};path=/;max-age=2592000;SameSite=Lax`
              } else if (parsed.content) {
                accumulated += parsed.content
                // Batch state updates with rAF
                if (rafId === null) {
                  rafId = requestAnimationFrame(flushToState)
                }
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Final flush
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: accumulated }
              : m
          )
        )
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was intentionally cancelled
          return
        }
        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMessageId)
        )
        setError(
          err instanceof Error ? err.message : 'Something went wrong'
        )
      } finally {
        setIsStreaming(false)
      }
    },
    []
  )

  const runResearchPipeline = useCallback(
    async (currentTranscript: string, currentMessages: Message[]) => {
      setIsResearching(true)
      try {
        // Extract audience description from user text messages after the upload
        const uploadIndex = currentMessages.findIndex((m) => m.attachment)
        const audienceMessages = currentMessages
          .slice(uploadIndex + 1)
          .filter((m) => m.role === 'user')
          .map((m) => m.content)

        if (audienceMessages.length === 0) return null

        const audienceDescription = audienceMessages.join('\n')

        console.log('[research] Starting pipeline...', { audienceDescription })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        const token = authTokenRef.current
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch('/api/research', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            transcript: currentTranscript,
            audienceDescription,
          }),
        })

        if (!response.ok) {
          console.warn('[research] Pipeline failed:', response.status)
          return null
        }

        const data = await response.json()

        console.log('[research] Pipeline complete:', {
          audienceSummary: data.audienceSummary,
          searchTerms: data.searchTerms,
          briefingLength: data.researchContext?.length,
        })

        setResearchContext(data.researchContext)
        researchContextRef.current = data.researchContext
        setResearchMeta({
          searchTerms: data.searchTerms,
          audienceSummary: data.audienceSummary,
          briefing: data.researchContext,
        })
        return data.researchContext as string
      } catch {
        console.warn('[research] Pipeline error, proceeding without enrichment')
        return null
      } finally {
        setIsResearching(false)
      }
    },
    []
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      abortInFlight()

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
      }

      // Read latest messages from ref to avoid stale closure issues
      const updatedMessages = [...messagesRef.current, userMessage]
      messagesRef.current = updatedMessages
      setMessages(updatedMessages)

      // When the user answers the audience question, clear awaitingAudience,
      // run research with their answer, then stream the full reaction
      const isAnsweringAudience = awaitingAudienceRef.current
      if (isAnsweringAudience) {
        setAwaitingAudience(false)
        awaitingAudienceRef.current = false

        await runResearchPipeline(transcriptRef.current!, updatedMessages)
      }

      await streamChatResponse(updatedMessages, transcriptRef.current)
    },
    [streamChatResponse, runResearchPipeline]
  )

  const uploadFile = useCallback(
    async (file: File) => {
      // Client-side validation
      const validation = validateFile({
        name: file.name,
        type: file.type,
        size: file.size,
      })

      if (!validation.valid) {
        setError(validation.error)
        return
      }

      abortInFlight()
      setIsTranscribing(true)
      setError(null)

      // Add the user's upload message
      const uploadMessage: Message = {
        id: generateId(),
        role: 'user',
        content: 'Uploaded a recording for review',
        attachment: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
      }

      const updatedMessages = [...messagesRef.current, uploadMessage]
      messagesRef.current = updatedMessages
      setMessages(updatedMessages)

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        // For large videos, extract audio client-side to reduce upload size
        let fileToUpload: File = file
        if (shouldExtractClientSide(file)) {
          setIsCompressing(true)
          const compressed = await extractAudioClientSide(file)
          setIsCompressing(false)
          if (compressed) {
            fileToUpload = compressed
          }
        }

        // Upload file directly to Vercel Blob (bypasses serverless body limit)
        // Retry once on transient failure (CDN hiccup, cold-start timeout, etc.)
        let blob: { url: string }
        try {
          blob = await upload(fileToUpload.name, fileToUpload, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          })
        } catch {
          await new Promise((r) => setTimeout(r, 1000))
          blob = await upload(fileToUpload.name, fileToUpload, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          })
        }

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: blob.url, fileName: fileToUpload.name }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(
            err.error || `Transcription failed with status ${response.status}`
          )
        }

        const data = await response.json()
        const newTranscript = data.transcript as string

        setTranscript(newTranscript)
        setIsTranscribing(false)

        // Update the upload message to include the transcript for conversation context
        const updatedWithTranscript = updatedMessages.map(m =>
          m.id === uploadMessage.id
            ? { ...m, content: `[Presentation transcript]\n${newTranscript}` }
            : m
        )
        messagesRef.current = updatedWithTranscript
        setMessages(updatedWithTranscript)

        // Set awaitingAudience so the model asks who the audience is
        // instead of giving a full reaction immediately
        setAwaitingAudience(true)
        awaitingAudienceRef.current = true

        // Trigger a chat response — the model will ask about the audience
        await streamChatResponse(updatedWithTranscript, newTranscript)
      } catch (err: unknown) {
        setIsCompressing(false)
        // Only silently swallow abort if WE intentionally canceled (user
        // started a new action). AbortErrors from the Vercel Blob client or
        // browser-level timeouts should surface as visible errors.
        if (
          err instanceof Error &&
          err.name === 'AbortError' &&
          controller.signal.aborted
        ) {
          setIsTranscribing(false)
          return
        }
        setError(
          err instanceof Error ? err.message : 'Failed to transcribe file'
        )
        setIsTranscribing(false)
      }
    },
    [streamChatResponse]
  )

  // Add a message to the timeline without triggering a chat completion.
  // Used for PDF uploads that open the slide panel instead of sending to the AI.
  // Returns the generated message ID so callers can associate state with this message.
  const addMessage = useCallback(
    (content: string, attachment?: Attachment): string => {
      const id = generateId()
      const message: Message = {
        id,
        role: 'user',
        content,
        ...(attachment ? { attachment } : {}),
      }
      const updated = [...messagesRef.current, message]
      messagesRef.current = updated
      setMessages(updated)
      return id
    },
    []
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const resetConversation = useCallback(() => {
    abortInFlight()
    setMessages([INITIAL_MESSAGE])
    setTranscript(null)
    setResearchContext(null)
    setResearchMeta(null)
    setSlideContext(null)
    researchContextRef.current = null
    slideContextRef.current = null
    setAwaitingAudience(false)
    awaitingAudienceRef.current = false
    setIsCompressing(false)
    setIsTranscribing(false)
    setIsResearching(false)
    setIsStreaming(false)
    setError(null)
  }, [])

  return {
    messages,
    transcript,
    researchContext,
    researchMeta,
    slideContext,
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
    resetConversation,
  }
}
