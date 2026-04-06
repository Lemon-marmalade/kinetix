'use client'

import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number  // 0–100
  label?: string
  color?: string
  className?: string
}

export default function ProgressBar({ progress, label, color = 'bg-[#00FF9D]', className }: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className={`w-full${className ? ` ${className}` : ''}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-mono text-zinc-400">{label}</span>
          <span className="text-xs font-mono text-zinc-400">{Math.round(safeProgress)}%</span>
        </div>
      )}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${safeProgress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
    </div>
  )
}
