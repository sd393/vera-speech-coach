"use client"

import { ScrollReveal } from "@/components/motion"

export function Footer() {
  return (
    <footer className="border-t border-border/30 px-6 py-12">
      <ScrollReveal direction="up" distance={20}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-lg font-bold text-foreground">Vera</span>
            <p className="mt-1 text-sm text-muted-foreground">
              A rehearsal room powered by AI.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-6">
              {["Privacy", "Terms", "Contact"].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </ScrollReveal>
    </footer>
  )
}
