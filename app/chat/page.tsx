"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { ChatNavbar } from "@/components/chat-navbar"
import { CoachingInterface } from "@/components/coaching-interface"

function ChatContent() {
  const { user, loading, plan, refreshSubscription } = useAuth()
  const [idToken, setIdToken] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken)
    } else {
      setIdToken(null)
    }
  }, [user])

  // Handle post-checkout success: verify the session server-side, then refresh local state
  useEffect(() => {
    if (loading) return // wait for auth to resolve before verifying
    if (searchParams.get("checkout") !== "success") return
    const sessionId = searchParams.get("session_id")

    async function verifyCheckout() {
      if (user && sessionId) {
        try {
          const token = await user.getIdToken()
          const res = await fetch("/api/verify-checkout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ session_id: sessionId }),
          })

          if (!res.ok) {
            console.error("Checkout verification failed:", await res.text())
          }
        } catch (err) {
          console.error("Checkout verification error:", err)
        }
      }

      await refreshSubscription()
      toast.success("Welcome to Pro! You now have unlimited access.")
      window.history.replaceState({}, "", "/chat")
    }

    verifyCheckout()
  }, [searchParams, refreshSubscription, user, loading])

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
      <ChatNavbar isTrialMode={isTrialMode} plan={plan} />
      <CoachingInterface
        authToken={isTrialMode ? null : idToken}
        isTrialMode={isTrialMode}
      />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
