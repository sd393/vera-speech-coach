"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic presentation feedback",
    features: [
      "3 presentations per month",
      "Basic audience simulation",
      "Text-based feedback",
      "Standard response time",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per month",
    description: "For professionals who present regularly",
    features: [
      "Unlimited presentations",
      "Advanced audience personas",
      "Detailed scoring & analytics",
      "Priority response time",
      "Audio & video uploads up to 500MB",
      "Presentation history",
    ],
    highlighted: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "per month",
    description: "Collaborate and coach your entire team",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared audience templates",
      "Team analytics dashboard",
      "Admin controls",
      "Priority support",
    ],
    highlighted: false,
  },
]

export default function PremiumPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, plan, loading } = useAuth()
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("checkout") === "canceled") {
      toast.info("Checkout canceled. You can try again anytime.")
      window.history.replaceState({}, "", "/premium")
    }
  }, [searchParams])

  async function handleUpgrade() {
    if (!user) {
      router.push("/login?redirect=/premium")
      return
    }

    setCheckoutLoading(true)
    try {
      const token = await user.getIdToken()
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to start checkout")
      }

      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setCheckoutLoading(false)
    }
  }

  function getCtaText(planName: string) {
    if (planName === "Free") {
      if (plan === "free" || !user) return "Current Plan"
      return "Current Plan"
    }
    if (planName === "Pro") {
      if (plan === "pro") return "Current Plan"
      return "Upgrade to Pro"
    }
    return "Contact Sales"
  }

  function isDisabled(planName: string) {
    if (planName === "Free") return true
    if (planName === "Pro") return plan === "pro" || checkoutLoading
    return false
  }

  function handleClick(planName: string) {
    if (planName === "Pro" && plan !== "pro") {
      handleUpgrade()
    }
  }

  return (
    <div className="relative min-h-screen px-6 py-24">
      {/* Dark background with warm glow */}
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

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <a
            href="/"
            className="font-display text-2xl font-bold tracking-tight text-foreground"
          >
            Vera
          </a>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Choose your plan
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Upgrade to unlock unlimited rehearsals and advanced feedback
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border p-8 backdrop-blur-sm ${
                p.highlighted
                  ? "border-primary bg-card shadow-xl shadow-primary/10"
                  : "border-border/60 bg-card/80"
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}

              <h2 className="text-xl font-semibold text-foreground">
                {p.name}
              </h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {p.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{p.period}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {p.description}
              </p>

              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {p.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-foreground"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                disabled={isDisabled(p.name)}
                onClick={() => handleClick(p.name)}
                className={`mt-8 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  p.highlighted && plan !== "pro"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
                    : isDisabled(p.name)
                      ? "cursor-default bg-muted text-muted-foreground"
                      : "border border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {checkoutLoading && p.name === "Pro" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Redirecting…
                  </span>
                ) : (
                  getCtaText(p.name)
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
