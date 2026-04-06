'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bot, RefreshCw, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { speak, stop } from '@/lib/elevenlabs/tts'
import { cn } from '@/lib/utils'

interface AIFeedbackProps {
  feedback: string | null
  loading: boolean
  error?: string | null
  onRegenerate: () => void
  onFeedbackReady?: (text: string) => void
}

const TYPEWRITER_SPEED = 18

/** Split Gemini output into the two labeled sections. */
function parseFeedback(text: string): { wellDone: string; recommendations: string } | null {
  // Strip any markdown bold/italic that slips through
  const clean = text.replace(/\*+/g, '').replace(/#+ */g, '')
  const wellMatch = clean.match(/WHAT YOU DID WELL[\s:]*\n+([\s\S]*?)(?=\nRECOMMENDATIONS|$)/i)
  const recMatch  = clean.match(/RECOMMENDATIONS[\s:]*\n+([\s\S]*?)$/i)
  if (!wellMatch && !recMatch) return null
  return {
    wellDone:        (wellMatch?.[1] ?? '').trim(),
    recommendations: (recMatch?.[1]  ?? '').trim(),
  }
}

function getSpeakableFeedback(text: string): string {
  const parsed = parseFeedback(text)
  if (!parsed) return text

  return [parsed.wellDone, parsed.recommendations]
    .filter(Boolean)
    .join(' ')
}

export default function AIFeedback({ feedback, loading, error, onRegenerate, onFeedbackReady }: AIFeedbackProps) {
  const [displayed, setDisplayed]   = useState('')
  const [typing, setTyping]         = useState(false)
  const [speaking, setSpeaking]     = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const indexRef  = useRef(0)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runTypewriter = useCallback((text: string) => {
    indexRef.current = 0
    setDisplayed('')
    setTyping(true)
    const tick = () => {
      if (indexRef.current < text.length) {
        indexRef.current++
        setDisplayed(text.slice(0, indexRef.current))
        timerRef.current = setTimeout(tick, TYPEWRITER_SPEED)
      } else {
        setTyping(false)
        onFeedbackReady?.(text)
      }
    }
    timerRef.current = setTimeout(tick, TYPEWRITER_SPEED)
  }, [onFeedbackReady])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (feedback) {
      runTypewriter(feedback)
    } else {
      setDisplayed('')
      setTyping(false)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, runTypewriter])

  const handleSpeak = async () => {
    if (speaking) {
      stop()
      setSpeaking(false)
      return
    }
    if (!feedback) return
    setTtsLoading(true)
    try {
      const speakableText = getSpeakableFeedback(feedback)
      // speak() resolves when audio ends — setSpeaking while in flight
      const playPromise = speak(speakableText, true)
      setSpeaking(true)
      setTtsLoading(false)
      await playPromise
    } catch { /* silent */ } finally {
      setSpeaking(false)
      setTtsLoading(false)
    }
  }

  const parsed = feedback ? parseFeedback(feedback) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-600/20 border border-green-500/30 flex items-center justify-center">
            <Bot className="w-3 h-3 text-green-400" />
          </div>
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">AI Coach</h3>
        </div>
        <div className="flex items-center gap-2">
          {feedback && !typing && (
            <button
              onClick={handleSpeak}
              disabled={ttsLoading}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all',
                speaking
                  ? 'bg-green-600/20 border-green-500/50 text-green-300'
                  : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              )}
              title={speaking ? 'Stop playback' : 'Read aloud'}
            >
              {ttsLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : speaking
                  ? <VolumeX className="w-3 h-3" />
                  : <Volume2 className="w-3 h-3" />
              }
              {speaking ? 'Stop' : 'Read aloud'}
            </button>
          )}
          <button
            onClick={onRegenerate}
            disabled={loading || typing}
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        </div>
      </div>

      <div className="min-h-[80px]">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-xs text-red-200">{error}</p>
          </div>
        )}

        {loading && !feedback && (
          <div className="flex items-center gap-2 text-zinc-500">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 bg-green-500 rounded-full"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500">Analyzing movement...</span>
          </div>
        )}

        {/* Structured view — shown once typing is done and we can parse sections */}
        {!typing && parsed && (
          <div className="space-y-4">
            {parsed.wellDone && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">What you did well</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{parsed.wellDone}</p>
              </div>
            )}
            {parsed.recommendations && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest">Recommendations</span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{parsed.recommendations}</p>
              </div>
            )}
          </div>
        )}

        {/* Typewriter view (during typing) or fallback plain text (unparsed format) */}
        {(typing || (!parsed && displayed)) && (
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {displayed}
            {typing && <span className="text-green-400 font-bold">|</span>}
          </p>
        )}

        {!loading && !feedback && !displayed && (
          <p className="text-sm text-zinc-600 italic">No feedback generated yet.</p>
        )}
      </div>
    </motion.div>
  )
}
