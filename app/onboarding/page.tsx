'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const SPORTS = [
  { id: 'Football', icon: '⬡' },
  { id: 'Basketball', icon: '⬡' },
  { id: 'Soccer', icon: '⬡' },
  { id: 'Tennis', icon: '⬡' },
  { id: 'Track & Field', icon: '⬡' },
  { id: 'Weightlifting', icon: '⬡' },
  { id: 'CrossFit', icon: '⬡' },
  { id: 'Baseball', icon: '⬡' },
  { id: 'Swimming', icon: '⬡' },
  { id: 'Cycling', icon: '⬡' },
  { id: 'Rugby', icon: '⬡' },
  { id: 'Volleyball', icon: '⬡' },
  { id: 'Gymnastics', icon: '⬡' },
  { id: 'MMA / Combat', icon: '⬡' },
  { id: 'Golf', icon: '⬡' },
  { id: 'Other', icon: '⬡' },
]

const FITNESS_LEVELS = [
  { id: 'beginner' as const, label: 'Beginner', sub: 'New to structured training or returning after a long break' },
  { id: 'intermediate' as const, label: 'Intermediate', sub: 'Training consistently for 1–3 years' },
  { id: 'advanced' as const, label: 'Advanced', sub: 'Competing or training at a high level for 3+ years' },
  { id: 'elite' as const, label: 'Elite', sub: 'Professional athlete or equivalent training demands' },
]

const BODY_PARTS = [
  'Knee', 'Ankle', 'Hip', 'Lower Back',
  'Shoulder', 'Hamstring', 'Quad', 'Calf',
  'Wrist', 'Elbow', 'Neck', 'None',
]

const GOALS = [
  { id: 'prevent_injury', label: 'Prevent injury', sub: 'Identify and correct movement patterns before they cause issues' },
  { id: 'improve_performance', label: 'Improve performance', sub: 'Optimise mechanics for speed, power, or efficiency' },
  { id: 'rehab', label: 'Rehabilitate', sub: 'Safely rebuild strength and movement quality after injury' },
  { id: 'learn', label: 'Learn proper form', sub: 'Master technique on lifts or sport-specific movements' },
]

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'

interface OnboardingData {
  sport: string
  fitnessLevel: FitnessLevel | null
  injuries: string[]
  goals: string[]
}

const STEPS = ['Sport', 'Level', 'Injuries', 'Goals']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    sport: '', fitnessLevel: null, injuries: [], goals: [],
  })

  const canProceed = [
    data.sport !== '',
    data.fitnessLevel !== null,
    true,
    true,
  ][step]

  const next = () => { if (step < STEPS.length - 1) setStep(s => s + 1); else finish() }
  const back = () => setStep(s => Math.max(0, s - 1))

  const finish = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const pastInjuries = data.injuries.includes('None') ? [] : data.injuries.map(part => ({
        id: crypto.randomUUID(), bodyPart: part, injuryType: 'History', recovered: false,
      }))
      await supabase.from('profiles').upsert({
        id: user.id, sport: data.sport, fitness_level: data.fitnessLevel, past_injuries: pastInjuries,
      })
      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0b0f] flex flex-col">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-purple-700/20 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-purple-900/15 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-mono text-white/60 uppercase tracking-widest">FORM</span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
        >
          Skip for now
        </button>
      </header>

      {/* Thin line progress */}
      <div className="flex items-center gap-1.5 px-8 pt-2 pb-0">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-[2px] flex-1 rounded-full transition-all duration-300',
              i <= step ? 'bg-purple-500' : 'bg-white/10'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-6 pt-10 pb-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* Step 0: Sport */}
            {step === 0 && (
              <motion.div key="sport" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">What sport do you play?</h2>
                <p className="text-white/40 text-sm mb-8">This ensures you receive more accurate recommendations.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {SPORTS.map(sport => {
                    const selected = data.sport === sport.id
                    return (
                      <button
                        key={sport.id}
                        onClick={() => setData(d => ({ ...d, sport: sport.id }))}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-2 px-3 py-5 rounded-2xl border text-sm font-medium transition-all',
                          selected
                            ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white hover:bg-white/[0.05]'
                        )}
                      >
                        {/* Radio indicator */}
                        <div className={cn(
                          'absolute top-2.5 right-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                          selected ? 'border-white bg-white' : 'border-white/20'
                        )}>
                          {selected && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                        </div>
                        <span className="text-xs font-mono font-semibold text-center leading-tight">{sport.id}</span>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 1: Fitness Level */}
            {step === 1 && (
              <motion.div key="level" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">What is your training level?</h2>
                <p className="text-white/40 text-sm mb-8">This adjusts the depth and complexity of feedback.</p>
                <div className="space-y-2.5">
                  {FITNESS_LEVELS.map(level => {
                    const selected = data.fitnessLevel === level.id
                    return (
                      <button
                        key={level.id}
                        onClick={() => setData(d => ({ ...d, fitnessLevel: level.id }))}
                        className={cn(
                          'relative w-full text-left px-6 py-5 rounded-2xl border transition-all',
                          selected
                            ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-900/50'
                            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                        )}
                      >
                        <div className={cn(
                          'absolute top-4 right-5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          selected ? 'border-white bg-white' : 'border-white/20'
                        )}>
                          {selected && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                        </div>
                        <p className={cn('text-sm font-semibold mb-1', selected ? 'text-white' : 'text-white/80')}>{level.label}</p>
                        <p className={cn('text-xs', selected ? 'text-white/70' : 'text-white/35')}>{level.sub}</p>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Step 2: Injuries */}
            {step === 2 && (
              <motion.div key="injuries" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Any current or recurring injuries?</h2>
                <p className="text-white/40 text-sm mb-8">Select all that apply. We will flag related compensation patterns.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-4">
                  {BODY_PARTS.map(part => {
                    const selected = data.injuries.includes(part)
                    return (
                      <button
                        key={part}
                        onClick={() => {
                          if (part === 'None') { setData(d => ({ ...d, injuries: ['None'] })); return }
                          setData(d => ({
                            ...d,
                            injuries: selected
                              ? d.injuries.filter(i => i !== part)
                              : [...d.injuries.filter(i => i !== 'None'), part],
                          }))
                        }}
                        className={cn(
                          'relative px-3 py-4 rounded-2xl border text-xs font-mono font-semibold transition-all',
                          selected
                            ? part === 'None'
                              ? 'bg-white/10 border-white/25 text-white'
                              : 'bg-orange-500/80 border-orange-400 text-white shadow-lg shadow-orange-900/30'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white'
                        )}
                      >
                        <div className={cn(
                          'absolute top-2 right-2 w-3.5 h-3.5 rounded-full border flex items-center justify-center',
                          selected ? 'border-white/70 bg-white/20' : 'border-white/15'
                        )}>
                          {selected && <Check className="w-2 h-2 text-white" />}
                        </div>
                        {part}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-white/25">Optional — can be updated in your profile at any time.</p>
              </motion.div>
            )}

            {/* Step 3: Goals */}
            {step === 3 && (
              <motion.div key="goals" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">What are you training for?</h2>
                <p className="text-white/40 text-sm mb-8">Select your primary goals. You can change these later.</p>
                <div className="space-y-2.5">
                  {GOALS.map(goal => {
                    const selected = data.goals.includes(goal.id)
                    return (
                      <button
                        key={goal.id}
                        onClick={() => setData(d => ({
                          ...d,
                          goals: selected ? d.goals.filter(g => g !== goal.id) : [...d.goals, goal.id],
                        }))}
                        className={cn(
                          'relative w-full text-left px-6 py-5 rounded-2xl border transition-all',
                          selected
                            ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-900/50'
                            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.05]'
                        )}
                      >
                        <div className={cn(
                          'absolute top-4 right-5 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                          selected ? 'border-white bg-white' : 'border-white/20'
                        )}>
                          {selected && <div className="w-2 h-2 rounded-full bg-purple-600" />}
                        </div>
                        <p className={cn('text-sm font-semibold mb-1', selected ? 'text-white' : 'text-white/80')}>{goal.label}</p>
                        <p className={cn('text-xs', selected ? 'text-white/70' : 'text-white/35')}>{goal.sub}</p>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            {step > 0 ? (
              <button
                onClick={back}
                className="px-8 py-3 rounded-full border border-white/15 text-sm font-mono text-white/60 hover:text-white hover:border-white/30 transition-all"
              >
                Back
              </button>
            ) : <div />}

            <button
              onClick={next}
              disabled={!canProceed || saving}
              className={cn(
                'px-8 py-3 rounded-full text-sm font-mono font-semibold transition-all',
                canProceed && !saving
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40'
                  : 'bg-white/[0.05] text-white/25 cursor-not-allowed'
              )}
            >
              {saving ? 'Saving...' : step === STEPS.length - 1 ? 'Finish setup' : 'Next'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
