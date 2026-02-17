"use client"

import { ScrollReveal, useParallax, motion, useTransform } from "@/components/motion"

const features = [
  { word: "Audience-aware", accent: "hsl(36 56% 48%)" },
  { word: "Context-driven", accent: "hsl(34 35% 74%)" },
  { word: "Personalized", accent: "hsl(37 14% 50%)" },
  { word: "High-stakes ready", accent: "hsl(36 56% 42%)" },
]

export function About() {
  const { ref, scrollYProgress, med } = useParallax()

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.65], ["0%", "100%"])

  return (
    <section id="about" ref={ref} className="relative overflow-hidden px-6 py-14 md:py-20">
      {/* Parallax glow */}
      <motion.div
        style={{ y: med }}
        className="pointer-events-none absolute -right-40 -top-20 -z-10 h-[500px] w-[500px] rounded-full opacity-10 blur-3xl"
        aria-hidden="true"
      >
        <div
          className="h-full w-full rounded-full"
          style={{ background: "radial-gradient(circle, hsl(36 56% 48%), transparent 70%)" }}
        />
      </motion.div>


      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" distance={40}>
          <h2 className="font-display max-w-lg text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Not just another
            <br />
            generic coach.
          </h2>
        </ScrollReveal>

        {/* Feature words — dramatic scale, animated accents */}
        <div className="relative mt-10 md:mt-14">
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

                  <span className="font-display text-4xl font-bold text-foreground/80 transition-colors duration-300 group-hover:text-foreground md:text-6xl lg:text-8xl">
                    {f.word}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
