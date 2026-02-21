"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { LandingNavbar } from "@/components/landing-navbar"
import { CoachingInterface } from "@/components/coaching-interface"
import { About } from "@/components/about"
import { HowItWorks } from "@/components/how-it-works"
import { Stats } from "@/components/stats"
import { Footer } from "@/components/footer"

export default function Page() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [idToken, setIdToken] = useState<string | null>(null)
  const [chatActive, setChatActive] = useState(false)

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken)
    } else {
      setIdToken(null)
    }
  }, [user])

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace("/chat")
    }
  }, [user, loading, router])

  const handleChatStart = useCallback(() => {
    setChatActive(true)
  }, [])

  if (loading || user) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const isTrialMode = !user

  return (
    <>
      <LandingNavbar />
      <section className="flex h-dvh flex-col overflow-x-hidden pt-[70px]">
        <CoachingInterface
          authToken={isTrialMode ? null : idToken}
          isTrialMode={isTrialMode}
          onChatStart={handleChatStart}
        />
      </section>
      {!chatActive && (
        <>
          <main>
            <About />
            <HowItWorks />
            <Stats />
          </main>
          <Footer />
        </>
      )}
    </>
  )
}
