import { GoogleGenAI } from '@google/genai'
import { SYSTEM_PROMPT, buildAnalysisPrompt, type GeminiAnalysisInput } from './prompts'

let genaiInstance: GoogleGenAI | null = null
let lastCallTime = 0
const COOLDOWN_MS = 10000 // 10 seconds between calls

function getGenAI(): GoogleGenAI {
  if (!genaiInstance) {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
    if (!apiKey) throw new Error('NEXT_PUBLIC_GEMINI_API_KEY is not set')
    genaiInstance = new GoogleGenAI({ apiKey })
  }
  return genaiInstance
}

export async function generateCoachingFeedback(input: GeminiAnalysisInput): Promise<string> {
  const now = Date.now()
  if (now - lastCallTime < COOLDOWN_MS) {
    throw new Error('Please wait a moment before requesting feedback again.')
  }
  lastCallTime = now

  const genai = getGenAI()
  const prompt = buildAnalysisPrompt(input)

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.7,
      maxOutputTokens: 512,
    },
  })

  const text = response.text ?? ''
  if (!text) throw new Error('Empty response from Gemini')
  return text
}