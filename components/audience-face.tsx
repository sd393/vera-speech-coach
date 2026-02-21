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
      if (imgRef.current) imgRef.current.style.transform = `scale(${1 + avg * 0.03})`
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (imgRef.current) imgRef.current.style.transform = ""
    }
  }, [state, analyserNode])

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
        style={{ userSelect: "none" }}
        animate={
          state === "idle"       ? { scale: [1, 1.01, 1] }
          : state === "thinking"   ? { x: [-2, 2, -2] }
          : state === "speaking"   ? { scale: [1, 1.012, 1] }
          : state === "satisfied"  ? { rotate: 1.5 }
          : {}
        }
        transition={
          state === "idle"       ? { scale: { duration: 4, repeat: Infinity, ease: "easeInOut" } }
          : state === "thinking"   ? { x: { duration: 3, repeat: Infinity, ease: "easeInOut" } }
          : state === "speaking"   ? { scale: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }
          : { duration: 0.6, ease: "easeInOut" }
        }
      />
    </div>
  )
}
