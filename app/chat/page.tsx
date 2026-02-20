"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { ChatNavbar } from "@/components/chat-navbar"
import { CoachingInterface } from "@/components/coaching-interface"

export default function ChatPage() {
  const { user, loading } = useAuth()
  const [idToken, setIdToken] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken)
    } else {
      setIdToken(null)
    }
  }, [user])

  if (loading || (user && !idToken)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const isTrialMode = !user

  return (
    <div className="flex h-screen flex-col">
      <ChatNavbar isTrialMode={isTrialMode} />
      <CoachingInterface
        authToken={isTrialMode ? null : idToken}
        isTrialMode={isTrialMode}
      />
    </div>
  )
}
