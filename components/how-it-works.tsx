"use client"

import { ScrollReveal, useParallax, motion, useTransform } from "@/components/motion"

const steps = [
  { number: "01", title: "Describe your audience" },
  { number: "02", title: "Upload your presentation" },
  { number: "03", title: "Get real feedback" },
]

export function HowItWorks() {
  const { ref, scrollYProgress, med } = useParallax()
  const lineWidth = useTransform(scrollYProgress, [0.2, 0.7], ["0%", "100%"])

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="relative overflow-hidden px-6 py-32 md:py-44"
    >
      {/* Dark background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, hsl(200 25% 8%) 0%, hsl(195 30% 11%) 100%)",
        }}
      />

      {/* Parallax glow */}
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-10 blur-3xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(circle, hsl(192 80% 55%), transparent 60%)" }}
        />
      </motion.div>

      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" distance={40}>
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Three steps.
          </h2>
        </ScrollReveal>

        <div className="relative mt-20">
          {/* Animated progress line */}
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-white/10 md:block">
            <motion.div className="h-full bg-primary/40" style={{ width: lineWidth }} />
          </div>

          <div className="grid gap-16 md:grid-cols-3 md:gap-0">
            {steps.map((step) => (
              <ScrollReveal key={step.number} direction="up" distance={50}>
                <div className="relative md:px-8">
                  <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-primary/10 hover:scale-110">
                    <span className="text-sm font-bold text-white/70">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    {step.title}
                  </h3>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal className="mt-20" direction="up" distance={30}>
          <a
            href="/login"
            className="inline-flex items-center rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            Try it free
          </a>
        </ScrollReveal>
      </div>
    </section>
  )
}
