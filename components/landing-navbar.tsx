"use client"

import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"

export function LandingNavbar() {
  const { user } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-foreground">
          Demian
        </Link>

        {!user && (
          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign up
          </Link>
        )}
      </div>
    </nav>
  )
}
