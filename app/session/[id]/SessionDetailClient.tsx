'use client'

import { useState, useCallback } from 'react'
import { generateCoachingFeedback } from '@/lib/gemini/client'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import type { Session } from '@/types'
import IssueCard from '@/components/analysis/IssueCard'
import AIFeedback from '@/components/analysis/AIFeedback'
import ReferenceComparison from '@/components/analysis/ReferenceComparison'
import { Activity, AlertTriangle, Activity as SkeletonIcon } from 'lucide-react'
import Link from 'next/link'

const PoseOverlay = dynamic(() => import('@/components/pose/PoseOverlay'), { ssr: false })
const ScoreGauges = dynamic(() => import('@/components/analysis/ScoreGauges'), { ssr: false })

interface SessionDetailClientProps {
  session: Session
}

export default function SessionDetailClient({ session }: SessionDetailClientProps) {
  const supabase = createClient()
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [liveFeedback, setLiveFeedback] = useState<string | null>(session.ai_feedback ?? null)
  const [cooldown, setCooldown] = useState(false)

  const frames = session.pose_skeleton_summary ?? session.pose_data ?? []
  const hasVideo = !!session.video_url

  const handleRegenerate = useCallback(async () => {
    if (!session.scores || cooldown || feedbackLoading) return
    setCooldown(true)
    setFeedbackLoading(true)
    try {
      const feedback = await generateCoachingFeedback({
        movementType: session.movement_type,
        detectedIssues: session.detected_issues ?? [],
        scores: session.scores,
        topDeviatedJoints: [],
        repCount: session.rep_count ?? 0,
        duration: session.duration_seconds ?? 0,
      })
      setLiveFeedback(feedback)
      await supabase
        .from('sessions')
        .update({ ai_feedback: feedback })
        .eq('id', session.id)
    } catch (err) {
      console.error('Regenerate failed:', err)
    } finally {
      setFeedbackLoading(false)
      setTimeout(() => setCooldown(false), 10000)
    }
  }, [session, supabase, cooldown, feedbackLoading])

  return (
    <div className="min-h-screen bg-[#050505]">
      <header className="h-14 border-b border-zinc-800/50 flex items-center px-6 gap-4 sticky top-0 z-10 bg-[#050505]/90 backdrop-blur-md">
        <Link href="/dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <div className="w-7 h-7 bg-purple-600 rounded flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-mono uppercase tracking-widest">FORM</span>
        </Link>
        <span className="text-zinc-700">/</span>
        <Link href="/dashboard" className="text-xs font-mono text-zinc-400 hover:text-white uppercase tracking-widest">
          Dashboard
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest truncate max-w-[200px]">
          {new Date(session.timestamp).toLocaleDateString()}
        </span>
      </header>

      <main className="flex flex-col lg:flex-row h-[calc(100vh-56px)]">
        {/* Left: video / skeleton */}
        <div className="lg:w-3/5 p-6 flex flex-col gap-4 overflow-y-auto">
          {hasVideo ? (
            <PoseOverlay
              videoSrc={session.video_url!}
              frames={frames}
              detectedIssues={session.detected_issues ?? []}
              activeIssueId={activeIssueId}
              movementType={session.movement_type}
            />
          ) : (
            <div className="aspect-video bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3 text-zinc-600">
              <SkeletonIcon className="w-10 h-10" />
              <p className="text-sm font-mono">Video expired after 30 days</p>
              <p className="text-xs">Pose skeleton data is retained permanently</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
            <span>Movement: <span className="text-zinc-300 capitalize">{session.movement_type.replace('_', ' ')}</span></span>
            {session.duration_seconds && <span>Duration: <span className="text-zinc-300">{session.duration_seconds.toFixed(1)}s</span></span>}
            {session.rep_count && <span>Reps: <span className="text-zinc-300">{session.rep_count}</span></span>}
          </div>
        </div>

        {/* Right: analysis */}
        <div className="lg:w-2/5 border-t lg:border-t-0 lg:border-l border-zinc-800 p-6 overflow-y-auto space-y-5">
          {session.scores && <ScoreGauges scores={session.scores} />}

          {(session.detected_issues ?? []).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Detected Issues ({session.detected_issues!.length})
              </h3>
              {session.detected_issues!.map(issue => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  isActive={activeIssueId === issue.id}
                  onClick={() => setActiveIssueId(activeIssueId === issue.id ? null : issue.id)}
                />
              ))}
            </div>
          )}

          {frames.length > 0 && (
            <ReferenceComparison
              userFrames={frames}
              movementType={session.movement_type}
            />
          )}

          <AIFeedback
            feedback={liveFeedback}
            loading={feedbackLoading || cooldown}
            onRegenerate={handleRegenerate}
            onFeedbackReady={(text) => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('form:feedback-ready', {
                  detail: { text, sessionId: session.id }
                }))
              }
            }}
          />
        </div>
      </main>
    </div>
  )
}