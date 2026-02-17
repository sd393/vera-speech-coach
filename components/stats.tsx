"use client"

import { useEffect, useState } from "react"
import { ScrollReveal, useParallax, motion, useTransform } from "@/components/motion"
import { useInView } from "@/hooks/use-in-view"

/* ── Count-up hook ── */

function useCountUp(end: number, duration: number, inView: boolean, decimals = 0) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return

    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      setValue(Number((end * eased).toFixed(decimals)))

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }, [end, duration, inView, decimals])

  return value
}

/* ── Data ── */

const stats = [
  { numericValue: 10, suffix: "+", label: "audience personas", accent: "hsl(192 80% 55%)", barPercent: 65 },
  { numericValue: 92, suffix: "%", label: "felt more prepared", accent: "hsl(165 55% 50%)", barPercent: 92 },
  { numericValue: 500, suffix: "+", label: "presentations coached", accent: "hsl(210 70% 60%)", barPercent: 80 },
  { numericValue: 4.8, suffix: "", label: "average rating", accent: "hsl(192 91% 36%)", barPercent: 96 },
]

/* ── Stat item ── */

function StatItem({
  stat,
  inView,
}: {
  stat: (typeof stats)[number]
  inView: boolean
}) {
  const decimals = stat.numericValue % 1 !== 0 ? 1 : 0
  const count = useCountUp(stat.numericValue, 1800, inView, decimals)

  return (
    <ScrollReveal direction="up" distance={40}>
      <div className="group">
        {/* Number + suffix */}
        <div className="flex items-baseline">
          <span className="font-display text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            {inView ? count : 0}
          </span>
          {stat.suffix && (
            <span
              className="font-display ml-1 text-3xl font-bold md:text-4xl"
              style={{ color: stat.accent }}
            >
              {stat.suffix}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="font-mono mt-2 text-sm font-medium text-muted-foreground">
          {stat.label}
        </p>

        {/* Animated accent bar */}
        <div className="mt-4 h-px w-full overflow-hidden rounded-full bg-border/30">
          <div
            className="h-full rounded-full transition-all duration-[1.8s] ease-out"
            style={{
              width: inView ? `${stat.barPercent}%` : "0%",
              background: stat.accent,
              opacity: 0.5,
            }}
          />
        </div>
      </div>
    </ScrollReveal>
  )
}

/* ── Section ── */

export function Stats() {
  const { ref: inViewRef, inView } = useInView(0.2)
  const { ref: parallaxRef, scrollYProgress, med, slow, neg } = useParallax()
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 60])

  return (
    <section
      ref={parallaxRef}
      className="relative overflow-hidden px-6 py-14 md:py-20"
    >
      {/* Parallax glow */}
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute -right-32 top-1/2 -z-10 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-[0.06] blur-3xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(circle, hsl(192 80% 55%), transparent 70%)" }}
        />
      </motion.div>


      <div
        ref={inViewRef}
        className="mx-auto grid max-w-5xl grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 md:gap-x-12"
      >
        {stats.map((stat) => (
          <StatItem key={stat.label} stat={stat} inView={inView} />
        ))}
      </div>
    </section>
  )
}
