'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { PoseFrame, DetectedIssue, MovementType } from '@/types'
import FrameScrubber from './FrameScrubber'
import { Play, Pause, Eye, EyeOff, Upload, Ghost, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const PoseCanvas = dynamic(() => import('./PoseCanvas'), { ssr: false })

interface PoseOverlayProps {
  videoSrc: string
  frames: PoseFrame[]
  detectedIssues: DetectedIssue[]
  activeIssueId?: string | null
  movementType: MovementType
  onTimeChange?: (time: number) => void
}

export default function PoseOverlay({
  videoSrc, frames, detectedIssues, activeIssueId,
  movementType, onTimeChange,
}: PoseOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const refInputRef = useRef<HTMLInputElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [referenceFrames, setReferenceFrames] = useState<PoseFrame[]>([])
  const [showIdeal, setShowIdeal] = useState(true)
  const [refStatus, setRefStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const [refProgress, setRefProgress] = useState(0)

  const flaggedJoints = new Set<number>(detectedIssues.flatMap(i => i.affectedJoints))
  const pulsedJoints = new Set<number>(
    activeIssueId
      ? (detectedIssues.find(i => i.id === activeIssueId)?.affectedJoints ?? [])
      : []
  )

  const issueMarkers = detectedIssues.flatMap(issue =>
    issue.frames.slice(0, 2).map(fi => {
      const frame = frames[Math.min(fi, frames.length - 1)]
      return {
        time: frame?.timestamp ?? (fi / Math.max(frames.length, 1)) * duration,
        color: issue.severity === 'severe' ? '#ef4444' : issue.severity === 'moderate' ? '#f97316' : '#eab308',
      }
    })
  )

  useEffect(() => {
    if (!activeIssueId || !videoRef.current || !frames.length) return
    const issue = detectedIssues.find(i => i.id === activeIssueId)
    if (!issue?.frames.length) return
    const frame = frames[Math.min(issue.frames[0], frames.length - 1)]
    if (frame) { videoRef.current.currentTime = frame.timestamp; setCurrentTime(frame.timestamp) }
  }, [activeIssueId, detectedIssues, frames])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  const handleReferenceFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setRefStatus('loading')
    setRefProgress(0)

    try {
      const { extractPoseFromVideo } = await import('@/lib/pose/mediapipe')
      const url = URL.createObjectURL(file)
      const refVideo = document.createElement('video')
      refVideo.src = url
      refVideo.muted = true
      refVideo.playsInline = true
      refVideo.crossOrigin = 'anonymous'

      await new Promise<void>((resolve, reject) => {
        refVideo.onloadedmetadata = () => resolve()
        refVideo.onerror = reject
        refVideo.load()
      })

      const frames = await extractPoseFromVideo(refVideo, (p) => setRefProgress(p))
      URL.revokeObjectURL(url)

      setReferenceFrames(frames)
      setRefStatus('ready')
      setShowIdeal(true)
    } catch {
      setRefStatus('idle')
    }
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    v.paused ? v.play() : v.pause()
  }, [])

  const handleScrub = useCallback((t: number) => {
    const v = videoRef.current; if (!v) return
    v.currentTime = t; setCurrentTime(t)
    onTimeChange?.(t)
  }, [onTimeChange])

  const rates = [0.25, 0.5, 1, 1.5, 2]

  return (
    <div className="flex flex-col gap-3">
      {/* Video container */}
      <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl aspect-video">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onTimeUpdate={e => { const t = e.currentTarget.currentTime; setCurrentTime(t); onTimeChange?.(t) }}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />

        {showOverlay && (
          <PoseCanvas
            videoRef={videoRef}
            frames={frames}
            flaggedJoints={flaggedJoints}
            pulsedJoints={pulsedJoints}
            showOverlay={showOverlay}
            currentTime={currentTime}
            movementType={movementType}
            referenceFrames={referenceFrames}
            showIdeal={showIdeal && refStatus === 'ready'}
          />
        )}

        {/* Legend */}
        {showOverlay && frames.length > 0 && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] font-mono">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              <span className="text-zinc-300">You</span>
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block ml-2" />
              <span className="text-zinc-300">Flagged</span>
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block ml-2" />
              <span className="text-zinc-300">Active</span>
              {refStatus === 'ready' && (
                <>
                  <span className="w-2 h-2 rounded-full bg-violet-400 inline-block ml-2" />
                  <span className="text-zinc-300">Ref</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Controls — top right */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {/* Reference upload button */}
          <input
            ref={refInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleReferenceFile}
          />

          {refStatus === 'loading' && (
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-zinc-700 rounded-lg px-2.5 py-1.5">
              <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
              <span className="text-[10px] font-mono text-zinc-400">{Math.round(refProgress * 100)}%</span>
            </div>
          )}

          {refStatus === 'ready' && (
            <button
              onClick={() => setShowIdeal(!showIdeal)}
              title={showIdeal ? 'Hide reference' : 'Show reference'}
              className={cn(
                'p-2 rounded-lg border backdrop-blur-sm transition-all',
                showIdeal
                  ? 'bg-violet-600/70 border-violet-500 text-white'
                  : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
              )}
            >
              <Ghost className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => refInputRef.current?.click()}
            title="Upload reference video"
            className={cn(
              'p-2 rounded-lg border backdrop-blur-sm transition-all',
              refStatus === 'ready'
                ? 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
                : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
            )}
          >
            {refStatus === 'ready'
              ? <CheckCircle className="w-3.5 h-3.5 text-violet-400" />
              : <Upload className="w-3.5 h-3.5" />
            }
          </button>

          <button
            onClick={() => setShowOverlay(!showOverlay)}
            title={showOverlay ? 'Hide skeleton' : 'Show skeleton'}
            className={cn(
              'p-2 rounded-lg border backdrop-blur-sm transition-all',
              showOverlay
                ? 'bg-green-600/80 border-green-500 text-white'
                : 'bg-black/60 border-zinc-700 text-zinc-400 hover:text-white'
            )}
          >
            {showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Centre play button */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Scrubber + transport */}
      <div className="space-y-2">
        <FrameScrubber
          duration={duration}
          currentTime={currentTime}
          onChange={handleScrub}
          issueMarkers={issueMarkers}
        />

        <div className="flex items-center justify-between">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white ml-0.5" />}
          </button>

          <div className="flex items-center gap-1">
            {rates.map(r => (
              <button
                key={r}
                onClick={() => setPlaybackRate(r)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-mono transition-colors',
                  playbackRate === r ? 'bg-[#00FF9D] text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                )}
              >
                {r}x
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-zinc-600">
            {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  )
}
