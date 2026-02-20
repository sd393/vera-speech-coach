"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion } from "framer-motion"

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "satisfied"

export interface AudienceFaceProps {
  state: FaceState
  analyserNode?: AnalyserNode | null
  size?: number
}

/* ── Expression configs ── */

interface ExpressionConfig {
  leftBrowY: number
  rightBrowY: number
  leftBrowD: string    // brow path (allows furrowing by changing shape)
  rightBrowD: string
  eyeOpenY: number     // eye almond scaleY (1 = normal, 0 = closed)
  pupilOffsetX: number
  pupilOffsetY: number
  mouthD: string
}

// Eye almond paths — single continuous path (no second M, so Z closes cleanly)
const EYE_L = "M 58 84 C 62 78, 82 78, 86 84 C 82 90, 62 90, 58 84 Z"
const EYE_R = "M 114 84 C 118 78, 138 78, 142 84 C 138 90, 118 90, 114 84 Z"

const EXPRESSIONS: Record<FaceState, ExpressionConfig> = {
  idle: {
    leftBrowY: 0,
    rightBrowY: 0,
    leftBrowD:  "M 60 72 Q 72 69, 84 71",
    rightBrowD: "M 116 71 Q 128 69, 140 72",
    eyeOpenY: 1,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    mouthD: "M 78 108 C 88 112, 112 112, 122 108",
  },
  listening: {
    leftBrowY: -4,
    rightBrowY: -4,
    leftBrowD:  "M 60 68 Q 72 65, 84 67",
    rightBrowD: "M 116 67 Q 128 65, 140 68",
    eyeOpenY: 1.1,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    mouthD: "M 78 107 C 88 110, 112 110, 122 107",
  },
  thinking: {
    leftBrowY: -3,
    rightBrowY: 3,
    leftBrowD:  "M 60 69 Q 72 66, 84 70",   // slightly arched
    rightBrowD: "M 116 73 Q 128 70, 140 72", // other side lower/flat
    eyeOpenY: 0.75,
    pupilOffsetX: -5,
    pupilOffsetY: 3,
    mouthD: "M 80 109 C 90 108, 112 109, 122 108",
  },
  speaking: {
    leftBrowY: -2,
    rightBrowY: -2,
    leftBrowD:  "M 60 70 Q 72 67, 84 69",
    rightBrowD: "M 116 69 Q 128 67, 140 70",
    eyeOpenY: 1.05,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    mouthD: "M 78 107 C 88 115, 112 115, 122 107",
  },
  satisfied: {
    leftBrowY: -1,
    rightBrowY: -1,
    leftBrowD:  "M 60 71 Q 72 68, 84 70",
    rightBrowD: "M 116 70 Q 128 68, 140 71",
    eyeOpenY: 0.9,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    mouthD: "M 76 106 C 88 117, 112 117, 124 106",
  },
}

// Speaking mouth keyframes — same path format so Framer Motion interpolates smoothly
const MOUTH_SPEAKING_CLOSED = "M 78 108 C 90 112, 110 112, 122 108"
const MOUTH_SPEAKING_OPEN   = "M 78 108 C 90 117, 110 117, 122 108"

export function AudienceFace({ state, analyserNode, size = 200 }: AudienceFaceProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const faceGroupRef = useRef<SVGGElement>(null)
  const rafRef = useRef<number>(0)

  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })
  const [blinking, setBlinking] = useState(false)

  const expr = EXPRESSIONS[state]

  /* ── Mouse tracking ── */
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const maxR = Math.max(rect.width, rect.height) * 0.9
      setMouseOffset({
        x: Math.max(-6, Math.min(6, ((e.clientX - cx) / maxR) * 8)),
        y: Math.max(-4, Math.min(4, ((e.clientY - cy) / maxR) * 6)),
      })
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  /* ── Blink cycle ── */
  const scheduleBlink = useCallback(() => {
    return setTimeout(() => {
      setBlinking(true)
      setTimeout(() => {
        setBlinking(false)
        scheduleBlink()
      }, 110)
    }, 3000 + Math.random() * 3500)
  }, [])

  useEffect(() => {
    const t = scheduleBlink()
    return () => clearTimeout(t)
  }, [scheduleBlink])

  /* ── Volume reactivity (listening) ── */
  useEffect(() => {
    if (state !== "listening" || !analyserNode) {
      if (faceGroupRef.current) faceGroupRef.current.style.transform = ""
      return
    }
    const data = new Uint8Array(analyserNode.frequencyBinCount)
    const loop = () => {
      analyserNode.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
      const s = 1 + avg * 0.04
      if (faceGroupRef.current) {
        faceGroupRef.current.style.transform = `scale(${s})`
        faceGroupRef.current.style.transformOrigin = "100px 100px"
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (faceGroupRef.current) faceGroupRef.current.style.transform = ""
    }
  }, [state, analyserNode])

  const px = expr.pupilOffsetX + mouseOffset.x
  const py = expr.pupilOffsetY + mouseOffset.y

  // Eye scaleY — blink overrides expression openness
  const eyeScale = blinking ? 0.04 : expr.eyeOpenY

  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
      aria-label="Vera, your AI coach"
      role="img"
    >
      {/* Ambient glow */}
      <motion.div
        style={{
          position: "absolute",
          inset: -size * 0.25,
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(36 56% 48%), transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
        animate={{
          opacity: state === "speaking" ? [0.1, 0.18, 0.1] : 0.06,
        }}
        transition={
          state === "speaking"
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.6 }
        }
      />

      <motion.svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox="0 0 200 200"
        style={{ position: "relative", zIndex: 1, overflow: "visible" }}
        animate={{ x: state === "thinking" ? [-3, 3, -3] : 0 }}
        transition={
          state === "thinking"
            ? { x: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } }
            : { duration: 0.5 }
        }
      >
        <g ref={faceGroupRef}>
          {/* ── Head ── */}
          <motion.ellipse
            cx={100} cy={100} rx={68} ry={78}
            fill="hsl(220 18% 11%)"
            stroke="hsl(36 45% 45% / 0.2)"
            strokeWidth={1.5}
            animate={
              state === "idle"
                ? { scaleX: [1, 1.007, 1], scaleY: [1, 1.013, 1] }
                : { scaleX: 1, scaleY: 1 }
            }
            transition={
              state === "idle"
                ? { duration: 3.8, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.5 }
            }
            style={{ transformOrigin: "100px 100px" }}
          />

          {/* ── Left brow ── */}
          <motion.path
            d={expr.leftBrowD}
            stroke="hsl(36 25% 55% / 0.7)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            animate={{ d: expr.leftBrowD, translateY: expr.leftBrowY }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
          />

          {/* ── Right brow ── */}
          <motion.path
            d={expr.rightBrowD}
            stroke="hsl(36 25% 55% / 0.7)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            animate={{ d: expr.rightBrowD, translateY: expr.rightBrowY }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
          />

          {/* ── Left eye ── */}
          <motion.path
            d={EYE_L}
            fill="hsl(220 18% 16%)"
            stroke="hsl(36 25% 45% / 0.3)"
            strokeWidth={1}
            animate={{ scaleY: eyeScale }}
            transition={{ duration: blinking ? 0.055 : 0.2, ease: "easeInOut" }}
            style={{ transformOrigin: "72px 84px" }}
          />
          <motion.circle
            r={4}
            fill="hsl(36 70% 62%)"
            animate={{ cx: 72 + px, cy: 84 + py, opacity: blinking ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
          />

          {/* ── Right eye ── */}
          <motion.path
            d={EYE_R}
            fill="hsl(220 18% 16%)"
            stroke="hsl(36 25% 45% / 0.3)"
            strokeWidth={1}
            animate={{ scaleY: eyeScale }}
            transition={{ duration: blinking ? 0.055 : 0.2, ease: "easeInOut" }}
            style={{ transformOrigin: "128px 84px" }}
          />
          <motion.circle
            r={4}
            fill="hsl(36 70% 62%)"
            animate={{ cx: 128 + px, cy: 84 + py, opacity: blinking ? 0 : 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
          />

          {/* ── Mouth ── */}
          <motion.path
            stroke="hsl(36 30% 52% / 0.8)"
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
            animate={
              state === "speaking"
                ? { d: [MOUTH_SPEAKING_CLOSED, MOUTH_SPEAKING_OPEN, MOUTH_SPEAKING_CLOSED] }
                : { d: expr.mouthD }
            }
            transition={
              state === "speaking"
                ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.35, ease: "easeOut" }
            }
          />
        </g>
      </motion.svg>
    </div>
  )
}
