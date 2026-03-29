'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Scores } from '@/types'
import { TrendingUp, ShieldAlert, Target } from 'lucide-react'

interface GaugeProps {
  label: string
  value: number   // raw 0–10
  icon: React.ReactNode
  inverted?: boolean
  description: string
  delay?: number
}

function scoreColor(v: number, inv: boolean): string {
  if (inv) return v >= 7 ? '#ef4444' : v >= 4 ? '#f97316' : '#22c55e'
  return v >= 7 ? '#22c55e' : v >= 4 ? '#eab308' : '#ef4444'
}

function scoreBg(v: number, inv: boolean): string {
  if (inv) return v >= 7 ? 'rgba(239,68,68,0.08)' : v >= 4 ? 'rgba(249,115,22,0.08)' : 'rgba(34,197,94,0.08)'
  return v >= 7 ? 'rgba(34,197,94,0.08)' : v >= 4 ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)'
}

function scoreLabel(v: number, inv: boolean): string {
  if (inv) return v >= 7 ? 'High Risk' : v >= 4 ? 'Moderate' : 'Low Risk'
  return v >= 7 ? 'Excellent' : v >= 4 ? 'Fair' : 'Needs Work'
}

function Gauge({ label, value, icon, inverted = false, description, delay = 0 }: GaugeProps) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const dur = 1400
    const run = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(parseFloat((eased * value * 10).toFixed(0)))
      if (p < 1) frame = requestAnimationFrame(run)
    }
    const timer = setTimeout(() => { frame = requestAnimationFrame(run) }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(frame) }
  }, [value, delay])

  const r = 38
  const circ = 2 * Math.PI * r
  const dash = (display / 100) * circ
  const color = scoreColor(value, inverted)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      className="rounded-2xl p-4 border border-zinc-800/60 flex flex-col items-center gap-3"
      style={{ background: scoreBg(value, inverted) }}
    >
      {/* Ring */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 92 92">
          <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
          <circle
            cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white font-mono leading-none">{display}</span>
          <span className="text-[9px] text-zinc-500 font-mono mt-0.5">/100</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="w-3.5 h-3.5" style={{ color }}>{icon}</span>
          <span className="text-xs font-semibold text-zinc-200">{label}</span>
        </div>
        <span className="text-[10px] font-mono rounded-full px-2 py-0.5" style={{ color, background: scoreBg(value, inverted) }}>
          {scoreLabel(value, inverted)}
        </span>
      </div>
      <p className="text-[10px] text-zinc-500 text-center leading-relaxed">{description}</p>
    </motion.div>
  )
}

interface ScoreGaugesProps { scores: Scores }

export default function ScoreGauges({ scores }: ScoreGaugesProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Gauge
          label="Stability"
          value={scores.stability}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          description="Torso control and hip level throughout the movement"
          delay={0}
        />
        <Gauge
          label="Alignment"
          value={scores.alignment}
          icon={<Target className="w-3.5 h-3.5" />}
          description="Knee tracking, joint symmetry, and alignment"
          delay={100}
        />
        <Gauge
          label="Risk"
          value={scores.risk}
          inverted
          icon={<ShieldAlert className="w-3.5 h-3.5" />}
          description="Composite injury risk from detected compensation patterns"
          delay={200}
        />
      </div>

      {/* Factor breakdown */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4 space-y-3">
        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Score Breakdown</p>
        {(['stability', 'alignment', 'risk'] as const).map(key => {
          const bd = scores.breakdowns[key]
          const inv = key === 'risk'
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-mono capitalize text-zinc-400">{key}</span>
                <span className="text-xs font-mono font-bold" style={{ color: scoreColor(bd.value, inv) }}>
                  {(bd.value * 10).toFixed(0)}/100
                </span>
              </div>
              <div className="space-y-1">
                {bd.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-600">{f.name}</span>
                    <span className="text-zinc-500 text-right max-w-[55%] truncate">{f.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
