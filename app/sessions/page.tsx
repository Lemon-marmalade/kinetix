import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SessionsList from './SessionsList'
import AppHeader from '@/components/ui/AppHeader'

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
        <div className="absolute top-[-8%] right-[-5%] w-[35%] h-[35%] bg-[#00FF9D]/3 blur-[140px] rounded-full" />
      </div>

      <AppHeader />

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
