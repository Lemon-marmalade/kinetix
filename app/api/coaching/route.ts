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

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured on the server.' }, { status: 500 })
  }

  let input: GeminiAnalysisInput
  try {
    input = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
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
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
