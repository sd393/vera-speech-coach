"use client"

import { FadeIn, useParallax, motion, useTransform } from "@/components/motion"

export function Hero() {
  const { ref, scrollYProgress, med, neg, negFast } = useParallax()
  const rotateY = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [-20, 20, -20, 20, -20])
  const rotateX = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [12, -12, 12, -12])
  const rotateZ = useTransform(scrollYProgress, [0, 0.5, 1], [-3, 3, -3])
  const bubbleY = useTransform(scrollYProgress, [0, 0.5, 1], [-30, 30, -30])
  const bubbleScale = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [1, 1.05, 0.97, 1.03, 1])

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center overflow-hidden px-6 pt-20"
    >
      {/* Parallax background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <motion.div
          style={{ y: neg }}
          className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full opacity-25 blur-3xl"
        >
          <div
            className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle, hsl(192 80% 55%), transparent 70%)" }}
          />
        </motion.div>
        <motion.div
          style={{ y: med }}
          className="absolute -right-32 top-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
        >
          <div
            className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle, hsl(165 55% 50%), transparent 70%)" }}
          />
        </motion.div>
        <motion.div
          style={{ y: negFast }}
          className="absolute -bottom-32 left-1/4 h-[400px] w-[400px] rounded-full opacity-15 blur-3xl"
        >
          <div
            className="h-full w-full rounded-full"
            style={{ background: "radial-gradient(circle, hsl(220 60% 60%), transparent 70%)" }}
          />
        </motion.div>
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {/* Left — text */}
        <div>
          <FadeIn delay={0}>
            <p className="mb-5 text-sm font-medium uppercase tracking-widest text-primary">
              AI-Powered Coaching
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-foreground md:text-7xl">
              Rehearse with
              <br />
              your <span className="text-primary">real</span>
              <br />
              audience.
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Describe who you&apos;re presenting to. Vera simulates that audience
              and gives you feedback that actually matters.
            </p>
          </FadeIn>
          <FadeIn delay={0.35}>
            <div className="mt-10 flex gap-4">
              <a
                href="/chat"
                className="inline-flex items-center rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started Free
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-lg border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-accent hover:scale-[1.02] active:scale-[0.98]"
              >
                See How
              </a>
            </div>
          </FadeIn>
        </div>

        {/* Right — 3D spinning text bubble */}
        <FadeIn delay={0.5} direction="right" className="relative hidden md:flex items-center justify-center">
          <div style={{ perspective: "800px" }} className="relative w-full max-w-sm">
            {/* Glow behind bubble that pulses with scroll */}
            <motion.div
              style={{ scale: bubbleScale, y: bubbleY }}
              className="absolute -inset-8 rounded-full opacity-20 blur-2xl"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: "radial-gradient(circle, hsl(192 80% 55%), transparent 70%)" }}
              />
            </motion.div>

            <motion.div
              style={{ rotateY, rotateX, rotateZ, y: bubbleY, scale: bubbleScale }}
              className="relative"
            >
              {/* Bubble body */}
              <div className="rounded-3xl border border-primary/20 bg-white/80 px-8 py-7 shadow-xl shadow-primary/10 backdrop-blur-md transition-shadow duration-300 hover:shadow-2xl hover:shadow-primary/20">
                <p className="text-sm font-medium leading-relaxed text-foreground/90">
                  &ldquo;Your opening lands well, but slide 3 needs stronger
                  evidence. The CFO will push back on that ROI claim.&rdquo;
                </p>
                <p className="mt-3 text-xs font-semibold text-primary">
                  — Vera, simulating your board
                </p>
              </div>
              {/* Bubble tail */}
              <div
                className="absolute -bottom-3 left-10 h-6 w-6 rotate-45 rounded-sm border-b border-r border-primary/20 bg-white/80"
              />
            </motion.div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
