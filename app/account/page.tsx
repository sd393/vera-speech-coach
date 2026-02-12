"use client"

import { useState } from "react"
import { User, Mail, Lock, CreditCard, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AccountPage() {
  const router = useRouter()
  const [name, setName] = useState("Jane Doe")
  const [email, setEmail] = useState("jane@example.com")

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

          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-6 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="name"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              type="submit"
              className="mt-2 self-start rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Save Changes
            </button>
          </form>
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
            <a
              href="/premium"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Upgrade
            </a>
          </div>
        </div>

        {/* Sign out */}
        <div className="mt-8">
          <button
            onClick={() => router.push("/")}
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
