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
import { ISSUE_META, MOVEMENT_META, type DetectedIssue, type IssueType } from '@/types'

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY
const MOCK_AI_COACH = process.env.MOCK_AI_COACH === 'true'

function toSentenceCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function severityLead(severity: DetectedIssue['severity']): string {
  switch (severity) {
    case 'severe':
      return 'Your main priority is'
    case 'moderate':
      return 'The biggest cleanup point is'
    default:
      return 'One detail to tighten is'
  }
}

function chooseVariant<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length]
}

function issueCue(issue: DetectedIssue, movementLabel: string): string {
  const label = toSentenceCase(ISSUE_META[issue.type]?.label ?? issue.type.replace(/_/g, ' '))

  const cues: Partial<Record<IssueType, string[]>> = {
    knee_valgus: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so think about spreading the floor with your feet and keeping the knees tracking over the mid-foot during the ${movementLabel}.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the fastest fix is to stay rooted through the whole foot while driving the knees out as you load.`,
    ],
    hip_drop: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so keep the pelvis level and let the stance-side glute control the position instead of letting the hip drift.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will look cleaner if you stay tall over the stance leg and stop the pelvis from leaking side to side.`,
    ],
    torso_instability: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so brace earlier and keep the ribs stacked over the hips instead of letting the trunk sway.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the cue is simple: own the middle, stay tall, and keep the torso quiet through the rep.`,
    ],
    ankle_eversion: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so keep pressure through the tripod foot and avoid letting the arch collapse as you accept load.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will clean it up by keeping the ankle stacked and the foot heavy through the floor.`,
    ],
    landing_asymmetry: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so aim to absorb force evenly and match both legs instead of unloading one side on contact.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the next step is making both sides meet the ground and bend at the same time.`,
    ],
    stiff_landing: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so let the hips and knees absorb more of the landing instead of staying tall and rigid.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will look better right away if you land quieter and sink into the catch earlier.`,
    ],
    forward_trunk_lean: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so think chest up, sternum forward, and keep the torso from dumping as you descend.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the fix is to stay more organized through the trunk rather than folding early.`,
    ],
    rounded_back: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so brace before you move and keep the spine long instead of curling through the middle.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you should focus on holding a quieter trunk shape from setup through finish.`,
    ],
    knee_over_toe: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so sit into the hips a little earlier and control how far the knees glide forward.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you can improve it by slowing the descent and keeping the shin angle under better control.`,
    ],
    shallow_squat_depth: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so keep tension but allow the hips to travel lower instead of cutting the rep short.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the goal is to stay braced while owning a deeper bottom position.`,
    ],
    shoulder_asymmetry: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so square the shoulders earlier and keep both sides moving with the same rhythm.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will look cleaner if you stop one side from taking over the pattern.`,
    ],
    head_forward: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so keep the neck long and let the head stay stacked instead of reaching forward.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the cue is to keep the chin relaxed and the head floating over the ribcage.`,
    ],
    lumbar_hyperextension: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so bring the ribs down and keep the pelvis from tipping forward as you finish the rep.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you should think about finishing with the glutes rather than the low back.`,
    ],
    pelvic_tilt: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so stay stacked through the ribcage and pelvis instead of letting the hips spill forward.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will move more cleanly if you keep the core on before the rep starts.`,
    ],
    hip_sag: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so tuck slightly through the pelvis and keep the trunk in one straight line.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and the fix is to squeeze glutes and abs together instead of hanging through the low back.`,
    ],
    hip_pike: [
      `${severityLead(issue.severity)} ${label.toLowerCase()}, so lower the hips slightly and keep the body in a straighter line from shoulders to heels.`,
      `${severityLead(issue.severity)} ${label.toLowerCase()}, and you will get a better position by pushing the floor away without hiking the hips.`,
    ],
  }

  const variants = cues[issue.type]
  if (!variants?.length) {
    return `${label}: ${issue.recommendation}`
  }

  return chooseVariant(variants, issue.frames[0] ?? label.length)
}

function buildPraise(input: GeminiAnalysisInput, movementLabel: string): string[] {
  const praise: string[] = []
  const roundedStability = input.scores.stability.toFixed(1)
  const roundedAlignment = input.scores.alignment.toFixed(1)

  if (input.detectedIssues.length === 0) {
    praise.push(`This ${movementLabel} set looks clean overall, and you are already showing a repeatable movement pattern.`)
  } else if (input.scores.stability >= 7 && input.scores.alignment >= 7) {
    praise.push(`There is a solid base here, especially in how controlled and organized your ${movementLabel} looks from rep to rep.`)
  } else if (input.scores.stability >= input.scores.alignment) {
    praise.push(`Your control is ahead of your alignment right now, which is a good sign because the movement is not falling apart under effort.`)
  } else {
    praise.push(`You already have enough quality in this ${movementLabel} to build from, especially when you stay patient through the middle of the rep.`)
  }

  if ((input.repCount ?? 0) >= 8) {
    praise.push(`Across ${input.repCount} reps, the pattern stayed fairly consistent, and that repeatability gives you something useful to refine.`)
  } else if ((input.repCount ?? 0) > 0) {
    praise.push(`You finished ${input.repCount} reps, which is enough to see both your strengths and the spots that need cleanup.`)
  } else if (input.scores.alignment >= 7) {
    praise.push(`Your alignment score of ${roundedAlignment} shows that the structure is there when you keep your timing under control.`)
  } else {
    praise.push(`Even with a few leaks, you still have some strong positions here, and that is what makes this a coachable pattern instead of a reset.`)
  }

  if (input.detectedIssues.length > 0 && input.scores.risk <= 4) {
    praise.push(`The main issue is quality rather than chaos, because the risk profile is still relatively manageable at ${input.scores.risk.toFixed(1)}.`)
  } else if (input.detectedIssues.length === 0) {
    praise.push(`Your stability score of ${roundedStability} and alignment score of ${roundedAlignment} suggest a strong starting point for progression.`)
  }

  return praise.slice(0, 2)
}

function buildRecommendations(input: GeminiAnalysisInput, movementLabel: string): string[] {
  const topIssues = input.detectedIssues
    .slice()
    .sort((a, b) => {
      const severityRank = { severe: 3, moderate: 2, mild: 1 }
      return (severityRank[b.severity] - severityRank[a.severity]) || ((b.peakValue ?? 0) - (a.peakValue ?? 0))
    })
    .slice(0, 3)

  if (topIssues.length === 0) {
    return [
      `Keep the same tempo and bracing strategy, and make the next ${movementLabel} set look just as repeatable from the first rep to the last.`,
      'Film another set from the same angle and try to match the same positions without adding unnecessary speed.',
    ]
  }

  const lines = topIssues.map(issue => issueCue(issue, movementLabel))

  if (input.scores.risk >= 7) {
    lines.push(`Right now the best trade is to slow the next set down and own cleaner positions before you push speed or volume again.`)
  }

  return lines.slice(0, 3)
}

function buildFallbackFeedback(input: GeminiAnalysisInput): string {
  const movementLabel = MOVEMENT_META[input.movementType].label.toLowerCase()
  const praise = buildPraise(input, movementLabel)
  const recommendations = buildRecommendations(input, movementLabel)

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
