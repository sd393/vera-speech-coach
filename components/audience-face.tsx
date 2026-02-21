"use client"

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "satisfied"

export interface AudienceFaceProps {
  state: FaceState
  analyserNode?: AnalyserNode | null
  size?: number
}

export function AudienceFace({ size = 200 }: AudienceFaceProps) {
  const aspect = 1696 / 2528
  const width = size * aspect
  const height = size

  return (
    <div
      style={{ width, height, position: "relative", flexShrink: 0 }}
      aria-label="Vera, your AI coach"
      role="img"
    >
      <img
        src="/face.svg"
        alt=""
        draggable={false}
        width={width}
        height={height}
        style={{ userSelect: "none" }}
      />
    </div>
  )
}
