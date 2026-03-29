'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Edit3, Plus, Trash2, CheckCircle, ChevronLeft,
  Shield, TrendingUp, Calendar, User, Clock, History, Settings,
  LogOut, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, PastInjury, Session } from '@/types'
import { MOVEMENT_META } from '@/types'
import { cn } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  profile: UserProfile
  sessions: Partial<Session>[]
  userEmail: string
}

type Tab = 'overview' | 'history' | 'settings'

const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'] as const
const SPORTS = ['Football', 'Basketball', 'Soccer', 'Tennis', 'Track', 'Weightlifting', 'CrossFit', 'Baseball', 'Swimming', 'Cycling', 'Other']
const BODY_PARTS = ['Knee', 'Ankle', 'Hip', 'Lower Back', 'Shoulder', 'Hamstring', 'Quad', 'Calf', 'Wrist', 'Elbow', 'Neck']
const INJURY_TYPES = ['Sprain', 'Strain', 'Tear (Partial)', 'Tear (Complete)', 'Tendinopathy', 'Stress Fracture', 'Dislocation', 'Contusion', 'Other']

const MOVEMENT_ABBR: Record<string, string> = {
  lateral_cut: 'CUT', jump_landing: 'LAND', squat: 'SQ', deadlift: 'DL',
  lunge: 'LNG', plank: 'PLK', overhead_press: 'OHP', sprint: 'SPR',
}

function computeHealthScore(sessions: Partial<Session>[]): number {
  if (!sessions.length) return 0
  const scored = sessions.filter(s => s.scores)
  if (!scored.length) return 0
  const avgStab = scored.reduce((s, sess) => s + (sess.scores?.stability ?? 5), 0) / scored.length
  const avgAlign = scored.reduce((s, sess) => s + (sess.scores?.alignment ?? 5), 0) / scored.length
  const avgRisk = scored.reduce((s, sess) => s + (sess.scores?.risk ?? 5), 0) / scored.length
  const base = ((avgStab + avgAlign) / 2) * 8 + (10 - avgRisk) * 2
  return Math.min(100, Math.max(0, Math.round(base)))
}

function scoreColor(v: number) { return v >= 7 ? '#22c55e' : v >= 4 ? '#eab308' : '#ef4444' }
function scoreTextColor(v: number) { return v >= 7 ? 'text-green-400' : v >= 4 ? 'text-yellow-400' : 'text-red-400' }

export default function ProfileClient({ profile, sessions, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [form, setForm] = useState<Partial<UserProfile>>({
    name: profile.name ?? '',
    sport: profile.sport ?? '',
    position: profile.position ?? '',
    age: profile.age,
    height_cm: profile.height_cm,
    weight_kg: profile.weight_kg,
    dominant_side: profile.dominant_side,
    fitness_level: profile.fitness_level,
  })
  const [injuries, setInjuries] = useState<PastInjury[]>(profile.past_injuries ?? [])
  const [showAddInjury, setShowAddInjury] = useState(false)
  const [newInjury, setNewInjury] = useState<Partial<PastInjury>>({ recovered: false })
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const [saveError, setSaveError] = useState<string | null>(null)

  const healthScore = computeHealthScore(sessions)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('profiles').update({ ...form, past_injuries: injuries }).eq('id', profile.id)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setEditing(false)
    router.refresh()
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const addInjury = () => {
    if (!newInjury.bodyPart || !newInjury.injuryType) return
    setInjuries(prev => [...prev, { ...newInjury, id: crypto.randomUUID() } as PastInjury])
    setNewInjury({ recovered: false })
    setShowAddInjury(false)
  }

  // Stats
  const scored = sessions.filter(s => s.scores)
  const avgStab = scored.length ? (scored.reduce((s, x) => s + (x.scores?.stability ?? 0), 0) / scored.length) : null
  const avgAlign = scored.length ? (scored.reduce((s, x) => s + (x.scores?.alignment ?? 0), 0) / scored.length) : null
  const avgRisk = scored.length ? (scored.reduce((s, x) => s + (x.scores?.risk ?? 0), 0) / scored.length) : null

  // Chart data
  const chartData = sessions.slice(0, 10).reverse().map((s, i) => ({
    i: i + 1,
    stability: s.scores?.stability ?? 0,
    alignment: s.scores?.alignment ?? 0,
    risk: s.scores?.risk ?? 0,
  }))

  // Most frequent issues
  const issueCounts: Record<string, number> = {}
  sessions.forEach(s => (s.detected_issues ?? []).forEach(issue => {
    issueCounts[issue.type] = (issueCounts[issue.type] ?? 0) + 1
  }))
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Movement breakdown
  const movCounts: Record<string, number> = {}
  sessions.forEach(s => { if (s.movement_type) movCounts[s.movement_type] = (movCounts[s.movement_type] ?? 0) + 1 })

  // History filtered sessions
  const movementTypes = [...new Set(sessions.map(s => s.movement_type).filter(Boolean))]
  const filteredSessions = historyFilter === 'all'
    ? sessions
    : sessions.filter(s => s.movement_type === historyFilter)

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="min-h-screen bg-[#050505]">
      <header className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-6 sticky top-0 z-10 bg-[#050505]/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="w-6 h-6 bg-[#00FF9D] rounded-md flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Profile</span>
        </div>
        {activeTab === 'overview' && (
          editing ? (
            <div className="flex flex-col items-end gap-1">
              {saveError && (
                <p className="text-[10px] text-red-400 font-mono max-w-xs text-right">{saveError}</p>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(false); setSaveError(null) }} className="text-xs font-mono text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="text-xs font-mono bg-[#00FF9D] hover:bg-[#00e88a] text-black px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          )
        )}
      </header>

      {/* Identity card — always visible */}
      <div className="border-b border-zinc-800/60 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#00FF9D]/10 border border-[#00FF9D]/20 flex items-center justify-center text-xl font-bold text-[#00FF9D] shrink-0">
            {(form.name || userEmail)?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">{form.name || userEmail}</h2>
            <p className="text-xs text-zinc-500">
              {[form.sport, form.position, form.fitness_level].filter(Boolean).join(' · ') || 'No sport set yet'}
            </p>
          </div>
          {healthScore > 0 && (
            <div className="text-center shrink-0">
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle cx="28" cy="28" r="23" fill="none"
                    stroke={healthScore >= 70 ? '#22c55e' : healthScore >= 45 ? '#eab308' : '#ef4444'}
                    strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${(healthScore / 100) * 2 * Math.PI * 23} ${2 * Math.PI * 23}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white font-mono">{healthScore}</span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-zinc-600 mt-0.5 uppercase">Form Score</p>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="max-w-3xl mx-auto mt-4 flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setEditing(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ── Overview tab ── */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-5">

              {/* Biometrics card */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Athlete Info</h3>
                </div>

                {editing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Full name"
                        className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FF9D]/40" />
                      <select value={form.sport ?? ''} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF9D]/40">
                        <option value="">Sport</option>
                        {SPORTS.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <input value={form.position ?? ''} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                        placeholder="Position / role"
                        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FF9D]/40" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Age', field: 'age' as const, placeholder: '—' },
                        { label: 'Height (cm)', field: 'height_cm' as const, placeholder: '—' },
                        { label: 'Weight (kg)', field: 'weight_kg' as const, placeholder: '—' },
                      ].map(({ label, field, placeholder }) => (
                        <div key={field}>
                          <label className="text-[10px] font-mono text-zinc-500 block mb-1">{label}</label>
                          <input type="number" value={form[field] ?? ''} onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) || undefined }))}
                            placeholder={placeholder} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF9D]/40" />
                        </div>
                      ))}
                      <div>
                        <label className="text-[10px] font-mono text-zinc-500 block mb-1">Dominant</label>
                        <select value={form.dominant_side ?? ''} onChange={e => setForm(p => ({ ...p, dominant_side: e.target.value as 'left' | 'right' }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00FF9D]/40">
                          <option value="">—</option>
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-500 block mb-2">Fitness Level</label>
                      <div className="flex gap-2 flex-wrap">
                        {FITNESS_LEVELS.map(l => (
                          <button key={l} onClick={() => setForm(p => ({ ...p, fitness_level: l }))}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-colors border',
                              form.fitness_level === l ? 'bg-[#00FF9D]/10 border-[#00FF9D]/50 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Age', value: form.age ? `${form.age}y` : '—' },
                      { label: 'Height', value: form.height_cm ? `${form.height_cm}cm` : '—' },
                      { label: 'Weight', value: form.weight_kg ? `${form.weight_kg}kg` : '—' },
                      { label: 'Dominant', value: form.dominant_side ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase mb-0.5">{label}</p>
                        <p className="text-sm font-semibold text-zinc-200 capitalize">{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Injury History */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-400" />
                    <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Injury History</h3>
                  </div>
                  <button onClick={() => setShowAddInjury(!showAddInjury)}
                    className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-white transition-colors">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {injuries.length === 0 && !showAddInjury && (
                  <p className="text-sm text-zinc-600">No injuries logged.</p>
                )}

                <div className="space-y-2">
                  {injuries.map((inj, i) => (
                    <div key={inj.id} className={cn('flex items-center justify-between rounded-xl p-3 border',
                      inj.recovered ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5')}>
                      <div className="flex items-center gap-3">
                        {inj.recovered ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> : <Shield className="w-4 h-4 text-orange-400 shrink-0" />}
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">{inj.bodyPart} — {inj.injuryType}</p>
                          <p className="text-[10px] text-zinc-500">
                            {inj.date ? new Date(inj.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Date unknown'}
                            {' · '}{inj.recovered ? 'Recovered' : 'Ongoing'}
                          </p>
                          {inj.notes && <p className="text-[10px] text-zinc-600 mt-0.5">{inj.notes}</p>}
                        </div>
                      </div>
                      {editing && (
                        <button onClick={() => setInjuries(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors ml-2">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {showAddInjury && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="mt-3 space-y-3 border border-zinc-700 rounded-xl p-4 bg-zinc-900">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-mono text-zinc-500 block mb-1">Body Part</label>
                          <select value={newInjury.bodyPart ?? ''} onChange={e => setNewInjury(p => ({ ...p, bodyPart: e.target.value }))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF9D]/40">
                            <option value="">Select…</option>
                            {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-zinc-500 block mb-1">Injury Type</label>
                          <select value={newInjury.injuryType ?? ''} onChange={e => setNewInjury(p => ({ ...p, injuryType: e.target.value }))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF9D]/40">
                            <option value="">Select…</option>
                            {INJURY_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-mono text-zinc-500 block mb-1">Date (approx.)</label>
                          <input type="month" value={newInjury.date ?? ''} onChange={e => setNewInjury(p => ({ ...p, date: e.target.value }))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00FF9D]/40" />
                        </div>
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                            <input type="checkbox" checked={newInjury.recovered ?? false}
                              onChange={e => setNewInjury(p => ({ ...p, recovered: e.target.checked }))}
                              className="accent-[#00FF9D]" />
                            Fully recovered
                          </label>
                        </div>
                      </div>
                      <input placeholder="Notes (optional)" value={newInjury.notes ?? ''}
                        onChange={e => setNewInjury(p => ({ ...p, notes: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FF9D]/40" />
                      <div className="flex gap-2">
                        <button onClick={addInjury} className="flex-1 bg-[#00FF9D] hover:bg-[#00e88a] text-black text-xs font-mono rounded-lg py-2 transition-colors">
                          Add Injury
                        </button>
                        <button onClick={() => setShowAddInjury(false)} className="text-xs text-zinc-500 hover:text-white px-3 transition-colors">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Analytics */}
              {sessions.length > 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: <Calendar className="w-4 h-4 text-[#00FF9D]" />, label: 'Sessions', value: sessions.length },
                      { icon: <TrendingUp className="w-4 h-4 text-green-400" />, label: 'Avg Stability', value: avgStab ? avgStab.toFixed(1) : '—' },
                      { icon: <Shield className="w-4 h-4 text-orange-400" />, label: 'Avg Risk', value: avgRisk ? avgRisk.toFixed(1) : '—' },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">{icon}
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">{label}</span>
                        </div>
                        <span className="text-xl font-bold text-white font-mono">{value}</span>
                      </div>
                    ))}
                  </div>

                  {chartData.length > 1 && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">
                        Score Trend — last {chartData.length} sessions
                      </p>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,157,0.06)" vertical={false} />
                            <XAxis dataKey="i" tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 10]} tick={{ fill: '#52525b', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: '#0f0f0f', border: '1px solid #00FF9D33', borderRadius: 8, fontSize: 11 }}
                              itemStyle={{ color: '#e4e4e7' }}
                              labelStyle={{ color: '#71717a' }}
                            />
                            <Line dataKey="stability" name="Stability" stroke="#00FF9D" strokeWidth={2} dot={{ fill: '#00FF9D', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#00FF9D', boxShadow: '0 0 8px #00FF9D' }} />
                            <Line dataKey="alignment" name="Alignment" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#3b82f6' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex gap-4 mt-2">
                        {[['Stability', '#00FF9D'], ['Alignment', '#3b82f6']].map(([label, color]) => (
                          <div key={label} className="flex items-center gap-1.5">
                            <div className="w-8 h-0.5 rounded-full" style={{ background: color }} />
                            <span className="text-[10px] font-mono text-zinc-500">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topIssues.length > 0 && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">Most Frequent Issues</p>
                      <div className="space-y-2.5">
                        {topIssues.map(([type, count]) => (
                          <div key={type}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-zinc-300 capitalize">{type.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] font-mono text-zinc-500">{count}×</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500/70 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (count / Math.max(sessions.length, 1)) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(movCounts).length > 0 && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                      <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">Movements Analyzed</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(movCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{MOVEMENT_ABBR[type] ?? 'MOV'}</span>
                            <span className="text-xs text-zinc-300 capitalize">{type.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] font-mono text-zinc-500">{count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Personalized Insights ── */}
              <PersonalizedInsights
                sport={profile.sport ?? null}
                fitnessLevel={profile.fitness_level ?? null}
                injuries={injuries}
                topIssues={topIssues.map(([type]) => type)}
              />
            </motion.div>
          )}

          {/* ── History tab ── */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
                  Session History ({filteredSessions.length})
                </h3>
                {movementTypes.length > 1 && (
                  <select value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00FF9D]/40">
                    <option value="all">All movements</option>
                    {movementTypes.map(t => t && (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                )}
              </div>

              {filteredSessions.length === 0 && (
                <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl p-8 text-center">
                  <p className="text-sm text-zinc-500">No sessions yet.</p>
                  <Link href="/upload" className="text-xs text-[#00FF9D] hover:text-[#00FF9D] mt-2 block transition-colors">
                    Analyze your first movement →
                  </Link>
                </div>
              )}

              <div className="space-y-2">
                {filteredSessions.map((session, i) => {
                  if (!session.id) return null
                  const date = session.timestamp ? new Date(session.timestamp) : null
                  const dateStr = date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <Link key={session.id} href={`/session/${session.id}`}>
                      <motion.div
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-xl p-3.5 transition-all group cursor-pointer"
                      >
                        <div className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400">{MOVEMENT_ABBR[session.movement_type ?? ''] ?? 'MOV'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-zinc-200 capitalize">
                              {session.movement_type?.replace(/_/g, ' ')}
                            </span>
                            {(session.detected_issues?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5 text-[9px] font-mono text-orange-400">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {session.detected_issues!.length}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-600">{dateStr}
                            {session.duration_seconds ? ` · ${session.duration_seconds.toFixed(1)}s` : ''}
                          </p>
                        </div>
                        {session.scores && (
                          <div className="flex gap-3 shrink-0">
                            {[
                              { label: 'S', val: session.scores.stability },
                              { label: 'A', val: session.scores.alignment },
                            ].map(({ label, val }) => (
                              <div key={label} className="text-center">
                                <div className={`text-sm font-bold font-mono ${scoreTextColor(val)}`}>{val.toFixed(1)}</div>
                                <div className="text-[9px] text-zinc-600 font-mono">{label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                      </motion.div>
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ── Settings tab ── */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">

              {/* Account */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">Account</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2.5 border-b border-zinc-800">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Email</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2.5 border-b border-zinc-800">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Display Name</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{form.name || 'Not set'}</p>
                    </div>
                    <button onClick={() => { setActiveTab('overview'); setEditing(true) }}
                      className="text-[10px] font-mono text-zinc-500 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Sessions Recorded</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{sessions.length} total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data summary */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">Data Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Avg Stability', value: avgStab ? `${avgStab.toFixed(1)}/10` : '—' },
                    { label: 'Avg Alignment', value: avgAlign ? `${avgAlign.toFixed(1)}/10` : '—' },
                    { label: 'Avg Risk Index', value: avgRisk ? `${avgRisk.toFixed(1)}/10` : '—' },
                    { label: 'Form Score', value: healthScore > 0 ? `${healthScore}/100` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-zinc-800/40 rounded-xl p-3">
                      <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">{label}</p>
                      <p className="text-sm font-bold text-zinc-200 font-mono">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-4">Session</h3>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 font-mono transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}

// ─── Personalized Insights ───────────────────────────────────────────────────

const SPORT_EXERCISES: Record<string, string[]> = {
  Football: ['Single-leg RDL', 'Lateral band walks', 'Hip flexor stretches', 'Reactive agility drills', 'Nordic hamstring curls'],
  Basketball: ['Ankle stability drills', 'Jump-landing mechanics', 'Hip abductor strengthening', 'Thoracic spine rotation', 'Deceleration training'],
  Soccer: ['Hip mobility flows', 'Single-leg balance', 'Glute activation (clamshells)', 'Ankle proprioception drills', 'Core anti-rotation (Pallof press)'],
  Tennis: ['Rotator cuff strengthening', 'Forearm wrist stability', 'Lateral hip mobility', 'Thoracic rotation', 'Split-stance RDL'],
  Track: ['Posterior chain activation', 'Ankle dorsiflexion mobility', 'Hip drive drills', 'Single-leg calf raises', 'Sprint mechanics drills'],
  Weightlifting: ['Ankle and hip mobility', 'Overhead squat mobility', 'Thoracic extension', 'Glute/hip activation', 'Wrist flexibility drills'],
  CrossFit: ['Overhead mobility (lats, pecs)', 'Hip flexor stretches', 'Ankle dorsiflexion', 'Scapular stability', 'Core bracing mechanics'],
  Baseball: ['Rotator cuff integrity work', 'Thoracic rotation', 'Hip mobility', 'Single-leg stability', 'Elbow flexor/extensor balance'],
  Swimming: ['Shoulder internal rotation stretch', 'Rotator cuff strengthening', 'Hip flexor release', 'Thoracic mobility', 'Core stability planks'],
  Cycling: ['Hip flexor stretching', 'Quad/hamstring balance', 'Glute activation', 'Lumbar mobility', 'IT band release'],
}

const ISSUE_FIXES: Record<string, string[]> = {
  knee_valgus: ['Lateral band walks', 'Clamshells', 'Single-leg squats', 'Glute med strengthening'],
  forward_lean: ['Hip flexor stretches', 'Thoracic extension', 'Ankle dorsiflexion mobility', 'Romanian deadlifts'],
  pelvic_tilt: ['Glute bridges', 'Dead bugs', 'Hip flexor release', 'Anterior core bracing'],
  ankle_eversion: ['Single-leg balance', 'Peroneal strengthening', 'Ankle stability drills', 'Arch activation'],
  shoulder_elevation: ['Shoulder blade depression drills', 'Lower trap activation', 'Neck/upper trap stretch', 'Face pulls'],
  trunk_rotation: ['Anti-rotation core work', 'Pallof press', 'Oblique stability', 'Hip mobility'],
  hip_drop: ['Glute med strengthening', 'Lateral band walks', 'Single-leg stance progressions', 'TFL stretching'],
  head_forward: ['Chin tucks', 'Deep neck flexor activation', 'Thoracic extension', 'Pec stretching'],
}

const INJURY_PROTOCOLS: Record<string, { title: string; items: string[] }> = {
  Knee: {
    title: 'Knee Rehabilitation',
    items: ['RICE protocol (acute phase)', 'VMO strengthening (terminal knee extensions)', 'Quad sets and straight-leg raises', 'Gradual weight-bearing progressions', 'Avoid valgus loading patterns'],
  },
  Ankle: {
    title: 'Ankle Rehabilitation',
    items: ['Single-leg balance progressions', 'Peroneal and tibialis strengthening', 'Ankle alphabet mobility', 'Gradual return-to-sport loading', 'Proprioception board training'],
  },
  Hip: {
    title: 'Hip Rehabilitation',
    items: ['Glute activation (bridges, clamshells)', 'Hip flexor stretching', 'Core stability work', 'Avoid deep hip flexion until pain-free', 'Gradual hip hinge loading'],
  },
  'Lower Back': {
    title: 'Lower Back Rehabilitation',
    items: ['Lumbar stabilization exercises', 'Cat-cow mobility', 'Dead bug / bird dog', 'Avoid loaded spinal flexion acutely', 'Strengthen glutes and core to offload spine'],
  },
  Shoulder: {
    title: 'Shoulder Rehabilitation',
    items: ['Rotator cuff activation (band work)', 'Scapular stability exercises', 'Pendulum mobilizations (acute)', 'Gradual overhead loading', 'Avoid impingement angles early'],
  },
  Hamstring: {
    title: 'Hamstring Rehabilitation',
    items: ['Isometric holds in pain-free range', 'Nordic hamstring progressions (sub-maximal)', 'Eccentric loading later stage', 'Hip hinge mobility', 'Avoid maximal sprint efforts until full strength'],
  },
  Quad: {
    title: 'Quad Rehabilitation',
    items: ['Terminal knee extensions', 'Short arc quads', 'Cycling for low-impact loading', 'Gradual squat depth progressions', 'Patellar mobility work'],
  },
  Calf: {
    title: 'Calf Rehabilitation',
    items: ['Eccentric heel drops (Alfredson protocol for tendinopathy)', 'Ankle dorsiflexion mobility', 'Gradual running return', 'Avoid sudden increases in volume', 'Foot-strike biomechanics review'],
  },
  Wrist: {
    title: 'Wrist Rehabilitation',
    items: ['Wrist flexor/extensor stretching', 'Grip strengthening progressions', 'Rice bucket exercises', 'Avoid loaded wrist extension acutely', 'Forearm strengthening'],
  },
  Elbow: {
    title: 'Elbow Rehabilitation',
    items: ['Eccentric wrist curls (lateral epicondylitis)', 'Forearm stretching', 'Grip strengthening', 'Avoid valgus stress positions', 'Gradual throwing/pushing progressions'],
  },
}

const FITNESS_NOTES: Record<string, string> = {
  beginner: 'Focus on movement quality over load. Master bodyweight patterns before adding resistance. 2–3 sessions/week with full recovery.',
  intermediate: 'Progressive overload is key. Periodize training with deload weeks. Address mobility gaps before they become injuries.',
  advanced: 'Fine-tune mechanics at high intensities. Use video review for each session. Prioritize recovery — CNS fatigue is real.',
  elite: 'Marginal gains matter. Address bilateral asymmetries immediately. Monitor HRV and soreness trends alongside session data.',
}

interface InsightsProps {
  sport: string | null
  fitnessLevel: string | null
  injuries: PastInjury[]
  topIssues: string[]
}

function PersonalizedInsights({ sport, fitnessLevel, injuries, topIssues }: InsightsProps) {
  const activeInjuries = injuries.filter(i => !i.recovered)
  const sportExercises = sport ? SPORT_EXERCISES[sport] ?? null : null
  const issueRecs = topIssues.flatMap(t => {
    const key = Object.keys(ISSUE_FIXES).find(k => t.includes(k.split('_')[0]))
    return key ? [{ issue: t, fixes: ISSUE_FIXES[key] }] : []
  }).slice(0, 3)
  const fitnessNote = fitnessLevel ? FITNESS_NOTES[fitnessLevel] ?? null : null

  const hasContent = activeInjuries.length > 0 || sportExercises || issueRecs.length > 0 || fitnessNote

  if (!hasContent) return null

  return (
    <div className="bg-zinc-900/40 border border-[#00FF9D]/15 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF9D]" />
        <h3 className="text-xs font-mono text-[#00FF9D] uppercase tracking-widest">Personalized Insights</h3>
      </div>

      {/* Active injury protocols */}
      {activeInjuries.map(injury => {
        const protocol = INJURY_PROTOCOLS[injury.bodyPart]
        if (!protocol) return null
        return (
          <div key={injury.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="text-xs font-semibold text-orange-300">{protocol.title}</span>
              <span className="text-[9px] font-mono text-zinc-600 ml-auto">{injury.injuryType}</span>
            </div>
            <ul className="space-y-1.5 ml-5">
              {protocol.items.map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-zinc-600 text-xs mt-0.5">›</span>
                  <span className="text-xs text-zinc-400">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {/* Issue-targeted corrective exercises */}
      {issueRecs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs font-semibold text-yellow-300">Corrective Exercises</span>
            <span className="text-[9px] font-mono text-zinc-600 ml-auto">based on detected issues</span>
          </div>
          {issueRecs.map(({ issue, fixes }) => (
            <div key={issue} className="ml-5">
              <p className="text-[10px] font-mono text-zinc-500 mb-1.5 capitalize">{issue.replace(/_/g, ' ')}</p>
              <div className="flex flex-wrap gap-1.5">
                {fixes.map(fix => (
                  <span key={fix} className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/50 rounded-md text-[10px] text-zinc-300">
                    {fix}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sport-specific exercises */}
      {sportExercises && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="text-xs font-semibold text-green-300">Sport-Specific Work</span>
            <span className="text-[9px] font-mono text-zinc-600 ml-auto">{sport}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 ml-5">
            {sportExercises.map(ex => (
              <span key={ex} className="px-2 py-1 bg-zinc-800/80 border border-zinc-700/50 rounded-md text-[10px] text-zinc-300">
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fitness level guidance */}
      {fitnessNote && (
        <div className="flex gap-3 bg-zinc-800/40 rounded-xl p-3.5">
          <Shield className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-zinc-400 leading-relaxed">{fitnessNote}</p>
        </div>
      )}
    </div>
  )
}
