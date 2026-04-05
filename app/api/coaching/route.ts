/**
 * Server-side coaching feedback endpoint.
 * Keeps the Gemini API key out of the browser bundle.
 *
 * Required env var (server-only, no NEXT_PUBLIC_ prefix):
 *   GEMINI_API_KEY=<your-key>
 *
 * Legacy fallback: if GEMINI_API_KEY is not set, NEXT_PUBLIC_GEMINI_API_KEY is used.
 * Teams should migrate to the server-only key to prevent accidental key exposure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { SYSTEM_PROMPT, buildAnalysisPrompt } from '@/lib/gemini/prompts'
import type { GeminiAnalysisInput } from '@/lib/gemini/prompts'
import { ISSUE_META, MOVEMENT_META } from '@/types'

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY
const MOCK_AI_COACH = process.env.MOCK_AI_COACH === 'true'

function toSentenceCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function buildFallbackFeedback(input: GeminiAnalysisInput): string {
  const movementLabel = MOVEMENT_META[input.movementType].label.toLowerCase()
  const praise: string[] = []
  const recommendations: string[] = []

  if (input.scores.stability >= 7) {
    praise.push(`Your ${movementLabel} looks controlled, and your stability held up well across the session.`)
  } else {
    praise.push(`You stayed engaged through the full ${movementLabel} session and gave yourself usable movement data to coach from.`)
  }

  if (input.scores.alignment >= 7) {
    praise.push('Your joint alignment was generally solid, which gives you a good base to build on.')
  } else if ((input.repCount ?? 0) > 0) {
    praise.push(`You completed ${input.repCount} reps, which gives you a strong baseline for your next round.`)
  } else {
    praise.push('There are still some strong moments here, especially when you stay patient and organized through each rep.')
  }

  const topIssues = input.detectedIssues.slice(0, 3)
  if (topIssues.length === 0) {
    recommendations.push('Keep the same tempo and brace strategy, and aim to make each rep look as repeatable as the last.')
    recommendations.push('Film another set from the same angle so you can compare consistency across sessions.')
  } else {
    topIssues.forEach((issue) => {
      const label = toSentenceCase(ISSUE_META[issue.type]?.label ?? issue.type.replace(/_/g, ' '))
      recommendations.push(`${label}: ${issue.recommendation}`)
    })
  }

  return `WHAT YOU DID WELL
${praise.slice(0, 2).join(' ')}

RECOMMENDATIONS
${recommendations.slice(0, 3).join(' ')}`
}

export async function POST(req: NextRequest) {
  let input: GeminiAnalysisInput
  try {
    input = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (MOCK_AI_COACH || !API_KEY) {
    return NextResponse.json({
      text: buildFallbackFeedback(input),
      source: MOCK_AI_COACH ? 'mock' : 'fallback',
    })
  }

  try {
    const genai = new GoogleGenAI({ apiKey: API_KEY })
    const prompt = buildAnalysisPrompt(input)

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    })

    const text = response.text ?? ''
    if (!text) throw new Error('Empty response from model')
    return NextResponse.json({ text, source: 'gemini' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    const isRateLimited = message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429') || message.includes('quota')

    if (isRateLimited) {
      return NextResponse.json({
        text: buildFallbackFeedback(input),
        source: 'fallback',
        warning: 'Gemini quota exceeded. Returned local fallback coaching feedback.',
      })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
