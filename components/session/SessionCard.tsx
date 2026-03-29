'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Session } from '@/types'
import { AlertTriangle, ChevronRight } from 'lucide-react'

const MOVEMENT_ABBR: Record<string, string> = {
  lateral_cut: 'CUT', jump_landing: 'LND', squat: 'SQ', deadlift: 'DL',
  lunge: 'LNG', plank: 'PLK', overhead_press: 'OHP', sprint: 'SPR',
}

function scoreTextColor(v: number) {
  return v >= 7 ? 'text-green-400' : v >= 4 ? 'text-yellow-400' : 'text-red-400'
}

interface SessionCardProps {
  session: Session
  index?: number
}

export default function SessionCard({ session, index = 0 }: SessionCardProps) {
  const date = new Date(session.timestamp)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const issueCount = session.detected_issues?.length ?? 0
  const hasSevere = session.detected_issues?.some(i => i.severity === 'severe')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
    >
      <Link href={`/session/${session.id}`}>
        <div className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-xl px-4 py-3.5 transition-all group cursor-pointer">
          {/* Movement abbr badge */}
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-mono font-bold text-zinc-400">{MOVEMENT_ABBR[session.movement_type] ?? 'MOV'}</span>
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

          <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}
