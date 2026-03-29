'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Square, Loader2, AlertCircle, Mic, MicOff } from 'lucide-react'
import { renderSkeleton } from '@/components/pose/SkeletonRenderer'
import { loadMediapipePose } from '@/lib/pose/loadMediapipe'
import { detectIssues } from '@/lib/pose/detection'
import type { MovementType, PoseFrame, DetectedIssue, PoseLandmark } from '@/types'
import { createRepCounter, type RepCounterState } from '@/lib/pose/repCounter'
import { voiceCoach } from '@/lib/pose/voiceCoach'
import { cn } from '@/lib/utils'

interface LiveRecorderProps {
  movementType: MovementType
  onRecordingComplete: (
    blob: Blob,
    blobUrl: string,
    frames: PoseFrame[],
    issues: DetectedIssue[],
    repCount: number,
  ) => void
}

type RecordState = 'idle' | 'requesting' | 'ready' | 'recording' | 'processing' | 'error'

const MOVEMENTS_WITH_REPS = new Set(['squat', 'lunge', 'jump_landing', 'deadlift'])

const SEV_COLOR: Record<string, string> = {
  severe:   'bg-red-500/20 border-red-500/50 text-red-300',
  moderate: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
  mild:     'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
}

export default function LiveRecorder({ movementType, onRecordingComplete }: LiveRecorderProps) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const mediaRecRef   = useRef<MediaRecorder | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const poseRef       = useRef<unknown>(null)
  const chunksRef     = useRef<Blob[]>([])
  const rafRef        = useRef<number>(0)
  const allFramesRef  = useRef<PoseFrame[]>([])
  const frameIdxRef   = useRef(0)
  const repCounterRef = useRef(createRepCounter(movementType))
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idleTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastLandmarksRef = useRef<PoseLandmark[] | null>(null)
  const framesSentRef    = useRef(0)
  const sendTimestampRef = useRef(0)   // timestamp of the frame currently in-flight to MediaPipe
  const fpsCountRef   = useRef(0)
  const lastFpsRef    = useRef(Date.now())
  const prevRepCount  = useRef(0)
  const voiceOnRef    = useRef(true)
  const canvasSizedRef = useRef(false)

  const [state, setState]           = useState<RecordState>('idle')
  const [error, setError]           = useState<string | null>(null)
  const [elapsed, setElapsed]       = useState(0)
  const [fps, setFps]               = useState(0)
  const [voiceOn, setVoiceOn]       = useState(true)
  const [repState, setRepState]     = useState<RepCounterState | null>(null)
  const [liveIssues, setLiveIssues] = useState<DetectedIssue[]>([])
  const [formScore, setFormScore]   = useState<number | null>(null)
  const [repTimes, setRepTimes]     = useState<number[]>([])
  const lastRepTimeRef = useRef<number>(0)

  useEffect(() => { voiceOnRef.current = voiceOn }, [voiceOn])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
      if (elapsedRef.current)     clearInterval(elapsedRef.current)
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current)
      if (idleTimerRef.current)   clearInterval(idleTimerRef.current)
      ;(poseRef.current as { close?: () => void })?.close?.()
      voiceCoach.stop()
    }
  }, [])

  const runRealtimeDetection = useCallback(() => {
    const frames = allFramesRef.current
    if (frames.length < 15) return
    try {
      const issues = detectIssues(frames.slice(-90), movementType)
      setLiveIssues(issues)

      const sevScore: Record<string, number> = { severe: 20, moderate: 50, mild: 75 }
      setFormScore(
        issues.length === 0 ? 95 :
          issues.reduce((min, i) => Math.min(min, sevScore[i.severity] ?? 75), 100)
      )

      if (voiceOnRef.current) {
        issues.slice(0, 1).forEach(i => voiceCoach.onIssue(i.type))
      }
    } catch { /* non-blocking */ }
  }, [movementType])

  const startCamera = useCallback(async () => {
    setState('requesting')
    setError(null)
    allFramesRef.current = []
    frameIdxRef.current = 0
    canvasSizedRef.current = false
    repCounterRef.current = createRepCounter(movementType)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await new Promise<void>(res => { video.onloadedmetadata = () => res() })
      video.play()

      // Load mediapipe (pre-loaded via layout.tsx Script tag)
      const { Pose } = await loadMediapipePose()
      const pose = new Pose({
        locateFile: (f: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
      })
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      poseRef.current = pose

      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!

      pose.onResults((results: unknown) => {
        const r = results as { poseLandmarks?: PoseLandmark[] }
        if (!r.poseLandmarks) return
        lastLandmarksRef.current = r.poseLandmarks

        const frame: PoseFrame = {
          // Use the timestamp captured when the frame was SENT to MediaPipe,
          // not video.currentTime now (onResults fires 30-50ms later, causing
          // the stored timestamp to be ahead of the actual frame position).
          timestamp: sendTimestampRef.current,
          frameIndex: frameIdxRef.current++,
          landmarks: r.poseLandmarks.map(lm => ({
            x: lm.x, y: lm.y, z: lm.z ?? 0, visibility: lm.visibility ?? 1,
          })),
        }
        allFramesRef.current.push(frame)

        // Rep counting
        const rs = repCounterRef.current.update(frame.landmarks, frame.timestamp)
        if (rs.repCount > prevRepCount.current) {
          prevRepCount.current = rs.repCount
          const now = Date.now()
          if (lastRepTimeRef.current > 0) {
            setRepTimes(prev => [...prev.slice(-4), (now - lastRepTimeRef.current) / 1000])
          }
          lastRepTimeRef.current = now
          if (voiceOnRef.current) {
            const lastRep = rs.repHistory[rs.repHistory.length - 1]
            voiceCoach.onRep(rs.repCount, lastRep?.depthScore ?? 0)
          }
        }
        setRepState({ ...rs })
      })

      const drawLoop = () => {
        if (!video || !canvas) return

        // Set canvas dimensions once when video is ready
        if (!canvasSizedRef.current && video.videoWidth > 0) {
          canvas.width  = video.videoWidth
          canvas.height = video.videoHeight
          canvasSizedRef.current = true
        }

        const w = canvas.width  || 1280
        const h = canvas.height || 720

        ctx.clearRect(0, 0, w, h)

        // Mirror the canvas horizontally (selfie-camera feel)
        ctx.save()
        ctx.scale(-1, 1)
        ctx.translate(-w, 0)
        ctx.drawImage(video, 0, 0, w, h)
        ctx.restore()

        // Draw skeleton — mirror landmark x-coords to match the flipped canvas
        const lms = lastLandmarksRef.current
        if (lms) {
          const mirrored = lms.map(lm => ({ ...lm, x: 1 - lm.x }))
          renderSkeleton(ctx, mirrored, w, h, new Set(), new Set(), {}, Date.now() / 200)
        }

        // FPS counter
        fpsCountRef.current++
        const now = Date.now()
        if (now - lastFpsRef.current >= 1000) {
          setFps(fpsCountRef.current)
          fpsCountRef.current = 0
          lastFpsRef.current  = now
        }

        // Send every 3rd frame to pose (~10fps detection at 30fps display).
        // Capture the send timestamp HERE (before the async gap) so onResults
        // stores the timestamp of the actual frame, not of when results came back.
        if (framesSentRef.current % 3 === 0 && video.readyState >= 2) {
          sendTimestampRef.current = video.currentTime
          ;(pose as { send: (i: { image: HTMLVideoElement }) => Promise<void> })
            .send({ image: video }).catch(() => {})
        }
        framesSentRef.current++

        rafRef.current = requestAnimationFrame(drawLoop)
      }
      rafRef.current = requestAnimationFrame(drawLoop)

      // Issue detection every 3s
      detectionTimerRef.current = setInterval(runRealtimeDetection, 3000)

      setState('ready')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Camera error'
      setError(msg.includes('Permission') || msg.includes('denied')
        ? 'Camera permission denied. Allow access in browser settings.'
        : msg)
      setState('error')
    }
  }, [movementType, runRealtimeDetection])

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Reset state for new recording
    allFramesRef.current = []
    frameIdxRef.current = 0
    prevRepCount.current = 0
    lastRepTimeRef.current = 0
    repCounterRef.current = createRepCounter(movementType)
    chunksRef.current = []
    setRepState(null)
    setLiveIssues([])
    setFormScore(null)
    setRepTimes([])

    // Record from the raw camera stream (not canvas.captureStream).
    // Canvas-captured WebM has no seek index and embeds the skeleton overlay,
    // making re-extraction in analysis inaccurate and the seekbar non-functional.
    // The camera stream produces a proper seekable WebM with clean frames.
    const cameraStream = streamRef.current
    if (!cameraStream) return
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm'
    const recorder = new MediaRecorder(cameraStream, { mimeType })

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      setState('processing')
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url  = URL.createObjectURL(blob)

      // Normalize timestamps so they start from 0.
      // The live stream's currentTime advances from when the stream opened (before
      // the user clicked Record), so frames might start at e.g. 5.2s while the
      // recorded video starts at 0s. PoseCanvas does getLandmarksAtTime(videoTime)
      // and finds nothing when there's this offset.
      const rawFrames = allFramesRef.current
      const startTs = rawFrames[0]?.timestamp ?? 0
      const frames = rawFrames.map(f => ({ ...f, timestamp: f.timestamp - startTs }))

      const finalRepCount = repCounterRef.current.state.repCount

      let issues: DetectedIssue[] = []
      try { issues = detectIssues(frames, movementType) } catch { /* pass */ }

      if (voiceOnRef.current) voiceCoach.onStop(finalRepCount)
      onRecordingComplete(blob, url, frames, issues, finalRepCount)
    }

    recorder.start(100)
    mediaRecRef.current = recorder
    setState('recording')
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    if (voiceOnRef.current) voiceCoach.onStart(movementType)

    // Idle voice prompts every 12s
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    idleTimerRef.current = setInterval(() => {
      if (voiceOnRef.current) voiceCoach.onIdle()
    }, 12000)
  }, [movementType, onRecordingComplete])

  const stopRecording = useCallback(() => {
    mediaRecRef.current?.stop()
    if (elapsedRef.current)  clearInterval(elapsedRef.current)
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
  }, [])

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const showReps = MOVEMENTS_WITH_REPS.has(movementType)
  const avgRepTime = repTimes.length
    ? (repTimes.reduce((a, b) => a + b, 0) / repTimes.length).toFixed(1)
    : null

  return (
    <div className="space-y-3">
      {/* Main recording area */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/[0.08]">
        {/* Video element used as WebRTC source for canvas + MediaPipe — must not be display:none */}
        <video ref={videoRef} className="absolute opacity-0 pointer-events-none w-0 h-0" muted playsInline />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

        {/* Idle overlay */}
        <AnimatePresence>
          {(state === 'idle' || state === 'requesting') && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90"
            >
              {state === 'requesting' ? (
                <>
                  <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                  <p className="text-sm text-white/60 font-mono">Initialising camera & pose model…</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
                    <Video className="w-7 h-7 text-white/30" />
                  </div>
                  <p className="text-sm text-white/70 mb-1">Record your {movementType.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-white/30">Real-time skeleton · rep counting · voice coaching</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error overlay */}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Processing overlay */}
        {state === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
            <p className="text-sm text-white/60 font-mono">Analysing recording…</p>
          </div>
        )}

        {/* Top-left: recording timer + fps */}
        {(state === 'recording' || state === 'ready') && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            {state === 'recording' && (
              <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-mono font-bold">{fmt(elapsed)}</span>
              </div>
            )}
            {fps > 0 && (
              <div className="bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-mono text-white/40">
                {fps}fps
              </div>
            )}
          </div>
        )}

        {/* Top-right: voice toggle */}
        {(state === 'recording' || state === 'ready') && (
          <button
            onClick={() => setVoiceOn(v => !v)}
            className={cn(
              'absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm border transition-all',
              voiceOn
                ? 'bg-purple-600/80 border-purple-500 text-white'
                : 'bg-black/50 border-white/20 text-white/40'
            )}
            title={voiceOn ? 'Mute voice coach' : 'Enable voice coach'}
          >
            {voiceOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Bottom-left: Rep counter */}
        {state === 'recording' && showReps && repState && (
          <div className="absolute bottom-4 left-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10 min-w-[90px]">
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Reps</div>
              <div className="text-5xl font-bold text-white font-mono leading-none">{repState.repCount}</div>
              {/* Depth bar */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-100',
                        repState.currentDepth >= 80 ? 'bg-green-400' :
                        repState.currentDepth >= 50 ? 'bg-yellow-400' : 'bg-white/20'
                      )}
                      style={{ width: `${repState.currentDepth}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-white/30">{repState.currentDepth}%</span>
                </div>
                <div className="text-[9px] font-mono text-purple-400/80 capitalize">{repState.phase}</div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom-right: Form score */}
        {state === 'recording' && formScore !== null && (
          <div className="absolute bottom-4 right-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10 text-right">
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-0.5">Form</div>
              <div className={cn('text-3xl font-bold font-mono leading-none',
                formScore >= 80 ? 'text-green-400' : formScore >= 60 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {formScore}
              </div>
              {avgRepTime && (
                <div className="text-[9px] font-mono text-white/30 mt-1">{avgRepTime}s/rep</div>
              )}
            </div>
          </div>
        )}

        {/* Centre-top: Live issue badges */}
        {state === 'recording' && liveIssues.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 max-w-[60%]">
            <AnimatePresence>
              {liveIssues.slice(0, 2).map(issue => (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={cn(
                    'text-[10px] font-mono px-3 py-1 rounded-full border backdrop-blur-sm',
                    SEV_COLOR[issue.severity]
                  )}
                >
                  {issue.type.replace(/_/g, ' ')}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-center gap-4">
        {state === 'idle' && (
          <button
            onClick={startCamera}
            className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white rounded-full px-7 py-3 text-sm font-mono transition-all"
          >
            <Video className="w-4 h-4" />
            Enable Camera
          </button>
        )}

        {state === 'ready' && (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-full px-9 py-3.5 text-sm font-bold font-mono transition-all shadow-lg shadow-red-900/40"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              Start Recording
            </button>
            <button
              onClick={() => setVoiceOn(v => !v)}
              className={cn(
                'p-3 rounded-full border transition-all',
                voiceOn
                  ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                  : 'bg-white/[0.05] border-white/10 text-white/30'
              )}
            >
              {voiceOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </>
        )}

        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-white rounded-full px-9 py-3.5 text-sm font-bold font-mono transition-all"
          >
            <Square className="w-4 h-4 fill-white" />
            Stop &amp; Analyse
          </button>
        )}
      </div>

      {/* Live stats strip */}
      {state === 'recording' && (
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              label: 'Reps',
              value: showReps ? String(repState?.repCount ?? 0) : '—',
              color: 'text-white',
            },
            {
              label: 'Form',
              value: formScore !== null ? String(formScore) : '…',
              color: formScore === null ? 'text-white/30'
                : formScore >= 80 ? 'text-green-400'
                : formScore >= 60 ? 'text-yellow-400'
                : 'text-red-400',
            },
            {
              label: 'Phase',
              value: repState
                ? repState.phase.charAt(0).toUpperCase() + repState.phase.slice(1)
                : '—',
              color: 'text-purple-300',
            },
            {
              label: 'Issues',
              value: String(liveIssues.length),
              color: liveIssues.length > 0 ? 'text-orange-400' : 'text-white',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-3 py-3 text-center">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">{label}</div>
              <div className={cn('text-base font-bold font-mono', color)}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
