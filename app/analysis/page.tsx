'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity, AlertTriangle, BarChart2, Bot, ChevronLeft, CheckCircle,
  Zap, Clock, Layers,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSessionStore } from '@/stores/sessionStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { extractPoseFromVideo } from '@/lib/pose/mediapipe'
import { detectIssues } from '@/lib/pose/detection'
import { computeScores } from '@/lib/pose/scoring'
import { buildSkeletonSummary, compressPoseData } from '@/lib/pose/skeleton'
import { detectKeyMoments } from '@/lib/pose/keyMoments'
import { generateCoachingFeedback } from '@/lib/gemini/client'
import type { DetectedIssue } from '@/types'
import IssueCard from '@/components/analysis/IssueCard'
import AIFeedback from '@/components/analysis/AIFeedback'
import ProgressBar from '@/components/upload/ProgressBar'
import { cn } from '@/lib/utils'

const PoseOverlay = dynamic(() => import(/* webpackMode: "eager" */ '@/components/pose/PoseOverlay'), { ssr: false })
const ScoreGauges = dynamic(() => import(/* webpackMode: "eager" */ '@/components/analysis/ScoreGauges'), { ssr: false })

type RightTab = 'scores' | 'issues' | 'coach'

const TAB_CONFIG: { id: RightTab; label: string; icon: React.ReactNode }[] = [
  { id: 'scores', label: 'Scores',   icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'issues', label: 'Issues',   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: 'coach',  label: 'AI Coach', icon: <Bot className="w-3.5 h-3.5" /> },
]

function AnalysisContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const {
    sessionId, videoBlobUrl, videoUrl, poseFrames, scores, detectedIssues,
    aiFeedback, movementType, durationSeconds, repCount,
    setPoseFrames, setScores, setDetectedIssues, setAiFeedback, setDuration,
  } = useSessionStore()

  const { status, progress, errorMessage, activeIssueId, setStatus, setProgress, setError, setActiveIssueId } = useAnalysisStore()

  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<RightTab>('scores')
  const [keyMomentLabels, setKeyMomentLabels] = useState<string[]>([])
  const processingRef = useRef(false)
  const currentSessionId = searchParams.get('session') ?? sessionId

  // Auto-switch to issues tab when analysis completes with issues found
  useEffect(() => {
    if (status === 'complete' && detectedIssues.length > 0) setActiveTab('issues')
  }, [status, detectedIssues.length])

  // Auto-switch to coach tab when AI feedback arrives
  useEffect(() => {
    if (aiFeedback) setActiveTab('coach')
  }, [aiFeedback])

  const runAnalysis = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('processing')

    try {
      // Always read directly from the Zustand store to avoid stale closure issues.
      // useCallback captures values at render time; store.getState() always returns current.
      const storeSnapshot = useSessionStore.getState()
      let frames = storeSnapshot.poseFrames
      const preseededIssues = storeSnapshot.detectedIssues
      const storedMovement = storeSnapshot.movementType
      const storedRepCount = storeSnapshot.repCount
      let sessionDuration = storeSnapshot.durationSeconds
      const blobUrl = storeSnapshot.videoBlobUrl

      // Skip re-extraction if frames were pre-seeded from live recording.
      // If WASM failed during recording and frames are empty, we fall through to
      // extraction — the video is now a raw camera stream (seekable, no overlay),
      // so extraction will give correct results.
      if (!frames.length) {
        if (!blobUrl) throw new Error('No video source')
        const videoEl = document.createElement('video')
        videoEl.src = blobUrl
        videoEl.muted = true
        await new Promise<void>((res, rej) => {
          videoEl.addEventListener('loadedmetadata', () => res())
          videoEl.addEventListener('error', () => rej(new Error('Video failed to load. Try a different file.')))
          videoEl.load()
        })
        setDuration(videoEl.duration)
        sessionDuration = videoEl.duration
        frames = await extractPoseFromVideo(videoEl, p => setProgress(50 + p * 30))
        if (!frames.length) throw new Error('No person detected in video. Ensure full body is visible.')
        setPoseFrames(frames)
      }

      setProgress(80)

      // Use pre-seeded issues from live detection; otherwise run fresh detection
      const issues = preseededIssues.length
        ? preseededIssues
        : detectIssues(frames, storedMovement)
      if (!preseededIssues.length) setDetectedIssues(issues)
      setProgress(85)

      const scoreResult = computeScores(frames, issues, storedMovement)
      setScores(scoreResult)

      const moments = detectKeyMoments(frames, storedMovement)
      setKeyMomentLabels(moments.map(m => m.label))
      setProgress(90)

      setStatus('analyzing')
      setFeedbackLoading(true)
      let feedback = ''
      try {
        feedback = await generateCoachingFeedback({
          movementType: storedMovement, detectedIssues: issues, scores: scoreResult,
          topDeviatedJoints: [], repCount: storedRepCount, duration: sessionDuration,
        })
        setAiFeedback(feedback)
      } catch (feedbackErr) {
        console.error('[AI Coach] feedback generation failed:', feedbackErr)
      }
      setFeedbackLoading(false)

      const sessionId = storeSnapshot.sessionId ?? currentSessionId
      if (sessionId) {
        await supabase.from('sessions').update({
          pose_data: compressPoseData(frames),
          pose_skeleton_summary: buildSkeletonSummary(frames),
          scores: scoreResult, detected_issues: issues,
          ai_feedback: feedback, rep_count: storedRepCount, duration_seconds: sessionDuration,
        }).eq('id', sessionId)
      }

      setProgress(100)
      setStatus('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally { processingRef.current = false }
  // Stable deps only — all session data is read via getState() above
  }, [currentSessionId, setStatus, setProgress, setError, setPoseFrames, setDetectedIssues,
      setScores, setAiFeedback, setDuration, supabase])

  useEffect(() => {
    if (status === 'processing') runAnalysis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleRegenerate = async () => {
    if (!scores) return
    setFeedbackLoading(true)
    try {
      const feedback = await generateCoachingFeedback({
        movementType, detectedIssues, scores,
        topDeviatedJoints: [], repCount, duration: durationSeconds,
      })
      setAiFeedback(feedback)
      if (currentSessionId) await supabase.from('sessions').update({ ai_feedback: feedback }).eq('id', currentSessionId)
    } catch { /* silent */ } finally { setFeedbackLoading(false) }
  }

  const handleIssueClick = useCallback((issue: DetectedIssue) => {
    setActiveIssueId(activeIssueId === issue.id ? null : issue.id)
  }, [activeIssueId, setActiveIssueId])

  const videoSrc = videoBlobUrl ?? videoUrl ?? ''
  const isProcessing = status === 'processing' || status === 'analyzing'
  const hasError = status === 'error'

  if (!videoSrc && !hasError) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">No video loaded.</p>
          <Link href="/upload" className="text-purple-400 hover:text-purple-300 text-sm">Upload a video</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/50 flex items-center justify-between px-5 shrink-0 bg-[#050505]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Analysis</span>
          <span className="text-xs text-zinc-700">·</span>
          <span className="text-xs font-mono text-zinc-500 capitalize">{movementType.replaceAll('_', ' ')}</span>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-500 font-mono">
              {status === 'analyzing' ? 'Generating feedback...' : `${Math.round(progress)}%`}
            </span>
          </div>
        )}
      </header>

      {/* Error state */}
      {hasError && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Analysis Failed</h2>
            <p className="text-sm text-zinc-400 mb-6">{errorMessage}</p>
            <button onClick={() => router.push('/upload')} className="bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs uppercase tracking-widest rounded-xl px-6 py-3 transition-colors">
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main layout */}
      {!hasError && videoSrc && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: video + stats */}
          <div className="lg:w-[58%] flex flex-col p-5 gap-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-800/50">
            <PoseOverlay
              videoSrc={videoSrc}
              frames={poseFrames}
              detectedIssues={detectedIssues}
              activeIssueId={activeIssueId}
              movementType={movementType}
            />

            {isProcessing && (
              <ProgressBar
                progress={progress}
                label={status === 'analyzing' ? 'Generating AI coaching feedback...' : 'Extracting pose data...'}
              />
            )}

            {/* Session stats strip */}
            {status === 'complete' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  {[
                    durationSeconds > 0 && { icon: <Clock className="w-3 h-3" />, label: 'Duration', value: `${durationSeconds.toFixed(1)}s` },
                    poseFrames.length > 0 && { icon: <Layers className="w-3 h-3" />, label: 'Frames', value: poseFrames.length },
                    detectedIssues.length > 0 && { icon: <AlertTriangle className="w-3 h-3" />, label: 'Issues', value: detectedIssues.length },
                  ].filter(Boolean).map((item, i) => item && (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                      <span className="text-zinc-700">{item.icon}</span>
                      {item.label}: <span className="text-zinc-400">{item.value}</span>
                    </div>
                  ))}
                </div>

                {keyMomentLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keyMomentLabels.map(label => (
                      <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/60 border border-zinc-700/50 rounded-lg">
                        <Zap className="w-2.5 h-2.5 text-purple-400" />
                        <span className="text-[10px] font-mono text-zinc-400">{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Right: analysis panel */}
          <div className="lg:w-[42%] flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 pt-4 pb-3 border-b border-zinc-800/50 shrink-0">
              {TAB_CONFIG.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  )}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === 'issues' && detectedIssues.length > 0 && (
                    <span className={cn(
                      'w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                      detectedIssues.some(i => i.severity === 'severe') ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                    )}>
                      {detectedIssues.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Scores tab */}
              {activeTab === 'scores' && (
                scores ? <ScoreGauges scores={scores} /> : (
                  isProcessing ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-zinc-900/50 animate-pulse border border-zinc-800" />)}
                    </div>
                  ) : <p className="text-sm text-zinc-600">Scores will appear after analysis.</p>
                )
              )}

              {/* Issues tab */}
              {activeTab === 'issues' && (
                <div className="space-y-3">
                  {isProcessing && (
                    <div className="space-y-2">
                      {[1, 2].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-900/50 animate-pulse border border-zinc-800" />)}
                    </div>
                  )}

                  {!isProcessing && detectedIssues.length === 0 && status === 'complete' && (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      </div>
                      <p className="text-sm font-semibold text-zinc-300 mb-1">No significant issues detected</p>
                      <p className="text-xs text-zinc-600">Movement mechanics look clean. Check AI Coach for personalised tips.</p>
                    </div>
                  )}

                  {detectedIssues.map((issue, i) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isActive={activeIssueId === issue.id}
                      onClick={() => handleIssueClick(issue)}
                      index={i}
                    />
                  ))}
                </div>
              )}

              {/* AI Coach tab */}
              {activeTab === 'coach' && (
                <AIFeedback
                  feedback={aiFeedback}
                  loading={feedbackLoading}
                  onRegenerate={handleRegenerate}
                  onFeedbackReady={text => {
                    if (typeof window !== 'undefined')
                      window.dispatchEvent(new CustomEvent('form:feedback-ready', { detail: { text, sessionId: currentSessionId } }))
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  )
}
