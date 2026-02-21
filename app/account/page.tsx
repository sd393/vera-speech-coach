"use client"

import { useEffect, useRef, useState } from "react"
import { User, Mail, CreditCard, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

export default function AccountPage() {
  const router = useRouter()
  const { user, loading, plan, subscriptionLoading, signOut } = useAuth()
  const isSigningOut = useRef(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!loading && !user && !isSigningOut.current) {
      router.replace("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  async function handleSignOut() {
    isSigningOut.current = true
    await signOut()
    router.replace("/")
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const token = await user!.getIdToken()
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to open billing portal")
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPortalLoading(false)
    }
  }

  const planLabel = plan === "pro" ? "Pro Plan" : "Free Plan"
  const planDescription =
    plan === "pro"
      ? "Unlimited presentations and advanced features"
      : "Basic presentation feedback"

  return (
    <div className="relative min-h-screen px-6 py-24">
      {/* Subtle warm glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-background"
        aria-hidden="true"
      >
        <div
          className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(36 72% 50%), transparent 70%)" }}
        />
        <div
          className="absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(34 50% 68%), transparent 70%)" }}
        />
      </div>

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <a
            href="/"
            className="font-display text-2xl font-bold tracking-tight text-foreground"
          >
            Vera
          </a>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
            Account Settings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your profile and preferences
          </p>
        </div>

        {/* Profile section */}
        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3 border-b border-border/60 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
              <p className="text-sm text-muted-foreground">
                Your personal information
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Name
              </span>
              <p className="rounded-lg border border-border bg-muted px-4 py-2.5 text-sm text-foreground">
                {user.displayName || "—"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </span>
              <p className="rounded-lg border border-border bg-muted px-4 py-2.5 text-sm text-foreground">
                {user.email || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription section */}
        <div className="mt-8 rounded-2xl border border-border/60 bg-card/80 p-8 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3 border-b border-border/60 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Subscription
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage your plan and billing
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {subscriptionLoading ? "Loading…" : planLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {planDescription}
              </p>
            </div>
            <div>
              {plan === "pro" ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {portalLoading ? "Loading…" : "Manage Subscription"}
                </button>
              ) : (
                <button
                  onClick={() => router.push("/premium")}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <div className="mt-8">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
