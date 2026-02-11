"use client"

import React from "react"

import { useState, useRef, useEffect, type FormEvent } from "react"
import ReactMarkdown from "react-markdown"
import { Send, Paperclip, FileVideo, FileAudio, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useChat } from "@/hooks/use-chat"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatInterface() {
  const {
    messages,
    isCompressing,
    isTranscribing,
    isStreaming,
    error,
    sendMessage,
    uploadFile,
    clearError,
  } = useChat()

  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBusy = isCompressing || isTranscribing || isStreaming

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTranscribing, isStreaming])

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isBusy) return

    setInput("")
    sendMessage(trimmed)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    uploadFile(file)

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-0"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] ${
                  msg.role === "user"
                    ? "rounded-2xl rounded-br-md bg-primary px-5 py-3 text-primary-foreground"
                    : "rounded-2xl rounded-bl-md border border-border/60 bg-card px-5 py-3 text-card-foreground"
                }`}
              >
                {/* Attachment card */}
                {msg.attachment && (
                  <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2">
                    {msg.attachment.type.startsWith("video") ? (
                      <FileVideo className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <FileAudio className="h-5 w-5 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {msg.attachment.name}
                      </p>
                      <p className="text-xs opacity-70">
                        {formatFileSize(msg.attachment.size)}
                      </p>
                    </div>
                  </div>
                )}

                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Compressing indicator */}
          {isCompressing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-5 py-3 text-card-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Compressing audio...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transcription indicator */}
          {isTranscribing && !isCompressing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-5 py-3 text-card-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Transcribing your recording...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Streaming indicator — shown only when streaming hasn't produced content yet */}
          {isStreaming &&
            messages.length > 0 &&
            messages[messages.length - 1].role === "assistant" &&
            messages[messages.length - 1].content === "" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-5 py-3 text-card-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Simulating...
                    </span>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border/50 bg-background/80 px-4 py-4 backdrop-blur-sm">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-3xl items-center gap-3"
        >
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload video or audio file"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Attach a file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Text input */}
          <div className="flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Type your message..."
              rows={1}
              disabled={isBusy}
              className="h-10 w-full resize-none rounded-lg border border-input bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={!input.trim() || isBusy}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50 disabled:shadow-none"
            aria-label="Send message"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
