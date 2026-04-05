'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion } from 'framer-motion'
import AppHeader from '@/components/ui/AppHeader'
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
    setSessionId, setMovementType, setVideoUrl, setRepCount,
  } = useSessionStore()

  const { status, progress, errorMessage, activeIssueId, setStatus, setProgress, setError, setActiveIssueId } = useAnalysisStore()

  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RightTab>('scores')
  const [keyMomentLabels, setKeyMomentLabels] = useState<string[]>([])
  const processingRef = useRef(false)
  const currentSessionId = searchParams.get('session') ?? sessionId

  useEffect(() => {
    const urlSessionId = searchParams.get('session')
    if (!urlSessionId) return
    if (sessionId === urlSessionId && (scores || poseFrames.length > 0)) return

    supabase
      .from('sessions')
      .select('*')
      .eq('id', urlSessionId)
      .single()
      .then(({ data }) => {
        if (!data) return
        setSessionId(data.id)
        setMovementType(data.movement_type)
        if (data.video_url) setVideoUrl(data.video_url)
        if (data.duration_seconds) setDuration(data.duration_seconds)
        if (data.rep_count) setRepCount(data.rep_count)
        if (data.pose_skeleton_summary?.length) setPoseFrames(data.pose_skeleton_summary)
        else if (data.pose_data?.length) setPoseFrames(data.pose_data)
        if (data.detected_issues) setDetectedIssues(data.detected_issues)
        if (data.scores) setScores(data.scores)
        if (data.ai_feedback) setAiFeedback(data.ai_feedback)
        setStatus('complete')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (status === 'complete' && detectedIssues.length > 0) setActiveTab('issues')
  }, [status, detectedIssues.length])

  useEffect(() => {
    if (aiFeedback || feedbackError) setActiveTab('coach')
  }, [aiFeedback, feedbackError])

  const runAnalysis = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('processing')

    try {
      const storeSnapshot = useSessionStore.getState()
      let frames = storeSnapshot.poseFrames
      const preseededIssues = storeSnapshot.detectedIssues
      const storedMovement = storeSnapshot.movementType
      const storedRepCount = storeSnapshot.repCount
      let sessionDuration = storeSnapshot.durationSeconds
      const blobUrl = storeSnapshot.videoBlobUrl

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
      setFeedbackError(null)
      let feedback = ''
      try {
        feedback = await generateCoachingFeedback({
          movementType: storedMovement, detectedIssues: issues, scores: scoreResult,
          topDeviatedJoints: [], repCount: storedRepCount, duration: sessionDuration,
        })
        setAiFeedback(feedback)
      } catch (feedbackErr) {
        console.error('[AI Coach] feedback generation failed:', feedbackErr)
        setFeedbackError(feedbackErr instanceof Error ? feedbackErr.message : 'Failed to generate AI coaching feedback.')
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
  }, [currentSessionId, setStatus, setProgress, setError, setPoseFrames, setDetectedIssues,
      setScores, setAiFeedback, setDuration, supabase])

  useEffect(() => {
    if (status === 'processing') runAnalysis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleRegenerate = async () => {
    if (!scores) return
    setFeedbackLoading(true)
    setFeedbackError(null)
    try {
      const feedback = await generateCoachingFeedback({
        movementType, detectedIssues, scores,
        topDeviatedJoints: [], repCount, duration: durationSeconds,
      })
      setAiFeedback(feedback)
      if (currentSessionId) await supabase.from('sessions').update({ ai_feedback: feedback }).eq('id', currentSessionId)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to generate AI coaching feedback.')
    } finally { setFeedbackLoading(false) }
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
          <Link href="/upload" className="text-[#00FF9D] hover:text-[#00FF9D] text-sm">Upload a video</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <AppHeader />

      {/* Error state */}
      {hasError && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Analysis Failed</h2>
            <p className="text-sm text-zinc-400 mb-6">{errorMessage}</p>
            <button onClick={() => router.push('/upload')} className="bg-[#00FF9D] hover:bg-[#00e88a] text-black font-mono text-xs uppercase tracking-widest rounded-xl px-6 py-3 transition-colors">
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
                        <Zap className="w-2.5 h-2.5 text-[#00FF9D]" />
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

                  {detectedIssues.map((issue, i) => {
                    const firstFrameIdx = issue.frames[0] ?? 0
                    const peakFrame = poseFrames[Math.min(firstFrameIdx, poseFrames.length - 1)]
                    return (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        isActive={activeIssueId === issue.id}
                        onClick={() => handleIssueClick(issue)}
                        index={i}
                        peakTimestamp={peakFrame?.timestamp}
                      />
                    )
                  })}
                </div>
              )}

              {/* AI Coach tab */}
              {activeTab === 'coach' && (
                <AIFeedback
                  feedback={aiFeedback}
                  loading={feedbackLoading}
                  error={feedbackError}
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
        <div className="w-6 h-6 border-2 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  )
}
