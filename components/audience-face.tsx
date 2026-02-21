"use client"

import { useEffect, useRef } from "react"
import { motion } from "framer-motion"

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "satisfied"

export interface AudienceFaceProps {
  state: FaceState
  analyserNode?: AnalyserNode | null
  size?: number
}

export function AudienceFace({ state, analyserNode, size = 200 }: AudienceFaceProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const rafRef = useRef<number>(0)

  /* ── Volume reactivity (listening) ── */
  useEffect(() => {
    if (state !== "listening" || !analyserNode) {
      if (imgRef.current) imgRef.current.style.transform = ""
      return
    }
    const data = new Uint8Array(analyserNode.frequencyBinCount)
    const loop = () => {
      analyserNode.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
      const s = 1 + avg * 0.04
      if (imgRef.current) {
        imgRef.current.style.transform = `scale(${s})`
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (imgRef.current) imgRef.current.style.transform = ""
    }
  }, [state, analyserNode])

  // Aspect ratio of the source SVG (1696 x 2528)
  const aspect = 1696 / 2528
  const width = size * aspect
  const height = size

  return (
    <div
      style={{ width, height, position: "relative", flexShrink: 0 }}
      aria-label="Vera, your AI coach"
      role="img"
    >

      <motion.img
        ref={imgRef}
        src="/face.svg"
        alt=""
        draggable={false}
        width={width}
        height={height}
        style={{ position: "relative", zIndex: 1, userSelect: "none" }}
        animate={
          state === "idle"
            ? { scale: [1, 1.01, 1], x: 0 }
            : state === "thinking"
              ? { x: [-3, 3, -3], scale: 1 }
              : state === "listening"
                ? { scale: 1, x: 0 }
                : state === "speaking"
                  ? { scale: [1, 1.015, 1], x: 0 }
                  : { scale: 1, x: 0 }
        }
        transition={
          state === "idle"
            ? { scale: { duration: 3.8, repeat: Infinity, ease: "easeInOut" }, x: { duration: 0.5 } }
            : state === "thinking"
              ? { x: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.5 } }
              : state === "speaking"
                ? { scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" }, x: { duration: 0.5 } }
                : { duration: 0.5 }
        }
      />
    </div>
  )
}
