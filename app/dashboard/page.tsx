import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RecentSessions from '@/components/session/RecentSessions'
import { Activity, Plus, Zap, TrendingUp, Target, User, Clock } from 'lucide-react'

const MOVEMENT_ABBR: Record<string, string> = {
  lateral_cut: 'CUT', jump_landing: 'LAND', squat: 'SQ', deadlift: 'DL',
  lunge: 'LNG', plank: 'PLK', overhead_press: 'OHP', sprint: 'SPR',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, recentResult, countResult] = await Promise.all([
    supabase.from('profiles').select('name, sport, fitness_level').eq('id', user.id).single(),
    supabase.from('sessions')
      .select('id, movement_type, timestamp, scores, detected_issues, duration_seconds')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(10),
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const profile = profileResult.data
  const sessions = recentResult.data ?? []
  const totalCount = countResult.count ?? 0

  const scored = sessions.filter(s => s.scores)
  const avgStability = scored.length
    ? (scored.reduce((s, x) => s + (x.scores?.stability ?? 0), 0) / scored.length).toFixed(1)
    : null
  const avgAlignment = scored.length
    ? (scored.reduce((s, x) => s + (x.scores?.alignment ?? 0), 0) / scored.length).toFixed(1)
    : null

  const movCounts: Record<string, number> = {}
  sessions.forEach(s => { movCounts[s.movement_type] = (movCounts[s.movement_type] ?? 0) + 1 })
  const topMovement = Object.entries(movCounts).sort((a, b) => b[1] - a[1])[0]

  const lastSession = sessions[0]
  const lastSessionDate = lastSession
    ? new Date(lastSession.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const firstName = profile?.name?.split(' ')[0] || null
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-[#0b0b0f]">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-8%] right-[-5%] w-[35%] h-[35%] bg-[#00FF9D]/3 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[25%] h-[25%] bg-[#00FF9D]/2 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-8 sticky top-0 z-10 bg-[#0b0b0f]/95 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#00FF9D] rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>KINETIX</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard', active: true },
              { href: '/profile', label: 'Profile', active: false },
            ].map(({ href, label, active }) => (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  active ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-1.5 bg-[#00FF9D] hover:bg-[#00e88a] text-black text-xs font-mono rounded-full px-4 py-2 transition-all shadow-lg shadow-black/20"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </Link>
          <Link href="/profile"
            className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-white/70 hover:border-white/20 transition-colors">
            {(profile?.name || user.email)?.[0]?.toUpperCase() ?? '?'}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10 space-y-8">
        {/* Greeting */}
        <div>
          <p className="text-white/40 text-sm font-mono mb-1">{greeting}</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <div className="flex items-center gap-2 mt-3">
            {profile?.sport && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/60 text-xs font-mono">
                {profile.sport}
              </span>
            )}
            {profile?.fitness_level && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#00FF9D]/10 border border-[#00FF9D]/20 text-[#00FF9D] text-xs font-mono capitalize">
                {profile.fitness_level}
              </span>
            )}
            {!profile?.sport && !profile?.fitness_level && (
              <Link href="/onboarding" className="text-xs text-white/30 hover:text-white/60 font-mono transition-colors">
                Complete your profile →
              </Link>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Target className="w-4 h-4 text-[#00FF9D]" />, label: 'Sessions', value: totalCount, sub: 'total analyzed' },
            { icon: <TrendingUp className="w-4 h-4 text-green-400" />, label: 'Stability', value: avgStability ? `${avgStability}` : '—', sub: avgStability ? 'avg score' : 'no data yet' },
            { icon: <Zap className="w-4 h-4 text-blue-400" />, label: 'Alignment', value: avgAlignment ? `${avgAlignment}` : '—', sub: avgAlignment ? 'avg score' : 'no data yet' },
            { icon: <Clock className="w-4 h-4 text-white/40" />, label: 'Last Session', value: lastSessionDate ?? '—', sub: lastSession?.movement_type?.replace(/_/g, ' ') ?? 'no sessions yet' },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:border-white/15 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                {icon}
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">{label}</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono capitalize">{value}</div>
              <div className="text-[10px] text-white/25 mt-1 capitalize">{sub}</div>
            </div>
          ))}
        </div>

        {/* Action + spotlight row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Primary CTA */}
          <Link href="/upload">
            <div className="relative overflow-hidden bg-[#00FF9D]/10 border border-[#00FF9D]/20 hover:border-[#00FF9D]/30 rounded-2xl p-7 cursor-pointer transition-all group h-full">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#00FF9D]/10 rounded-full blur-3xl group-hover:bg-[#00FF9D]/15 transition-colors" />
              <div className="w-10 h-10 rounded-xl bg-[#00FF9D]/10 border border-[#00FF9D]/20 flex items-center justify-center mb-5">
                <Plus className="w-5 h-5 text-[#00FF9D]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Analyze Movement</h3>
              <p className="text-sm text-white/40 leading-relaxed">Upload a video or record live for AI-powered biomechanical analysis with pose estimation.</p>
              <div className="mt-5 text-xs font-mono text-[#00FF9D] group-hover:text-[#00FF9D] transition-colors">
                Start now →
              </div>
            </div>
          </Link>

          {/* Last session or empty */}
          {lastSession ? (
            <Link href={`/session/${lastSession.id}`}>
              <div className="bg-white/[0.03] border border-white/[0.07] hover:border-white/15 rounded-2xl p-7 cursor-pointer transition-all group h-full">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Last Session</span>
                  <span className="text-[10px] text-white/25 font-mono">{lastSessionDate}</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/50">
                    {MOVEMENT_ABBR[lastSession.movement_type] ?? 'MOV'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">{lastSession.movement_type.replace(/_/g, ' ')}</p>
                    {lastSession.duration_seconds && (
                      <p className="text-[10px] text-white/30">{lastSession.duration_seconds.toFixed(1)}s · {lastSession.detected_issues?.length ?? 0} issues</p>
                    )}
                  </div>
                </div>
                {lastSession.scores && (
                  <div className="flex gap-5">
                    {[
                      { label: 'Stability', val: lastSession.scores.stability, invert: false },
                      { label: 'Alignment', val: lastSession.scores.alignment, invert: false },
                      { label: 'Risk', val: lastSession.scores.risk, invert: true },
                    ].map(({ label, val, invert }) => {
                      const score = invert ? 10 - val : val
                      const color = score >= 7 ? 'text-green-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400'
                      return (
                        <div key={label}>
                          <div className={`text-lg font-bold font-mono ${color}`}>{val.toFixed(1)}</div>
                          <div className="text-[9px] text-white/25 font-mono uppercase">{label}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-4 text-xs font-mono text-white/30 group-hover:text-white/60 transition-colors">
                  View full analysis →
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-white/[0.02] border border-white/[0.06] border-dashed rounded-2xl p-7 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <User className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-sm text-white/30">No sessions yet</p>
              <p className="text-xs text-white/20">Upload your first movement video to get started</p>
            </div>
          )}
        </div>

        {/* Session feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-mono text-white/30 uppercase tracking-widest">Recent Activity</h2>
            {topMovement && (
              <span className="text-[10px] font-mono text-white/25">
                Most analyzed: <span className="text-white/50 capitalize">{topMovement[0].replace(/_/g, ' ')} ({topMovement[1]}×)</span>
              </span>
            )}
          </div>
          <RecentSessions userId={user.id} />
        </div>
      </main>
    </div>
  )
}
