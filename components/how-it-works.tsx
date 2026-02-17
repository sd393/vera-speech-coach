"use client"

import { ScrollReveal, useParallax, motion, useTransform } from "@/components/motion"

const steps = [
  { number: "01", title: "Describe" },
  { number: "02", title: "Present" },
  { number: "03", title: "Get feedback" },
]

export function HowItWorks() {
  const { ref, scrollYProgress, med, slow, neg } = useParallax()
  const lineWidth = useTransform(scrollYProgress, [0.15, 0.55], ["0%", "100%"])
  const rotate1 = useTransform(scrollYProgress, [0, 1], [-15, 15])
  const rotate2 = useTransform(scrollYProgress, [0, 1], [10, -30])

  return (
    <section
      ref={ref}
      id="how-it-works"
      className="relative overflow-hidden px-6 py-14 md:py-20"
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

      {/* Floating geometric accents */}
      <motion.div
        style={{ y: slow, rotate: rotate1 }}
        className="pointer-events-none absolute left-[8%] top-[25%] -z-10 h-20 w-20 border border-white/[0.04]"
        aria-hidden="true"
      />
      <motion.div
        style={{ y: neg, rotate: rotate2 }}
        className="pointer-events-none absolute right-[12%] bottom-[20%] -z-10 h-10 w-10 rounded-full border border-primary/10"
        aria-hidden="true"
      />
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute right-[25%] top-[15%] -z-10 h-2 w-2 rounded-full bg-primary/20"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" distance={40}>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-5xl">
            Three steps.
          </h2>
        </ScrollReveal>

        <div className="relative mt-10 md:mt-14">
          {/* Animated horizontal progress line */}
          <div className="absolute left-0 right-0 top-0 hidden h-px bg-white/10 md:block">
            <motion.div className="h-full bg-primary/40" style={{ width: lineWidth }} />
          </div>

          <div className="grid gap-16 md:grid-cols-3 md:gap-0">
            {steps.map((step, i) => (
              <ScrollReveal key={step.number} direction="up" distance={50}>
                <div className="group relative md:pt-16 md:pr-8">
                  {/* Dot on the progress line */}
                  <div className="absolute -top-[4px] left-0 hidden h-[9px] w-[9px] rounded-full bg-primary/50 transition-all duration-300 group-hover:bg-primary group-hover:scale-150 md:block" />

                  {/* Giant decorative number */}
                  <span
                    className="block text-[80px] font-bold leading-none tracking-tighter text-white/[0.04] transition-colors duration-500 group-hover:text-white/[0.08] md:text-[120px]"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>

                  {/* Title overlaid */}
                  <h3 className="-mt-8 text-xl font-semibold text-white md:-mt-12 md:text-2xl">
                    {step.title}
                  </h3>

                  {/* Animated accent line — appears on hover */}
                  <div className="mt-4 h-px w-0 bg-primary/40 transition-all duration-500 group-hover:w-16" />
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
