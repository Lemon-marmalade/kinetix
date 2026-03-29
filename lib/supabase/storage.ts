import { createClient } from './client'

export async function uploadVideo(
  file: File,
  userId: string,
  sessionId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/${sessionId}.mp4`

  // Simulate progress for XHR-based upload
  onProgress?.(10)

  const { error } = await supabase.storage
    .from('session-videos')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  onProgress?.(100)

  const { data } = supabase.storage.from('session-videos').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteVideo(userId: string, sessionId: string): Promise<void> {
  const supabase = createClient()
  const path = `${userId}/${sessionId}.mp4`

  const { error } = await supabase.storage.from('session-videos').remove([path])
  if (error) throw new Error(`Delete failed: ${error.message}`)
}

export function getVideoExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}
