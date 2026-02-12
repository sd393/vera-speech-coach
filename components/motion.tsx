"use client"

import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion"
import { useRef, type ReactNode } from "react"

/* ── ScrollReveal ──
   Fades + slides in tied to scroll position. Reverses on scroll back up.
*/
export function ScrollReveal({
  children,
  className,
  direction = "up",
  distance = 50,
  once = false,
}: {
  children: ReactNode
  className?: string
  direction?: "up" | "down" | "left" | "right"
  distance?: number
  once?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 1.0", "start 0.65"],
  })

  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 20 })
  const progress = once ? scrollYProgress : smooth

  const d = reduced ? 0 : distance
  const axis = direction === "left" || direction === "right" ? "x" : "y"
  const sign =
    direction === "up" || direction === "left" ? 1 : -1

  const opacity = useTransform(progress, [0, 1], reduced ? [1, 1] : [0, 1])
  const offset = useTransform(progress, [0, 1], [d * sign, 0])

  const style: Record<string, unknown> = { opacity }
  style[axis === "x" ? "x" : "y"] = offset

  return (
    <motion.div ref={ref} style={style} className={className}>
      {children}
    </motion.div>
  )
}

/* ── FadeIn ──
   One-shot page-load entrance animation.
*/
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.7,
  direction = "up",
}: {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: "up" | "down" | "left" | "right" | "none"
}) {
  const reduced = useReducedMotion()

  const initialMap: Record<string, Record<string, number>> = {
    up: { opacity: 0, y: 30 },
    down: { opacity: 0, y: -30 },
    left: { opacity: 0, x: 30 },
    right: { opacity: 0, x: -30 },
    none: { opacity: 0 },
  }

  return (
    <motion.div
      initial={reduced ? undefined : initialMap[direction]}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── useParallax ──
   Hook: returns scroll-linked y values at different speeds.
   Usage: const { ref, slow, med, fast } = useParallax()
   Then: <motion.div style={{ y: slow }}>
*/
export function useParallax() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const slow = useTransform(scrollYProgress, [0, 1], [-30, 30])
  const med = useTransform(scrollYProgress, [0, 1], [-60, 60])
  const fast = useTransform(scrollYProgress, [0, 1], [-100, 100])
  const neg = useTransform(scrollYProgress, [0, 1], [40, -40])
  const negFast = useTransform(scrollYProgress, [0, 1], [80, -80])

  return { ref, scrollYProgress, slow, med, fast, neg, negFast }
}

export { motion, useScroll, useTransform, useSpring }
