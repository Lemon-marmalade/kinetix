import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'
import type { UserProfile } from '@/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Session history stats
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, movement_type, timestamp, scores, detected_issues, duration_seconds')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false })
    .limit(30)

  return (
    <ProfileClient
      profile={(profile ?? { id: user.id, name: '', sport: '', created_at: new Date().toISOString() }) as UserProfile}
      sessions={sessions ?? []}
      userEmail={user.email ?? ''}
    />
  )
}
