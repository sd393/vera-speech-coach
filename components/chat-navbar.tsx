"use client"

import Link from "next/link"

interface ChatNavbarProps {
  isTrialMode?: boolean
}

export function ChatNavbar({ isTrialMode }: ChatNavbarProps) {
  return (
    <nav className="flex-shrink-0 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="font-display text-xl font-bold tracking-tight text-foreground">
          Vera
        </a>
        <div className="flex items-center gap-4">
          {isTrialMode ? (
            <a
              href="/login"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </a>
          ) : (
            <Link
              href="/account"
              className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
            >
              Account
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
