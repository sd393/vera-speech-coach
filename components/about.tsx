"use client"

import { ScrollReveal, useParallax, motion, useTransform } from "@/components/motion"

const features = [
  { word: "Audience-aware", accent: "hsl(192 80% 55%)" },
  { word: "Context-driven", accent: "hsl(165 55% 50%)" },
  { word: "Personalized", accent: "hsl(210 70% 60%)" },
  { word: "High-stakes ready", accent: "hsl(192 91% 36%)" },
]

export function About() {
  const { ref, scrollYProgress, med, neg, slow, fast } = useParallax()

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.65], ["0%", "100%"])
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 90])
  const rotate2 = useTransform(scrollYProgress, [0, 1], [45, -45])

  return (
    <section id="about" ref={ref} className="relative overflow-hidden px-6 py-24 md:py-32">
      {/* Parallax glow */}
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute -right-40 -top-20 -z-10 h-[500px] w-[500px] rounded-full opacity-10 blur-3xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(circle, hsl(192 80% 55%), transparent 70%)" }}
        />
      </motion.div>

      {/* Floating geometric accents */}
      <motion.div
        style={{ y: slow, rotate: rotate1 }}
        className="pointer-events-none absolute right-[15%] top-[20%] -z-10 h-16 w-16 border border-primary/10"
        aria-hidden="true"
      />
      <motion.div
        style={{ y: fast, rotate: rotate2 }}
        className="pointer-events-none absolute left-[10%] bottom-[25%] -z-10 h-8 w-8 rounded-full border border-primary/15"
        aria-hidden="true"
      />
      <motion.div
        style={{ y: neg }}
        className="pointer-events-none absolute right-[8%] bottom-[35%] -z-10 h-3 w-3 rounded-full bg-primary/10"
        aria-hidden="true"
      />
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute left-[20%] top-[15%] -z-10 h-24 w-px bg-gradient-to-b from-primary/20 to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" distance={40}>
          <h2 className="max-w-lg text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Not just another
            <br />
            generic coach.
          </h2>
        </ScrollReveal>

        {/* Feature words — dramatic scale, animated accents */}
        <div className="relative mt-16 md:mt-20">
          {/* Vertical accent line — scroll-animated */}
          <div className="absolute left-0 top-0 bottom-0 hidden w-px bg-border/30 md:block">
            <motion.div
              className="w-full bg-primary/40"
              style={{ height: lineHeight }}
            />
          </div>

          <div className="flex flex-col">
            {features.map((f, i) => (
              <ScrollReveal
                key={f.word}
                direction={i % 2 === 0 ? "left" : "right"}
                distance={80}
              >
                <div className="group relative border-b border-border/20 py-6 md:py-8 md:pl-12">
                  {/* Dot on the vertical line */}
                  <div
                    className="absolute -left-[5px] top-1/2 hidden h-[10px] w-[10px] -translate-y-1/2 rounded-full transition-transform duration-300 group-hover:scale-[2] md:block"
                    style={{ background: f.accent }}
                  />

                  {/* Animated accent underline — expands on hover */}
                  <div
                    className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 group-hover:w-full md:left-12"
                    style={{ background: f.accent, opacity: 0.3 }}
                  />

                  <span className="text-4xl font-bold text-foreground/80 transition-colors duration-300 group-hover:text-foreground md:text-6xl lg:text-8xl">
                    {f.word}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal className="mt-12" direction="up" distance={30}>
          <p className="max-w-sm text-lg leading-relaxed text-muted-foreground">
            Feedback that feels like it came from someone in the room.
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
