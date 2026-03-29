'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSession(sessionId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch session to confirm ownership and get video path
  const { data: session, error: fetchErr } = await supabase
    .from('sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !session) return { error: 'Session not found' }

  // Delete video from storage (best-effort — ignore if already gone)
  const videoPath = `${user.id}/${sessionId}.mp4`
  await supabase.storage.from('session-videos').remove([videoPath])

  // Delete the session row
  const { error: deleteErr } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  if (deleteErr) return { error: deleteErr.message }

  revalidatePath('/sessions')
  revalidatePath('/dashboard')
  return {}
}
