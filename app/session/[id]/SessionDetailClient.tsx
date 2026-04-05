'use client'

import { useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { Session } from '@/types'
import IssueCard from '@/components/analysis/IssueCard'
import AIFeedback from '@/components/analysis/AIFeedback'
import { AlertTriangle, Activity as SkeletonIcon, BarChart2, Bot, CheckCircle, Clock, Layers, Loader2, Trash2 } from 'lucide-react'
import AppHeader from '@/components/ui/AppHeader'
import { cn } from '@/lib/utils'
import { deleteSession } from '@/app/sessions/actions'

const PoseOverlay = dynamic(() => import('@/components/pose/PoseOverlay'), { ssr: false })
const ScoreGauges = dynamic(() => import('@/components/analysis/ScoreGauges'), { ssr: false })

type RightTab = 'scores' | 'issues' | 'coach'

const TAB_CONFIG: { id: RightTab; label: string; icon: React.ReactNode }[] = [
  { id: 'scores', label: 'Scores',   icon: <BarChart2 className="w-3.5 h-3.5" /> },
  { id: 'issues', label: 'Issues',   icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: 'coach',  label: 'AI Coach', icon: <Bot className="w-3.5 h-3.5" /> },
]

interface SessionDetailClientProps {
  session: Session
}

export default function SessionDetailClient({ session }: SessionDetailClientProps) {
  const router = useRouter()
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RightTab>(
    (session.detected_issues ?? []).length > 0 ? 'issues' : 'scores'
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const frames = session.pose_skeleton_summary ?? session.pose_data ?? []
  const hasVideo = !!session.video_url
  const issues = session.detected_issues ?? []

  const handleDelete = () => {
    startTransition(async () => {
      setDeleteError(null)
      const result = await deleteSession(session.id)
      if (result.error) {
        setDeleteError(result.error)
        return
      }
      router.push('/sessions')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <AppHeader />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: video / skeleton */}
        <div className="lg:w-[58%] flex flex-col p-5 gap-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-zinc-800/50">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-white capitalize">
                {session.movement_type.replace(/_/g, ' ')}
              </h1>
              <p className="text-xs text-zinc-500">Session detail</p>
            </div>
            <div className="flex items-center gap-2">
              {deleteError && (
                <span className="text-xs text-red-400">{deleteError}</span>
              )}
              {confirmingDelete ? (
                <>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white transition-colors disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/50 bg-red-950/30 text-xs text-red-300 hover:bg-red-950/50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Session
                </button>
              )}
            </div>
          </div>

          {hasVideo ? (
            <PoseOverlay
              videoSrc={session.video_url!}
              frames={frames}
              detectedIssues={issues}
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

          <div className="flex flex-wrap gap-4">
            {session.duration_seconds && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                <Clock className="w-3 h-3 text-zinc-700" />
                Duration: <span className="text-zinc-400">{session.duration_seconds.toFixed(1)}s</span>
              </div>
            )}
            {frames.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                <Layers className="w-3 h-3 text-zinc-700" />
                Frames: <span className="text-zinc-400">{frames.length}</span>
              </div>
            )}
            {issues.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                <AlertTriangle className="w-3 h-3 text-zinc-700" />
                Issues: <span className="text-zinc-400">{issues.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: analysis panel with tabs */}
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
                {tab.id === 'issues' && issues.length > 0 && (
                  <span className={cn(
                    'w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                    issues.some(i => i.severity === 'severe') ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                  )}>
                    {issues.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Scores tab */}
            {activeTab === 'scores' && (
              session.scores
                ? <ScoreGauges scores={session.scores} />
                : <p className="text-sm text-zinc-600">No scores recorded for this session.</p>
            )}

            {/* Issues tab */}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                {issues.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-300 mb-1">No significant issues detected</p>
                    <p className="text-xs text-zinc-600">Movement mechanics looked clean. Check AI Coach for tips.</p>
                  </div>
                ) : (
                  issues.map(issue => {
                    const firstFrameIdx = issue.frames[0] ?? 0
                    const peakFrame = frames.find(f => f.frameIndex === firstFrameIdx)
                      ?? frames[Math.min(firstFrameIdx, frames.length - 1)]
                    return (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        isActive={activeIssueId === issue.id}
                        onClick={() => setActiveIssueId(activeIssueId === issue.id ? null : issue.id)}
                        peakTimestamp={peakFrame?.timestamp}
                      />
                    )
                  })
                )}
              </div>
            )}

            {/* AI Coach tab */}
            {activeTab === 'coach' && (
              <AIFeedback
                feedback={session.ai_feedback ?? null}
                loading={false}
                error={null}
                onRegenerate={() => {}}
                onFeedbackReady={(text) => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('form:feedback-ready', {
                      detail: { text, sessionId: session.id }
                    }))
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
