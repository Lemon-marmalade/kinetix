import type { DetectedIssue, Scores, MovementType } from '@/types'

export interface GeminiAnalysisInput {
  movementType: MovementType
  detectedIssues: DetectedIssue[]
  scores: Scores
  topDeviatedJoints: string[]
  repCount?: number
  duration?: number
}

export const SYSTEM_PROMPT = `You are a warm, expert sports biomechanics coach giving post-session feedback.

Your response must have exactly two sections with these exact headings on their own lines:

WHAT YOU DID WELL
Write 2 sentences of genuine, specific praise based on the scores and absence of issues.

RECOMMENDATIONS
Write 2 to 3 short, specific coaching cues to fix the detected issues. One sentence each.

Rules: no markdown, no bullet points, no asterisks, no brackets. Plain conversational sentences only. Under 100 words total. Write as if speaking directly to the athlete.`

function toSentenceCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export function buildAnalysisPrompt(input: GeminiAnalysisInput): string {
  const { movementType, detectedIssues, scores, topDeviatedJoints, repCount, duration } = input

  const movementLabel = movementType.replace(/_/g, ' ')
  const issuesSummary = detectedIssues.length === 0
    ? 'No significant issues detected.'
    : detectedIssues.map(i =>
        `- ${toSentenceCase(i.type.replace(/_/g, ' '))} (${i.severity}): ${i.description}`
      ).join('\n')

  return `Movement: ${movementLabel}
${repCount ? `Reps completed: ${repCount}` : ''}
${duration ? `Duration: ${duration.toFixed(1)}s` : ''}

SCORES (0-10):
- Stability: ${scores.stability.toFixed(1)}
- Alignment: ${scores.alignment.toFixed(1)}
- Injury Risk: ${scores.risk.toFixed(1)} (higher = more risk)

ISSUES DETECTED:
${issuesSummary}

${topDeviatedJoints.length ? `Joints most off from ideal: ${topDeviatedJoints.join(', ')}` : ''}

Respond using the WHAT YOU DID WELL / RECOMMENDATIONS format from your instructions.`
}
