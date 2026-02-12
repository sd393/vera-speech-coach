"use client"

import { useEffect } from "react"
import { User, Mail, CreditCard, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export default function AccountPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
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
    await signOut()
    router.push("/")
  }

  return (
    <div className="relative min-h-screen px-6 py-24">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(135deg, hsl(200 40% 95%) 0%, hsl(165 35% 95%) 50%, hsl(190 30% 96%) 100%)",
        }}
      />

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <a
            href="/"
            className="text-2xl font-bold tracking-tight text-foreground"
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
              <p className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground">
                {user.displayName || "—"}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </span>
              <p className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground">
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
              <p className="text-sm font-medium text-foreground">Free Plan</p>
              <p className="text-sm text-muted-foreground">
                3 presentations per month
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                disabled
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upgrade
              </button>
              <p className="text-xs text-muted-foreground">Coming soon</p>
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
