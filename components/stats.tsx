"use client"

import { ScrollReveal } from "@/components/motion"

const stats = [
  { value: "10+", label: "Audience personas" },
  { value: "92%", label: "Felt more prepared" },
  { value: "500+", label: "Presentations coached" },
  { value: "4.8", label: "Average rating" },
]

export function Stats() {
  return (
    <section className="px-6 py-32 md:py-44">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4 md:gap-0">
          {stats.map((stat, i) => (
            <ScrollReveal key={stat.label} direction="up" distance={40}>
              <div
                className={`group flex flex-col md:px-8 ${
                  i < stats.length - 1 ? "md:border-r md:border-border/40" : ""
                }`}
              >
                <span className="text-4xl font-bold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary md:text-5xl">
                  {stat.value}
                </span>
                <span className="mt-2 text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
