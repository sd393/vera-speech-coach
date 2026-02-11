"use client"

import { useState, useRef, useCallback } from 'react'
import { validateFile } from '@/backend/validation'

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

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

const INITIAL_MESSAGE: Message = {
  id: generateId(),
  role: 'assistant',
  content:
    'Welcome to Vera. I\'m your AI presentation coach. Tell me about the presentation you\'re preparing for — who\'s your audience, what\'s the context, and what are you hoping to achieve? Or upload a video/audio recording and I\'ll analyze it for you.',
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [transcript, setTranscript] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<Message[]>([INITIAL_MESSAGE])
  const transcriptRef = useRef<string | null>(null)

  // Keep refs in sync with state on each render
  messagesRef.current = messages
  transcriptRef.current = transcript

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
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            transcript: currentTranscript ?? undefined,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
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
              if (parsed.content) {
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

      await streamChatResponse(updatedMessages, transcriptRef.current)
    },
    [streamChatResponse]
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
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
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

        // Automatically trigger a chat response now that we have the transcript
        await streamChatResponse(updatedMessages, newTranscript)
      } catch (err: unknown) {
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
    setIsTranscribing(false)
    setIsStreaming(false)
    setError(null)
  }, [])

  return {
    messages,
    transcript,
    isTranscribing,
    isStreaming,
    error,
    sendMessage,
    uploadFile,
    clearError,
    resetConversation,
  }
}
