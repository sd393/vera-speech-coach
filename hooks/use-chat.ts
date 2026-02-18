"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { validateFile } from '@/backend/validation'
import { shouldExtractClientSide, extractAudioClientSide } from '@/lib/client-audio'

interface Attachment {
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
    'Welcome to Vera. I\'m your AI presentation coach. Tell me about the presentation you\'re preparing for — who\'s your audience, what\'s the context, and what are you hoping to achieve? Or upload a video/audio recording (max **500MB**) and I\'ll analyze it for you.',
}

export function useChat(authToken?: string | null) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [transcript, setTranscript] = useState<string | null>(null)
  const [researchContext, setResearchContext] = useState<string | null>(null)
  const [researchMeta, setResearchMeta] = useState<ResearchMeta | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialMessagesRemaining, setTrialMessagesRemaining] = useState<
    number | null
  >(null)
  const [trialLimitReached, setTrialLimitReached] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<Message[]>([INITIAL_MESSAGE])
  const transcriptRef = useRef<string | null>(null)
  const researchContextRef = useRef<string | null>(null)
  const authTokenRef = useRef<string | null>(null)

  // Keep refs in sync with state on each render
  messagesRef.current = messages
  transcriptRef.current = transcript
  researchContextRef.current = researchContext
  authTokenRef.current = authToken ?? null

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
            messages: currentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            transcript: currentTranscript ?? undefined,
            researchContext: researchContextRef.current ?? undefined,
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

      // Determine if we need to run research before the chat response
      const hasTranscript = transcriptRef.current !== null
      const hasResearch = researchContextRef.current !== null
      const uploadExists = updatedMessages.some((m) => m.attachment)
      const userTextMessages = updatedMessages.filter(
        (m) => m.role === 'user' && !m.attachment
      )
      // Trigger research when we have a transcript, no research yet, and the
      // user has sent at least 2 text messages (the first after upload answers
      // Vera's audience questions)
      const shouldResearch =
        hasTranscript && !hasResearch && uploadExists && userTextMessages.length >= 2

      if (shouldResearch) {
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
        const blob = await upload(fileToUpload.name, fileToUpload, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        })

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

        if (!newTranscript.trim()) {
          // Silent/blank recording — remove the dangling upload message
          const rolled = updatedMessages.slice(0, -1)
          messagesRef.current = rolled
          setMessages(rolled)
          setIsTranscribing(false)
          setError('No speech detected in the recording. Please try again with a recording that contains audible speech.')
          return
        }

        setTranscript(newTranscript)
        setIsTranscribing(false)

        // Automatically trigger a chat response now that we have the transcript
        await streamChatResponse(updatedMessages, newTranscript)
      } catch (err: unknown) {
        setIsCompressing(false)
        if (err instanceof Error && err.name === 'AbortError') {
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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const resetConversation = useCallback(() => {
    abortInFlight()
    setMessages([INITIAL_MESSAGE])
    setTranscript(null)
    setResearchContext(null)
    setResearchMeta(null)
    researchContextRef.current = null
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
    isCompressing,
    isTranscribing,
    isResearching,
    isStreaming,
    error,
    trialMessagesRemaining,
    trialLimitReached,
    sendMessage,
    uploadFile,
    clearError,
    resetConversation,
  }
}
