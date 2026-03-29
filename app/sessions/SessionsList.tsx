'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, Trash2, Loader2, X } from 'lucide-react'
import { deleteSession } from './actions'
import type { Session } from '@/types'

const MOVEMENT_ABBR: Record<string, string> = {
  lateral_cut: 'CUT', jump_landing: 'LND', squat: 'SQ', deadlift: 'DL',
  lunge: 'LNG', plank: 'PLK', overhead_press: 'OHP', sprint: 'SPR',
}

function scoreTextColor(v: number) {
  return v >= 7 ? 'text-green-400' : v >= 4 ? 'text-yellow-400' : 'text-red-400'
}

function ConfirmDialog({ onConfirm, onCancel, isPending }: {
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-zinc-900/95 backdrop-blur-sm border border-red-900/50">
      <div className="text-center px-4">
        <p className="text-xs text-zinc-300 mb-3">Delete this session and all its data?</p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionRow({ session, index }: { session: Session; index: number }) {
  const [confirming, setConfirming] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [isPending, startTransition] = useTransition()

  const date = new Date(session.timestamp)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const issueCount = session.detected_issues?.length ?? 0
  const hasSevere = session.detected_issues?.some(i => i.severity === 'severe')

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteSession(session.id)
      if (!result.error) setDeleted(true)
    })
  }

  if (deleted) return null

  return (
    <AnimatePresence>
      <motion.div
        key={session.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2, delay: index * 0.04 }}
        className="relative"
      >
        {confirming && (
          <ConfirmDialog
            onConfirm={handleDelete}
            onCancel={() => setConfirming(false)}
            isPending={isPending}
          />
        )}

        <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3.5 transition-all group">
          {/* Movement badge */}
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-mono font-bold text-zinc-400">
              {MOVEMENT_ABBR[session.movement_type] ?? 'MOV'}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-zinc-200 capitalize">
                {session.movement_type.replace(/_/g, ' ')}
              </span>
              {issueCount > 0 && (
                <span className={`flex items-center gap-0.5 text-[9px] font-mono ${hasSevere ? 'text-red-400' : 'text-orange-400'}`}>
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {issueCount}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-600">
              {dateStr} · {timeStr}
              {session.duration_seconds ? ` · ${session.duration_seconds.toFixed(1)}s` : ''}
            </p>
          </div>

          {/* Scores */}
          {session.scores ? (
            <div className="flex items-center gap-3 shrink-0">
              {[
                { label: 'S', val: session.scores.stability },
                { label: 'A', val: session.scores.alignment },
                { label: 'R', val: session.scores.risk },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <div className={`text-sm font-bold font-mono leading-none ${scoreTextColor(label === 'R' ? 10 - val : val)}`}>
                    {val.toFixed(1)}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-600 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[10px] font-mono text-zinc-700 shrink-0">No scores</span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/session/${session.id}`}
              className="p-2 rounded-lg text-zinc-700 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="View analysis"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setConfirming(true)}
              className="p-2 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-950/40 transition-colors"
              title="Delete session"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function SessionsList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl p-12 text-center">
        <p className="text-sm text-zinc-500">No sessions yet.</p>
        <Link href="/upload" className="text-xs text-purple-400 hover:text-purple-300 mt-2 block transition-colors">
          Upload your first video →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session, i) => (
        <SessionRow key={session.id} session={session} index={i} />
      ))}
    </div>
  )
}
