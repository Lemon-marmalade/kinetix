import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Scheduled daily via Supabase Dashboard:
// Edge Functions → delete-expired-videos → Schedules → 0 0 * * *
//
// What this does:
//   1. Finds sessions where video_expires_at < now AND video_url IS NOT NULL
//   2. Deletes the video file from storage
//   3. Sets video_url = null on the session row
//   Pose data (pose_data, pose_skeleton_summary, scores, detected_issues) is NEVER deleted.

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // 1. Find all sessions with expired videos
  const { data: expiredSessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, video_url')
    .lt('video_expires_at', new Date().toISOString())
    .not('video_url', 'is', null)

  if (fetchError) {
    console.error('Fetch error:', fetchError.message)
    return json({ error: fetchError.message }, 500)
  }

  if (!expiredSessions || expiredSessions.length === 0) {
    return json({ deleted: 0, message: 'No expired videos found' })
  }

  const results = { deleted: 0, skipped: 0, errors: [] as string[] }

  for (const session of expiredSessions) {
    try {
      // Extract storage path from the public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/session-videos/<userId>/<sessionId>.mp4
      const storagePath = extractStoragePath(session.video_url as string)

      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('session-videos')
          .remove([storagePath])

        if (storageError) {
          // File may already be gone — log but don't abort
          console.warn(`Storage delete skipped for ${session.id}: ${storageError.message}`)
          results.skipped++
        }
      }

      // Null out video_url — pose data remains intact
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ video_url: null })
        .eq('id', session.id)

      if (updateError) {
        results.errors.push(`DB update failed for ${session.id}: ${updateError.message}`)
      } else {
        results.deleted++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`Unexpected error for ${session.id}: ${msg}`)
    }
  }

  console.log(`Cleanup complete:`, results)
  return json(results)
})

function extractStoragePath(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl)
    // pathname: /storage/v1/object/public/session-videos/<path>
    const marker = '/session-videos/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(url.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
