'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { PoseFrame, MovementType } from '@/types'
import { renderSkeleton, renderGhostSkeleton, interpolateLandmarks } from './SkeletonRenderer'
import { LANDMARK_NAMES } from '@/lib/pose/angles'

interface PoseCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  frames: PoseFrame[]
  flaggedJoints?: Set<number>
  pulsedJoints?: Set<number>
  showOverlay: boolean
  currentTime: number
  movementType: MovementType
  referenceFrames?: PoseFrame[]
  showIdeal?: boolean
}

/**
 * Compute the actual video content rect inside an object-contain video element.
 * Letterbox / pillarbox bars are accounted for so landmarks map correctly.
 */
function getVideoBounds(vW: number, vH: number, cW: number, cH: number) {
  const vAR = vW / vH
  const cAR = cW / cH
  let renderW: number, renderH: number, offsetX: number, offsetY: number
  if (vAR > cAR) {
    renderW = cW; renderH = cW / vAR; offsetX = 0; offsetY = (cH - renderH) / 2
  } else {
    renderH = cH; renderW = cH * vAR; offsetX = (cW - renderW) / 2; offsetY = 0
  }
  return { renderW, renderH, offsetX, offsetY }
}

export default function PoseCanvas({
  videoRef, frames,
  flaggedJoints = new Set(), pulsedJoints = new Set(),
  showOverlay, currentTime, movementType,
  referenceFrames = [], showIdeal = false,
}: PoseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef<number>(0)
  const [hoveredJoint, setHoveredJoint] = useState<{ index: number; name: string; x: number; y: number } | null>(null)

  // Mutable refs so the RAF loop always reads latest without restarting
  const framesRef = useRef(frames)
  const showOverlayRef = useRef(showOverlay)
  const flaggedRef = useRef(flaggedJoints)
  const pulsedRef = useRef(pulsedJoints)
  const refFramesRef = useRef(referenceFrames)
  const showIdealRef = useRef(showIdeal)

  useEffect(() => { framesRef.current = frames }, [frames])
  useEffect(() => { showOverlayRef.current = showOverlay }, [showOverlay])
  useEffect(() => { flaggedRef.current = flaggedJoints }, [flaggedJoints])
  useEffect(() => { pulsedRef.current = pulsedJoints }, [pulsedJoints])
  useEffect(() => { refFramesRef.current = referenceFrames }, [referenceFrames])
  useEffect(() => { showIdealRef.current = showIdeal }, [showIdeal])

  const getLandmarksAtTime = useCallback((time: number, fs: PoseFrame[]) => {
    if (!fs.length) return null
    let lo = 0, hi = fs.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (fs[mid].timestamp < time) lo = mid + 1
      else hi = mid
    }
    if (lo === 0) return fs[0].landmarks
    const prev = fs[lo - 1], next = fs[lo]
    const span = next.timestamp - prev.timestamp
    const t = span > 0 ? (time - prev.timestamp) / span : 1
    return interpolateLandmarks(prev.landmarks, next.landmarks, Math.min(1, Math.max(0, t)))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')!
    let animFrame: number

    const draw = () => {
      pulseRef.current += 0.08

      const vW = video.videoWidth
      const vH = video.videoHeight
      const cW = video.clientWidth
      const cH = video.clientHeight

      if (!vW || !vH || !cW || !cH) {
        animFrame = requestAnimationFrame(draw)
        return
      }

      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== cW * dpr) canvas.width = cW * dpr
      if (canvas.height !== cH * dpr) canvas.height = cH * dpr
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { renderW, renderH, offsetX, offsetY } = getVideoBounds(vW, vH, cW, cH)
      const t = video.currentTime

      // Normalize reference time: map user time onto reference duration
      const refFs = refFramesRef.current
      let refTime = t
      if (refFs.length > 1) {
        const refDur = refFs[refFs.length - 1].timestamp
        const userDur = framesRef.current.length > 1 ? framesRef.current[framesRef.current.length - 1].timestamp : 1
        refTime = userDur > 0 ? (t / userDur) * refDur : t
      }

      const userLms = framesRef.current.length > 0 ? getLandmarksAtTime(t, framesRef.current) : null
      const refLms = showIdealRef.current && refFs.length > 0 ? getLandmarksAtTime(refTime, refFs) : null

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.translate(offsetX, offsetY)

      // Draw reference ghost skeleton first (behind user skeleton)
      if (refLms) {
        renderGhostSkeleton(ctx, refLms, renderW, renderH)
      }

      if (showOverlayRef.current && userLms) {
        renderSkeleton(ctx, userLms, renderW, renderH, flaggedRef.current, pulsedRef.current, {}, pulseRef.current)
      }

      ctx.restore()

      animFrame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animFrame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, getLandmarksAtTime])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !showOverlay) { setHoveredJoint(null); return }

    const rect = canvas.getBoundingClientRect()
    const vW = video.videoWidth || 640
    const vH = video.videoHeight || 480
    // Use CSS dimensions (clientWidth/Height) so coords stay in CSS pixel space
    const cW = canvas.clientWidth
    const cH = canvas.clientHeight

    const { renderW, renderH, offsetX, offsetY } = getVideoBounds(vW, vH, cW, cH)
    const mx = (e.clientX - rect.left) - offsetX
    const my = (e.clientY - rect.top) - offsetY

    if (mx < 0 || mx > renderW || my < 0 || my > renderH) {
      setHoveredJoint(null)
      return
    }

    const lms = getLandmarksAtTime(currentTime, framesRef.current)
    if (!lms) return

    for (let i = 0; i < lms.length; i++) {
      const lm = lms[i]
      if (!LANDMARK_NAMES[i]) continue
      const lx = lm.x * renderW
      const ly = lm.y * renderH
      if (Math.hypot(mx - lx, my - ly) < 16) {
        setHoveredJoint({ index: i, name: LANDMARK_NAMES[i], x: e.clientX - rect.left, y: e.clientY - rect.top })
        return
      }
    }
    setHoveredJoint(null)
  }, [currentTime, getLandmarksAtTime, showOverlay, videoRef])

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: showOverlay ? 'auto' : 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredJoint(null)}
      />
      {hoveredJoint && (
        <div
          className="absolute z-20 pointer-events-none px-2.5 py-1.5 bg-zinc-900/95 border border-zinc-600 rounded-lg text-xs text-white whitespace-nowrap shadow-xl"
          style={{ left: hoveredJoint.x + 12, top: hoveredJoint.y - 28 }}
        >
          <span className="font-mono text-purple-300">{hoveredJoint.name}</span>
        </div>
      )}
    </div>
  )
}
