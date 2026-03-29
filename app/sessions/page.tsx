import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Activity, ChevronLeft, Plus } from 'lucide-react'
import SessionsList from './SessionsList'

export default async function SessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('sessions')
    .select('id, user_id, movement_type, timestamp, video_url, scores, detected_issues, rep_count, duration_seconds')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false })

  const sessions = data ?? []

  return (
    <div className="min-h-screen bg-[#0b0b0f]">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-8%] right-[-5%] w-[35%] h-[35%] bg-purple-700/15 blur-[140px] rounded-full" />
      </div>

      <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-8 sticky top-0 z-10 bg-[#0b0b0f]/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-mono text-white/40 uppercase tracking-widest">All Sessions</span>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono rounded-full px-4 py-2 transition-all shadow-lg shadow-purple-900/30"
        >
          <Plus className="w-3.5 h-3.5" />
          New Session
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Sessions</h1>
            <p className="text-sm text-white/30 mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>

        <SessionsList sessions={sessions} />
      </main>
    </div>
  )
}
