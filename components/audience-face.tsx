"use client"

import { useEffect, useRef, useMemo } from "react"

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "satisfied"

export interface AudienceFaceProps {
  state: FaceState
  analyserNode?: AnalyserNode | null
  size?: number
}

const LAYERS = [
  "neck-left",
  "neck-right",
  "jaw",
  "nose",
  "lip-lower",
  "lip-line",
  "lip-upper",
  "eye-left-lower",
  "eye-right-lower",
  "iris-left",
  "iris-right",
  "eye-left-upper",
  "eye-right-upper",
  "eyebrow-left",
] as const

type LayerName = (typeof LAYERS)[number]

/* ── Easing helpers ── */

/** Attempt at ease-in-out with organic overshoot for biological motion */
function easeOutBack(t: number): number {
  const c = 1.2
  return 1 + c * Math.pow(t - 1, 3) + (c - 1) * Math.pow(t - 1, 2)
}

/** Fast close, slow open — asymmetric blink curve */
function blinkCurve(t: number): number {
  // t: 0→1 over the blink duration
  // Close phase: 0→0.3 (fast)  Open phase: 0.3→1.0 (slow)
  if (t < 0.25) return easeOutBack(t / 0.25)
  if (t < 0.35) return 1
  return Math.max(0, 1 - ((t - 0.35) / 0.65) ** 0.6)
}

/** Cheap pseudo-random noise seeded by time */
function noise(t: number, seed: number): number {
  const x = Math.sin(t * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function AudienceFace({ state, analyserNode, size = 200 }: AudienceFaceProps) {
  const aspect = 1696 / 2528
  const width = size * aspect
  const height = size

  const faceRef = useRef<HTMLDivElement>(null)
  const breathRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<Map<LayerName, HTMLElement>>(new Map())

  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  // Populate layer refs once after mount
  useEffect(() => {
    if (!faceRef.current) return
    const map = new Map<LayerName, HTMLElement>()
    for (const layer of LAYERS) {
      const el = faceRef.current.querySelector(`[data-layer="${layer}"]`) as HTMLElement | null
      if (el) map.set(layer, el)
    }
    layersRef.current = map
  }, [])

  useEffect(() => {
    if (prefersReduced) return

    let rafId: number

    /* ── Blink state ── */
    let blinkStart = -1 // -1 = not blinking
    let blinkDuration = 180
    let nextBlinkAt = performance.now() + 2000 + Math.random() * 2500
    let isDoubleBlink = false
    let doubleBlinkGap = false

    /* ── Saccade state (eye jumps) ── */
    const eye = { x: 0, y: 0 } // current rendered position
    const eyeTarget = { x: 0, y: 0 }
    let nextSaccadeAt = performance.now() + 800 + Math.random() * 1500
    let saccadeProgress = 1 // 1 = arrived at target

    /* ── Eyebrow ── */
    let browCurrent = 0
    let browTarget = 0

    /* ── Speaking ── */
    let smoothVol = 0
    let speakT = 0
    // Syllable pattern: bursts separated by micro-pauses
    let syllablePhase = 0
    let syllablePause = false
    let syllablePauseEnd = 0

    const freqData = analyserNode
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : null

    const get = (name: LayerName) => layersRef.current.get(name)

    const tick = (now: number) => {
      const h = height
      const s = now / 1000 // seconds

      /* ────────────────────────────────
         Breathing — layered sine waves
         with slight irregularity
         ──────────────────────────────── */
      const breath =
        Math.sin(s * 0.95) * 0.0018
        + Math.sin(s * 1.37) * 0.0008
        + Math.sin(s * 0.43) * 0.0004
      if (breathRef.current) {
        breathRef.current.style.transform = `scale(${1 + breath})`
      }

      /* ────────────────────────────────
         Blinking — asymmetric curve,
         occasional double-blinks
         ──────────────────────────────── */
      let blink = 0

      if (blinkStart >= 0) {
        const t = (now - blinkStart) / blinkDuration
        if (t >= 1) {
          // Blink finished
          blinkStart = -1
          if (isDoubleBlink && !doubleBlinkGap) {
            // Schedule second blink after tiny gap
            doubleBlinkGap = true
            blinkStart = -1
            nextBlinkAt = now + 80 + Math.random() * 40
          } else {
            isDoubleBlink = false
            doubleBlinkGap = false
            // Next blink: vary by state
            const base = state === "listening" ? 2200 : state === "thinking" ? 3500 : 3000
            const variance = state === "listening" ? 2000 : 3000
            nextBlinkAt = now + base + Math.random() * variance
          }
        } else {
          blink = blinkCurve(t)
        }
      } else if (now >= nextBlinkAt) {
        blinkStart = now
        blinkDuration = 140 + Math.random() * 60 // 140-200ms, varies each time
        isDoubleBlink = !doubleBlinkGap && Math.random() < 0.2 // 20% chance of double
        doubleBlinkGap = false
      }

      // Upper eyelids
      const upperY = blink * h * 0.016
      for (const name of ["eye-left-upper", "eye-right-upper"] as const) {
        const el = get(name)
        if (el) el.style.transform = `translateY(${upperY}px)`
      }

      // Lower eyelids — only visible during blink
      for (const name of ["eye-left-lower", "eye-right-lower"] as const) {
        const el = get(name)
        if (el) {
          el.style.opacity = blink > 0.15 ? "1" : "0"
          el.style.transform = `translateY(${-(blink * h * 0.006)}px)`
        }
      }

      /* ────────────────────────────────
         Iris — saccadic movement
         (quick jumps, not smooth drifts)
         ──────────────────────────────── */

      if (now >= nextSaccadeAt && saccadeProgress >= 1) {
        // Pick new target based on state
        if (state === "idle" || state === "satisfied") {
          // Random gaze points within a natural range
          eyeTarget.x = (Math.random() - 0.5) * 1.6
          eyeTarget.y = (Math.random() - 0.5) * 0.8
        } else if (state === "thinking") {
          // Tend to look up-right (recall/thought), but wander
          eyeTarget.x = 0.4 + Math.random() * 0.6
          eyeTarget.y = -0.3 - Math.random() * 0.5
        } else if (state === "listening") {
          // Small movements around center (attentive, focused)
          eyeTarget.x = (Math.random() - 0.5) * 0.5
          eyeTarget.y = -0.1 + (Math.random() - 0.5) * 0.3
        } else if (state === "speaking") {
          // Moderate movement, occasionally looking at "audience"
          eyeTarget.x = (Math.random() - 0.5) * 0.8
          eyeTarget.y = (Math.random() - 0.5) * 0.4
        }
        saccadeProgress = 0
        // Interval varies: longer pauses in idle, shorter when active
        const interval = state === "idle" ? 1500 + Math.random() * 2500
          : state === "thinking" ? 1200 + Math.random() * 2000
          : 800 + Math.random() * 1500
        nextSaccadeAt = now + interval
      }

      // Saccades are fast (50-80ms) — use aggressive lerp
      if (saccadeProgress < 1) {
        saccadeProgress = Math.min(1, saccadeProgress + 0.15)
        const t = 1 - Math.pow(1 - saccadeProgress, 3) // ease-out cubic
        eye.x += (eyeTarget.x - eye.x) * t * 0.4
        eye.y += (eyeTarget.y - eye.y) * t * 0.4
      }
      // Micro-tremor (physiological nystagmus) — tiny constant jitter
      const tremX = (noise(s * 8, 1) - 0.5) * 0.06
      const tremY = (noise(s * 8, 2) - 0.5) * 0.04

      const irisX = (eye.x + tremX) * h * 0.006
      const irisY = (eye.y + tremY) * h * 0.005
      const irisOpacity = blink > 0.85 ? 0 : 1

      for (const name of ["iris-left", "iris-right"] as const) {
        const el = get(name)
        if (el) {
          el.style.transform = `translate(${irisX}px, ${irisY}px)`
          el.style.opacity = String(irisOpacity)
        }
      }

      /* ────────────────────────────────
         Eyebrow — smooth transitions
         with micro-expression flutter
         ──────────────────────────────── */
      if (state === "thinking") browTarget = -h * 0.007
      else if (state === "listening") browTarget = -h * 0.003
      else browTarget = 0

      // Subtle flutter (micro-expressions)
      const browFlutter = (noise(s * 3, 5) - 0.5) * h * 0.001

      // Smooth approach to target
      browCurrent += (browTarget - browCurrent) * 0.04
      const browEl = get("eyebrow-left")
      if (browEl) browEl.style.transform = `translateY(${browCurrent + browFlutter}px)`

      /* ────────────────────────────────
         Speaking — jaw + lips
         with syllable-like rhythm
         ──────────────────────────────── */
      let vol = 0

      if (state === "speaking") {
        if (freqData && analyserNode) {
          analyserNode.getByteFrequencyData(freqData)
          let sum = 0
          const count = Math.min(freqData.length, 64)
          for (let i = 0; i < count; i++) sum += freqData[i]
          const raw = sum / count / 255
          // Two-stage smoothing: fast attack, slow release (like real jaw)
          if (raw > smoothVol) {
            smoothVol = smoothVol * 0.4 + raw * 0.6 // fast open
          } else {
            smoothVol = smoothVol * 0.8 + raw * 0.2 // slow close
          }
          vol = smoothVol
        } else {
          // Syllable-based fallback: bursts of opening with micro-pauses
          speakT += 1 / 60

          if (syllablePause) {
            vol = smoothVol * 0.85 // close during pause
            smoothVol = vol
            if (now > syllablePauseEnd) {
              syllablePause = false
              syllablePhase = 0
            }
          } else {
            syllablePhase += 0.18 + noise(speakT, 7) * 0.08
            const syllable = Math.sin(syllablePhase) * 0.5 + 0.5
            // Shape: quick open, hold, slower close
            const shaped = syllable > 0.5
              ? 0.3 + (syllable - 0.5) * 1.0
              : syllable * 0.6
            vol = shaped * (0.6 + noise(speakT * 2, 8) * 0.4)
            smoothVol = vol

            // Random micro-pauses between syllable groups
            if (syllablePhase > Math.PI * 2) {
              syllablePhase = 0
              if (Math.random() < 0.35) {
                syllablePause = true
                syllablePauseEnd = now + 60 + Math.random() * 140
              }
            }
          }
        }
      } else {
        speakT = 0
        syllablePhase = 0
        syllablePause = false
        // Gentle close
        smoothVol *= 0.9
        vol = smoothVol
      }

      // Apply volume with slight asymmetry (jaw leads, lips follow)
      const jawY = vol * h * 0.02
      const lipLowY = vol * h * 0.015
      const lipLineY = vol * h * 0.006
      const lipUpY = -(vol * h * 0.003)

      const jawEl = get("jaw")
      if (jawEl) jawEl.style.transform = `translateY(${jawY}px)`

      const lipLo = get("lip-lower")
      if (lipLo) lipLo.style.transform = `translateY(${lipLowY}px)`

      const lipLn = get("lip-line")
      if (lipLn) lipLn.style.transform = `translateY(${lipLineY}px)`

      const lipUp = get("lip-upper")
      if (lipUp) lipUp.style.transform = `translateY(${lipUpY}px)`

      /* ── Nose micro-movement (tied to breathing) ── */
      const noseEl = get("nose")
      if (noseEl) noseEl.style.transform = `translateY(${breath * h * 0.3}px)`

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [state, analyserNode, height, prefersReduced])

  return (
    <div
      ref={faceRef}
      style={{ width, height, position: "relative", flexShrink: 0 }}
      aria-label="Vera, your AI coach"
      role="img"
    >
      <div ref={breathRef} style={{ width: "100%", height: "100%", position: "relative" }}>
        {LAYERS.map((layer, i) => (
          <div
            key={layer}
            data-layer={layer}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: i,
              willChange: "transform, opacity",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/face/${layer}.svg`}
              alt=""
              draggable={false}
              style={{
                userSelect: "none",
                display: "block",
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
