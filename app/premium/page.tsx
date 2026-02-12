"use client"

import { Check } from "lucide-react"

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
    cta: "Current Plan",
    highlighted: false,
    disabled: true,
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
    cta: "Upgrade to Pro",
    highlighted: true,
    disabled: false,
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
    cta: "Contact Sales",
    highlighted: false,
    disabled: false,
  },
]

export default function PremiumPage() {
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

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <a
            href="/"
            className="text-2xl font-bold tracking-tight text-foreground"
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
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 backdrop-blur-sm ${
                plan.highlighted
                  ? "border-primary bg-card shadow-xl shadow-primary/10"
                  : "border-border/60 bg-card/80"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}

              <h2 className="text-xl font-semibold text-foreground">
                {plan.name}
              </h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{plan.period}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
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
                disabled={plan.disabled}
                className={`mt-8 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25"
                    : plan.disabled
                      ? "cursor-default bg-muted text-muted-foreground"
                      : "border border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
