'use client'

import { useState, useEffect } from 'react'
import type { PoseFrame, ReferenceComparisonResult, MovementType } from '@/types'
import { loadBuiltInReferences, compareToReference } from '@/lib/pose/reference'
import DeviationChart from './DeviationChart'
import { motion } from 'framer-motion'
import { Upload, RefreshCw } from 'lucide-react'

interface ReferenceComparisonProps {
  userFrames: PoseFrame[]
  movementType: MovementType
  userReferenceFrames?: PoseFrame[]
}

export default function ReferenceComparison({ userFrames, movementType, userReferenceFrames }: ReferenceComparisonProps) {
  const [result, setResult] = useState<ReferenceComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'builtin' | 'user'>('builtin')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userFrames.length === 0) return
    runComparison()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFrames, mode, userReferenceFrames])

  async function runComparison() {
    setLoading(true)
    setError(null)
    try {
      let refFrames: PoseFrame[]
      if (mode === 'user' && userReferenceFrames && userReferenceFrames.length > 0) {
        refFrames = userReferenceFrames
      } else {
        const refs = await loadBuiltInReferences(movementType)
        if (refs.length === 0) throw new Error('No reference data available')
        refFrames = refs[0].frames
      }
      const r = compareToReference(userFrames, refFrames)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const simColor = (v: number) => v >= 70 ? '#22c55e' : v >= 45 ? '#eab308' : '#ef4444'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Reference Comparison</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            {(['builtin', 'user'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1 rounded-md transition-colors ${mode === m ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {m === 'builtin' ? 'Ideal' : 'Custom'}
              </button>
            ))}
          </div>
          <button onClick={runComparison} disabled={loading} className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mode === 'user' && !userReferenceFrames && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
          <Upload className="w-4 h-4 shrink-0" />
          <span>Upload a reference video in the Upload page to enable custom comparison.</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          Comparing...
        </div>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Similarity', value: result.overallSimilarity },
              { label: 'Symmetry', value: result.symmetryScore },
              { label: 'Temporal', value: result.temporalAlignment },
            ].map(({ label, value }) => (
              <div key={label} className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <span className="block text-lg font-bold font-mono" style={{ color: simColor(value) }}>
                  {value.toFixed(0)}%
                </span>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">{label}</span>
              </div>
            ))}
          </div>
          <DeviationChart deviations={result.jointDeviations} />
        </>
      )}
    </motion.div>
  )
}
