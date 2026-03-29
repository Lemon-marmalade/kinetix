'use client'

import type { DetectedIssue } from '@/types'
import { ISSUE_META } from '@/types'
import { LANDMARK_NAMES } from '@/lib/pose/angles'
import { AlertTriangle, ChevronRight, Zap, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const SEV_CONFIG = {
  mild:     { bar: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25', ring: 'border-yellow-500/30 bg-yellow-500/5', icon: 'text-yellow-400' },
  moderate: { bar: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', ring: 'border-orange-500/30 bg-orange-500/5', icon: 'text-orange-400' },
  severe:   { bar: 'bg-red-500',    badge: 'bg-red-500/15 text-red-400 border-red-500/25',         ring: 'border-red-500/30 bg-red-500/5',         icon: 'text-red-400' },
}

interface IssueCardProps {
  issue: DetectedIssue
  isActive: boolean
  onClick: () => void
  index?: number
  peakTimestamp?: number
}

export default function IssueCard({ issue, isActive, onClick, index = 0, peakTimestamp }: IssueCardProps) {
  const [showClinical, setShowClinical] = useState(false)
  const cfg = SEV_CONFIG[issue.severity]
  const meta = ISSUE_META[issue.type]
  const jointNames = issue.affectedJoints
    .filter(i => LANDMARK_NAMES[i])
    .map(i => LANDMARK_NAMES[i])
    .join(' · ')

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-xl border transition-all duration-200 overflow-hidden',
        cfg.ring,
        isActive && 'ring-2 ring-purple-500/60 shadow-lg shadow-purple-500/10'
      )}
    >
      {/* Severity bar */}
      <div className={cn('h-0.5 w-full', cfg.bar)} />

      <button className="w-full text-left p-4" onClick={onClick}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.icon)} />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-semibold text-zinc-100">{meta?.label ?? issue.type}</span>
              <span className={cn('text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border', cfg.badge)}>
                {issue.severity}
              </span>
              {peakTimestamp !== undefined && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {peakTimestamp.toFixed(1)}s
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{issue.description}</p>

            {/* Joints + frames + active indicator */}
            <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600">
              {jointNames && <span>Joints: <span className="text-zinc-400">{jointNames}</span></span>}
              <span>{issue.frames.length} frames flagged</span>
              {issue.peakValue !== undefined && <span>Peak: <span className="text-zinc-400">{issue.peakValue}</span></span>}
            </div>

            {isActive && peakTimestamp !== undefined && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-[#00FF9D]">
                <Zap className="w-2.5 h-2.5" />
                Skeleton &amp; video jumped to {peakTimestamp.toFixed(1)}s
              </div>
            )}
          </div>

          <ChevronRight className={cn('w-3.5 h-3.5 shrink-0 text-zinc-600 transition-transform mt-0.5', isActive && 'rotate-90 text-purple-400')} />
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/60 pt-3">
              {/* Injury risks */}
              {meta?.injuryRisk && (
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Injury Risks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.injuryRisk.map(r => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Fix It</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{issue.recommendation}</p>
              </div>

              {/* Clinical note toggle */}
              {meta?.clinicalNote && (
                <div>
                  <button
                    onClick={e => { e.stopPropagation(); setShowClinical(!showClinical) }}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <Info className="w-3 h-3" />
                    {showClinical ? 'Hide' : 'Show'} clinical reference
                  </button>
                  {showClinical && (
                    <p className="text-[10px] text-zinc-600 italic mt-1.5 leading-relaxed">{meta.clinicalNote}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
