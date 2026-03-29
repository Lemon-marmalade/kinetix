'use client'

import type { GeminiAnalysisInput } from './prompts'

export type { GeminiAnalysisInput }

/**
 * Calls the server-side /api/coaching route so the Gemini API key
 * never appears in the browser bundle.
 */
export async function generateCoachingFeedback(input: GeminiAnalysisInput): Promise<string> {
  const res = await fetch('/api/coaching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Feedback generation failed')
  }

  const { text } = await res.json() as { text: string }
  if (!text) throw new Error('Empty feedback response')
  return text
}
