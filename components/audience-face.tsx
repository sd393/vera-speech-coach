"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "satisfied"

export type FaceEmotion =
  | "neutral"
  | "interested"
  | "skeptical"
  | "confused"
  | "amused"
  | "impressed"
  | "concerned"
  | "bored"

const FACE_EMOTIONS: ReadonlySet<string> = new Set([
  "neutral", "interested", "skeptical", "confused",
  "amused", "impressed", "concerned", "bored",
])

export function isValidFaceEmotion(v: unknown): v is FaceEmotion {
  return typeof v === "string" && FACE_EMOTIONS.has(v)
}

export interface AudienceFaceProps {
  state: FaceState
  analyserNode?: AnalyserNode | null
  size?: number
  emotion?: FaceEmotion
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
  if (t < 0.25) return easeOutBack(t / 0.25)
  if (t < 0.35) return 1
  return Math.max(0, 1 - ((t - 0.35) / 0.65) ** 0.6)
}

/** Cheap pseudo-random noise seeded by time */
function noise(t: number, seed: number): number {
  const x = Math.sin(t * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/* ── Emotion map ──
   Each emotion maps to offset multipliers applied during idle/satisfied.
   Values are unitless factors — the rAF loop multiplies by h (height).
   eyeOpenness: >0 = wider, <0 = squint/droop
   irisX/irisY: bias direction
   lipLineY: negative = press up (tension), positive = pull down (smile)
   lipUpperY: negative = lift (show teeth / smile)
   jawY: slight open
*/
interface EmotionOffsets {
  eyeOpenness: number
  irisX: number
  irisY: number
  lipLineY: number
  lipUpperY: number
  jawY: number
}

const EMOTION_MAP: Record<FaceEmotion, EmotionOffsets> = {
  neutral:    { eyeOpenness: 0,      irisX: 0,    irisY: 0,     lipLineY: 0,      lipUpperY: 0,      jawY: 0 },
  interested: { eyeOpenness: 0.004,  irisX: 0,    irisY: -0.002, lipLineY: 0,      lipUpperY: 0,      jawY: 0 },
  skeptical:  { eyeOpenness: -0.002, irisX: 0.003, irisY: 0,     lipLineY: -0.002, lipUpperY: 0,      jawY: 0 },
  confused:   { eyeOpenness: 0,      irisX: 0,    irisY: 0,     lipLineY: 0,      lipUpperY: 0,      jawY: 0 },
  amused:     { eyeOpenness: 0.002,  irisX: 0,    irisY: 0,     lipLineY: 0.002,  lipUpperY: -0.002, jawY: 0.003 },
  impressed:  { eyeOpenness: 0.004,  irisX: 0,    irisY: 0,     lipLineY: 0,      lipUpperY: 0,      jawY: 0.002 },
  concerned:  { eyeOpenness: -0.002, irisX: 0,    irisY: 0,     lipLineY: -0.002, lipUpperY: 0,      jawY: 0 },
  bored:      { eyeOpenness: -0.005, irisX: 0,    irisY: 0.002, lipLineY: 0,      lipUpperY: 0,      jawY: 0 },
}

/* ── Thinking fixation points ──
   6 natural gaze positions for cognitive processing */
const THOUGHT_FIXATIONS: { x: number; y: number }[] = [
  { x: 0.5,  y: -0.6 },   // up-right (visual recall)
  { x: -0.5, y: -0.6 },   // up-left (visual construct)
  { x: 0.0,  y: 0.3 },    // center-down (internal focus / kinesthetic)
  { x: 0.3,  y: -0.2 },   // slight right (auditory recall)
  { x: -0.3, y: -0.2 },   // slight left (auditory construct)
  { x: 0.0,  y: -0.4 },   // straight up (defocused recall)
]

/* ── Preload hook ── */

function useFacePreload(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let loadCount = 0
    const total = LAYERS.length

    const onLoad = () => {
      loadCount++
      if (loadCount >= total) setReady(true)
    }

    for (const layer of LAYERS) {
      const img = new Image()
      img.onload = onLoad
      img.onerror = onLoad // count errors too so we don't hang
      img.src = `/face/${layer}.svg`
    }

    // Fallback timeout — show face after 5s regardless
    const timeout = setTimeout(() => setReady(true), 5000)

    return () => clearTimeout(timeout)
  }, [])

  return ready
}

export function AudienceFace({ state, analyserNode, size = 200, emotion = "neutral" }: AudienceFaceProps) {
  const aspect = 1696 / 2528
  const width = size * aspect
  const height = size

  const faceRef = useRef<HTMLDivElement>(null)
  const breathRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<Map<LayerName, HTMLElement>>(new Map())
  const ready = useFacePreload()

  // Emotion target ref — updated from prop, lerped in rAF
  const emotionTargetRef = useRef<EmotionOffsets>(EMOTION_MAP.neutral)
  const emotionCurrentRef = useRef<EmotionOffsets>({ ...EMOTION_MAP.neutral })

  // Update emotion target when prop changes (only active during idle/satisfied)
  const updateEmotionTarget = useCallback((newEmotion: FaceEmotion, currentState: FaceState) => {
    const isEmotionActive = currentState === "idle" || currentState === "satisfied"
    emotionTargetRef.current = isEmotionActive ? EMOTION_MAP[newEmotion] : EMOTION_MAP.neutral
  }, [])

  useEffect(() => {
    updateEmotionTarget(emotion, state)
  }, [emotion, state, updateEmotionTarget])

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

    /* ── Thinking state ── */
    let thinkingFixationIndex = 0
    let nextMicroSaccadeAt = performance.now() + 4000 + Math.random() * 2000
    let microSaccadeBurstCount = 0
    let microSaccadeBurstEnd = 0
    let thinkingLipTension = 0

    /* ── Eyebrow (unused — left brow is static) ── */

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

      /* ── Lerp emotion offsets toward target ── */
      const emo = emotionCurrentRef.current
      const emoTarget = emotionTargetRef.current
      const emoLerp = 0.03 // ~500ms convergence at 60fps
      emo.eyeOpenness += (emoTarget.eyeOpenness - emo.eyeOpenness) * emoLerp
      emo.irisX += (emoTarget.irisX - emo.irisX) * emoLerp
      emo.irisY += (emoTarget.irisY - emo.irisY) * emoLerp
      emo.lipLineY += (emoTarget.lipLineY - emo.lipLineY) * emoLerp
      emo.lipUpperY += (emoTarget.lipUpperY - emo.lipUpperY) * emoLerp
      emo.jawY += (emoTarget.jawY - emo.jawY) * emoLerp

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

      // Upper eyelids — fold in emotion eye openness
      const emoEyeOffset = emo.eyeOpenness * h
      const upperY = blink * h * 0.016 - emoEyeOffset
      for (const name of ["eye-left-upper", "eye-right-upper"] as const) {
        const el = get(name)
        if (el) el.style.transform = `translateY(${upperY}px)`
      }

      // Lower eyelids — visible during blink or when emotion closes eyes (bored)
      const lowerBlinkY = blink * h * 0.006
      const lowerEmoY = emo.eyeOpenness < 0 ? Math.abs(emo.eyeOpenness) * h * 0.5 : 0
      const showLower = blink > 0.15 || lowerEmoY > 0.1
      for (const name of ["eye-left-lower", "eye-right-lower"] as const) {
        const el = get(name)
        if (el) {
          el.style.opacity = showLower ? "1" : "0"
          el.style.transform = `translateY(${-(lowerBlinkY + lowerEmoY)}px)`
        }
      }

      /* ────────────────────────────────
         Iris — saccadic movement
         (quick jumps, not smooth drifts)
         ──────────────────────────────── */

      if (now >= nextSaccadeAt && saccadeProgress >= 1) {
        if (state === "idle" || state === "satisfied") {
          // Random gaze points within a natural range
          eyeTarget.x = (Math.random() - 0.5) * 1.6
          eyeTarget.y = (Math.random() - 0.5) * 0.8
        } else if (state === "thinking") {
          // Cycle through thought fixation points with random offsets
          thinkingFixationIndex = (thinkingFixationIndex + 1 + Math.floor(Math.random() * 2)) % THOUGHT_FIXATIONS.length
          const fix = THOUGHT_FIXATIONS[thinkingFixationIndex]
          eyeTarget.x = fix.x + (Math.random() - 0.5) * 0.25
          eyeTarget.y = fix.y + (Math.random() - 0.5) * 0.15
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
        // Thinking: shorter saccade intervals (700-1900ms)
        const interval = state === "idle" ? 1500 + Math.random() * 2500
          : state === "thinking" ? 700 + Math.random() * 1200
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

      // Micro-saccade bursts during thinking (~every 5s, rapid tiny movements within 200ms)
      let microSaccadeX = 0
      let microSaccadeY = 0
      if (state === "thinking") {
        if (now >= nextMicroSaccadeAt && microSaccadeBurstCount === 0) {
          microSaccadeBurstCount = 3 + Math.floor(Math.random() * 3)
          microSaccadeBurstEnd = now + 200
          nextMicroSaccadeAt = now + 4000 + Math.random() * 3000
        }
        if (microSaccadeBurstCount > 0 && now < microSaccadeBurstEnd) {
          microSaccadeX = (Math.random() - 0.5) * 0.15
          microSaccadeY = (Math.random() - 0.5) * 0.1
          microSaccadeBurstCount--
        } else if (now >= microSaccadeBurstEnd) {
          microSaccadeBurstCount = 0
        }
      }

      // Micro-tremor (physiological nystagmus) — tiny constant jitter
      const tremX = (noise(s * 8, 1) - 0.5) * 0.06
      const tremY = (noise(s * 8, 2) - 0.5) * 0.04

      const irisX = (eye.x + tremX + microSaccadeX + emo.irisX) * h * 0.006
      const irisY = (eye.y + tremY + microSaccadeY + emo.irisY) * h * 0.005
      const irisOpacity = blink > 0.85 ? 0 : 1

      for (const name of ["iris-left", "iris-right"] as const) {
        const el = get(name)
        if (el) {
          el.style.transform = `translate(${irisX}px, ${irisY}px)`
          el.style.opacity = String(irisOpacity)
        }
      }

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

      // Thinking lip tension — slight upward pull (pressed-lips concentration)
      if (state === "thinking") {
        thinkingLipTension += (1 - thinkingLipTension) * 0.03
      } else {
        thinkingLipTension *= 0.95
      }

      // Apply volume with slight asymmetry (jaw leads, lips follow)
      // + emotion offsets + thinking lip tension
      const jawY = vol * h * 0.02 + emo.jawY * h
      const lipLowY = vol * h * 0.015
      const lipLineY = vol * h * 0.006 + emo.lipLineY * h - thinkingLipTension * h * 0.002
      const lipUpY = -(vol * h * 0.003) + emo.lipUpperY * h - thinkingLipTension * h * 0.001

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
      style={{
        width,
        height,
        position: "relative",
        flexShrink: 0,
        opacity: ready ? 1 : 0,
        transition: "opacity 0.5s ease-out",
      }}
      aria-label="Vera, your AI coach"
      role="img"
    >
      {/* Ambient glow behind face */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "140%",
          height: "140%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(36 56% 48% / 0.15) 0%, hsl(36 56% 48% / 0.06) 40%, transparent 70%)",
          filter: "blur(30px)",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
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
