// ElevenLabs TTS — uses HTML Audio elements (not AudioContext) so playback works
// even when triggered outside a direct user-gesture context (e.g. after an await).
// Audio blobs are cached as object URLs so pre-loaded phrases play instantly.

let currentAudio: HTMLAudioElement | null = null
const urlCache = new Map<string, string>() // text → object URL
let lastSpokenAt = 0
const MIN_INTERVAL_MS = 2500

async function fetchUrl(text: string): Promise<string> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? 'Text-to-speech request failed')
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

function playUrl(url: string, onEnd?: () => void): HTMLAudioElement {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  const audio = new Audio(url)
  audio.onended = () => { if (currentAudio === audio) currentAudio = null; onEnd?.() }
  audio.play().catch(() => {})
  currentAudio = audio
  return audio
}

/** Speak text via ElevenLabs. Returns a promise that resolves when audio finishes. */
export async function speak(text: string, interrupt = false): Promise<void> {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (!interrupt && now - lastSpokenAt < MIN_INTERVAL_MS) return
  lastSpokenAt = now

  if (interrupt && currentAudio) { currentAudio.pause(); currentAudio = null }

  let url = urlCache.get(text)
  if (!url) {
    url = await fetchUrl(text)
    urlCache.set(text, url)
  }

  await new Promise<void>(resolve => { playUrl(url!, resolve) })
}

/** Pre-fetch phrases into the cache so they play instantly later. Fire-and-forget. */
export function preload(texts: string[]): void {
  texts.forEach(async (t) => {
    if (urlCache.has(t)) return
    try {
      const url = await fetchUrl(t)
      urlCache.set(t, url)
    } catch {
      // Ignore preload failures; playback path can still fall back later.
    }
  })
}

/** Stop any currently playing audio. */
export function stop(): void {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
}
