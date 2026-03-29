'use client'

import { useRef, useCallback } from 'react'

interface FrameScrubberProps {
  duration: number
  currentTime: number
  onChange: (time: number) => void
  issueMarkers?: { time: number; color: string }[]
}

export default function FrameScrubber({ duration, currentTime, onChange, issueMarkers = [] }: FrameScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current
    if (!bar || duration === 0) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChange(ratio * duration)
  }, [duration, onChange])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const fmt = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0')
    const s = Math.floor(t % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="w-full">
      <div
        ref={barRef}
        className="relative h-2 bg-zinc-800 rounded-full cursor-pointer group"
        onClick={handleClick}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-purple-500 rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-none"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
        {/* Issue markers */}
        {issueMarkers.map((marker, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-0.5 opacity-80"
            style={{
              left: `${(marker.time / duration) * 100}%`,
              backgroundColor: marker.color,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-zinc-500">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  )
}
