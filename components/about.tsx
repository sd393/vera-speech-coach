"use client"

import { ScrollReveal, useParallax, motion } from "@/components/motion"

const features = [
  { word: "Audience-aware", accent: "hsl(192 80% 55%)" },
  { word: "Context-driven", accent: "hsl(165 55% 50%)" },
  { word: "Personalized", accent: "hsl(210 70% 60%)" },
  { word: "High-stakes ready", accent: "hsl(192 91% 36%)" },
]

export function About() {
  const { ref, med } = useParallax()

  return (
    <section id="about" ref={ref} className="relative overflow-hidden px-6 py-32 md:py-44">
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

      <div className="mx-auto max-w-5xl">
        <ScrollReveal direction="up" distance={40}>
          <h2 className="max-w-lg text-3xl font-bold tracking-tight text-foreground md:text-5xl">
            Not just another
            <br />
            generic coach.
          </h2>
        </ScrollReveal>

        {/* Feature words */}
        <div className="mt-24 flex flex-col gap-6">
          {features.map((f, i) => (
            <ScrollReveal
              key={f.word}
              direction={i % 2 === 0 ? "left" : "right"}
              distance={80}
            >
              <div className="group flex items-center gap-6 py-4">
                <div
                  className="h-2 w-2 rounded-full transition-transform duration-300 group-hover:scale-[2.5]"
                  style={{ background: f.accent }}
                />
                <span className="text-3xl font-bold text-foreground/80 transition-colors duration-300 group-hover:text-foreground md:text-6xl">
                  {f.word}
                </span>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-20" direction="up" distance={30}>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            Feedback that feels like it came from someone in the room.
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
