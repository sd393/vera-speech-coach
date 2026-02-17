"use client"

import { ScrollReveal } from "@/components/motion"

export function Footer() {
  return (
    <footer className="border-t border-border/30 px-6 pt-6 pb-12">
      <ScrollReveal direction="up" distance={20}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-display text-lg font-bold text-foreground">Demian</span>
            <p className="font-mono mt-1 text-sm text-muted-foreground">
              The AI rehearsal room.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <ul className="flex items-center gap-6">
              {["Privacy", "Terms", "Contact"].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="font-mono text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
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
