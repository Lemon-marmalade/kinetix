// Supabase Edge Function: delete-expired-videos
// Deploy with: supabase functions deploy delete-expired-videos
// Schedule: daily at midnight UTC via Supabase cron (Dashboard > Edge Functions > Schedules)
// Cron expression: 0 0 * * *
//
// SETUP INSTRUCTIONS:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref <your-project-ref>
// 4. Deploy: supabase functions deploy delete-expired-videos
// 5. Set secret: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
// 6. In Supabase Dashboard → Edge Functions → delete-expired-videos → Schedules
//    Add schedule: 0 0 * * * (daily midnight UTC)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // Find sessions with expired videos that haven't been cleaned up
  const { data: expiredSessions, error: queryError } = await supabase
    .from('sessions')
    .select('id, video_url, user_id')
    .lt('video_expires_at', new Date().toISOString())
    .not('video_url', 'is', null)

  if (queryError) {
    console.error('Query error:', queryError)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  if (!expiredSessions || expiredSessions.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, message: 'No expired videos found' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const results = { deleted: 0, failed: 0 }

  for (const session of expiredSessions) {
    try {
      // Extract path from URL: {userId}/{sessionId}.mp4
      const url = session.video_url as string
      const bucketPrefix = '/session-videos/'
      const pathStart = url.indexOf(bucketPrefix)
      const storagePath = pathStart >= 0 ? url.slice(pathStart + bucketPrefix.length) : null

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('session-videos')
          .remove([storagePath])

        if (storageError) {
          console.error(`Storage delete error for ${session.id}:`, storageError)
          results.failed++
          continue
        }
      }

      // Set video_url to null — pose_data is kept permanently
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ video_url: null })
        .eq('id', session.id)

      if (updateError) {
        console.error(`DB update error for ${session.id}:`, updateError)
        results.failed++
      } else {
        results.deleted++
      }
    } catch (err) {
      console.error(`Unexpected error for session ${session.id}:`, err)
      results.failed++
    }
  }

  console.log(`Video cleanup complete: ${results.deleted} deleted, ${results.failed} failed`)

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  })
})
