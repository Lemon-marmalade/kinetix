'use client'

import type { JointDeviation } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'

interface DeviationChartProps {
  deviations: JointDeviation[]
}

function severityColor(sev: string): string {
  if (sev === 'severe') return '#ef4444'
  if (sev === 'moderate') return '#f97316'
  return '#22c55e'
}

export default function DeviationChart({ deviations }: DeviationChartProps) {
  const data = [...deviations]
    .sort((a, b) => b.deviationDegrees - a.deviationDegrees)
    .map(d => ({
      name: d.jointName.replace(' ', '\n'),
      deviation: d.deviationDegrees,
      severity: d.severity,
    }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
    >
      <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">
        Joint Deviation from Reference
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: '#71717a', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 9, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }}
              itemStyle={{ color: '#e4e4e7' }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(val: number) => [`${val.toFixed(1)}`, 'Deviation']}
            />
            <Bar dataKey="deviation" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={severityColor(entry.severity)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2">
        {(['mild', 'moderate', 'severe'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: severityColor(s) }} />
            <span className="text-[10px] font-mono text-zinc-500 capitalize">{s}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
