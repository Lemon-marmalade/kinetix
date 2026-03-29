import type { PoseFrame, DetectedIssue, Scores, MovementType, PoseLandmark } from '@/types'
import {
  kneeValgusDeviation, torsoLateralTilt, hipDropAbs, lateralSymmetry,
  plankHipDeviation, shoulderAsymmetry, kneeAngle, LANDMARKS,
} from './angles'
import { selectKeyFrames } from './detection'

const SEVERITY_WEIGHT = { mild: 1, moderate: 2.5, severe: 5 }

function clamp(v: number, min = 0, max = 10): number {
  return Math.max(min, Math.min(max, v))
}
function pct(v: number): number { return parseFloat(v.toFixed(1)) }

/**
 * Deduction with dead zone.
 * No penalty below `floor`; scales to `max` deduction at `ceiling`.
 * Prevents perfect-form noise (unavoidable micro-variations) from costing points.
 */
function deduct(value: number, floor: number, ceiling: number, maxPenalty: number): number {
  if (value <= floor) return 0
  return clamp(((value - floor) / (ceiling - floor)) * maxPenalty, 0, maxPenalty)
}

/** Normalize hip-drop by hip width so body size doesn't skew the reading. */
function normalizedHipDrop(lms: PoseLandmark[]): number {
  const lH = lms[LANDMARKS.LEFT_HIP]
  const rH = lms[LANDMARKS.RIGHT_HIP]
  if (!lH || !rH) return 0
  const hipW = Math.max(Math.hypot(rH.x - lH.x, rH.y - lH.y), 0.06)
  return hipDropAbs(lms) / hipW
}

/** Normalize valgus by hip width (same convention as detection.ts). */
function normalizedValgus(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const lH = lms[LANDMARKS.LEFT_HIP]
  const rH = lms[LANDMARKS.RIGHT_HIP]
  if (!lH || !rH) return 0
  const hipW = Math.max(Math.hypot(rH.x - lH.x, rH.y - lH.y), 0.06)
  return Math.max(kneeValgusDeviation(lms, side), 0) / hipW
}

/** True if hip and knee landmarks all have acceptable confidence. */
function isFrameUsable(lms: PoseLandmark[]): boolean {
  const MIN_VIS = 0.50
  const ids = [
    LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
    LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
  ]
  return ids.every(i => (lms[i]?.visibility ?? 1) >= MIN_VIS)
}

// ─── Movement-specific score computation ─────────────────────────────────────

function computeAthletic(keyFrames: PoseFrame[], allIssues: DetectedIssue[]): Scores {
  let valgusSum = 0, tiltSum = 0, dropSum = 0, asymSum = 0, n = 0

  for (const f of keyFrames) {
    if (f.landmarks.length < 33 || !isFrameUsable(f.landmarks)) continue
    n++
    valgusSum += Math.max(normalizedValgus(f.landmarks, 'left'), normalizedValgus(f.landmarks, 'right'))
    tiltSum   += torsoLateralTilt(f.landmarks)
    dropSum   += normalizedHipDrop(f.landmarks)
    asymSum   += lateralSymmetry(f.landmarks)
  }
  const N = Math.max(n, 1)
  const avgValgus = valgusSum / N
  const avgTilt   = tiltSum   / N
  const avgDrop   = dropSum   / N
  const avgAsym   = asymSum   / N

  // Dead zones: small natural variation doesn't cost points.
  // Ceiling: level where score reaches maximum penalty.
  const tiltD   = deduct(avgTilt,   5,  28, 4)   // fine ≤5°, full penalty at 28°
  const dropD   = deduct(avgDrop,   0.04, 0.22, 4) // fine ≤4%, full at 22%
  const valgusD = deduct(avgValgus, 0.04, 0.30, 5) // fine ≤4%, full at 30%
  const asymD   = deduct(avgAsym,   8,   35,  3)   // fine ≤8°, full at 35°

  const stability = clamp(10 - tiltD - dropD)
  const alignment = clamp(10 - valgusD - asymD)

  const issueScore = allIssues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(issueScore * 1.1 + ((10 - stability) + (10 - alignment)) / 4)

  return buildScores(stability, alignment, risk, allIssues, [
    { name: 'Torso Stability',    contribution: -tiltD,   description: `Avg ${avgTilt.toFixed(1)}° lateral tilt` },
    { name: 'Hip Level',          contribution: -dropD,   description: `Avg ${(avgDrop * 100).toFixed(1)}% hip drop` },
  ], [
    { name: 'Knee Alignment',     contribution: -valgusD, description: `Avg ${(avgValgus * 100).toFixed(1)}% normalized valgus` },
    { name: 'Bilateral Symmetry', contribution: -asymD,   description: `Avg ${avgAsym.toFixed(1)}° asymmetry` },
  ])
}

function computeSquat(keyFrames: PoseFrame[], allIssues: DetectedIssue[]): Scores {
  let valgusSum = 0, tiltSum = 0, dropSum = 0, n = 0
  let minKneeAvg = 180

  for (const f of keyFrames) {
    if (f.landmarks.length < 33 || !isFrameUsable(f.landmarks)) continue
    n++
    valgusSum += Math.max(normalizedValgus(f.landmarks, 'left'), normalizedValgus(f.landmarks, 'right'))
    tiltSum   += torsoLateralTilt(f.landmarks)
    dropSum   += normalizedHipDrop(f.landmarks)
    const kAvg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (kAvg < minKneeAvg) minKneeAvg = kAvg
  }
  const N = Math.max(n, 1)
  const avgValgus = valgusSum / N
  const avgTilt   = tiltSum   / N
  const avgDrop   = dropSum   / N

  // Squats at depth naturally show higher valgus / tilt than neutral stance.
  // Dead zones absorb normal at-depth variation; ceilings match visibly problematic form.
  const valgusD = deduct(avgValgus, 0.05, 0.32, 5)  // fine ≤5%, penalty ceiling at 32%
  const tiltD   = deduct(avgTilt,   6,   28,  3.5)  // fine ≤6°, ceiling at 28°
  const dropD   = deduct(avgDrop,   0.05, 0.22, 3)  // fine ≤5%, ceiling at 22%

  // Reward reaching depth (knee angle ≤ 95° = at/below parallel)
  const depthBonus = minKneeAvg <= 90  ? 1.5   // full depth
                   : minKneeAvg <= 105 ? 0.75  // close to parallel
                   : 0                         // above parallel — no bonus

  const alignment = clamp(10 - valgusD + depthBonus)
  const stability = clamp(10 - tiltD - dropD)

  const issueScore = allIssues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(issueScore * 1.0 + ((10 - stability) + (10 - alignment)) / 4.5)

  return buildScores(stability, alignment, risk, allIssues, [
    { name: 'Lateral Stability', contribution: -tiltD,  description: `Avg ${avgTilt.toFixed(1)}° lateral tilt at depth` },
    { name: 'Hip Level',         contribution: -dropD,  description: `Avg ${(avgDrop * 100).toFixed(1)}% hip drop at depth` },
  ], [
    { name: 'Knee Tracking', contribution: -valgusD,   description: `Avg ${(avgValgus * 100).toFixed(1)}% normalized valgus at depth` },
    { name: 'Squat Depth',   contribution: depthBonus, description: minKneeAvg <= 90 ? `${minKneeAvg.toFixed(0)}° — full depth` : minKneeAvg <= 105 ? `${minKneeAvg.toFixed(0)}° — near parallel` : `${minKneeAvg.toFixed(0)}° — above parallel` },
  ])
}

function computePlank(keyFrames: PoseFrame[], allIssues: DetectedIssue[]): Scores {
  let sagSum = 0, shoulderSum = 0, n = 0

  for (const f of keyFrames) {
    if (f.landmarks.length < 33) continue
    const lS = f.landmarks[LANDMARKS.LEFT_SHOULDER], rS = f.landmarks[LANDMARKS.RIGHT_SHOULDER]
    if ((lS?.visibility ?? 1) < 0.5 || (rS?.visibility ?? 1) < 0.5) continue
    n++
    sagSum      += Math.abs(plankHipDeviation(f.landmarks))
    shoulderSum += shoulderAsymmetry(f.landmarks)
  }
  const N = Math.max(n, 1)
  const avgSag      = sagSum      / N
  const avgShoulder = shoulderSum / N

  const sagD      = deduct(avgSag,      0.015, 0.10, 5)   // fine ≤1.5%, full at 10%
  const shoulderD = deduct(avgShoulder, 0.02,  0.09, 2.5) // fine ≤2%, full at 9%

  const stability = clamp(10 - sagD - shoulderD)
  const alignment = clamp(10 - sagD * 0.6 - shoulderD * 0.8)

  const issueScore = allIssues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const risk = clamp(issueScore * 0.9 + (10 - stability) / 3)

  return buildScores(stability, alignment, risk, allIssues, [
    { name: 'Hip Position',      contribution: -sagD,      description: `Avg ${(avgSag * 100).toFixed(1)}% deviation from plank line` },
    { name: 'Shoulder Symmetry', contribution: -shoulderD, description: `${(avgShoulder * 100).toFixed(1)}% height difference` },
  ], [
    { name: 'Body Line',      contribution: -sagD * 0.6,      description: 'Shoulder-hip-ankle alignment' },
    { name: 'Shoulder Level', contribution: -shoulderD * 0.8, description: 'Scapular symmetry' },
  ])
}

function buildScores(
  stability: number, alignment: number, risk: number,
  issues: DetectedIssue[],
  stabilityFactors: { name: string; contribution: number; description: string }[],
  alignmentFactors: { name: string; contribution: number; description: string }[]
): Scores {
  const issueScore = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0)
  const biomechD = ((10 - stability) + (10 - alignment)) / 5

  return {
    stability: pct(stability),
    alignment: pct(alignment),
    risk: pct(risk),
    breakdowns: {
      stability: { value: pct(stability), factors: stabilityFactors },
      alignment: { value: pct(alignment), factors: alignmentFactors },
      risk: {
        value: pct(risk),
        factors: [
          { name: 'Issue Severity',        contribution: Math.min(8, issueScore * 0.9), description: `${issues.length} issue(s) detected` },
          { name: 'Biomechanical Deficit', contribution: biomechD,                      description: 'From stability + alignment scores' },
        ],
      },
    },
  }
}

export function computeScores(
  frames: PoseFrame[], issues: DetectedIssue[], movementType: MovementType = 'lateral_cut'
): Scores {
  if (frames.length === 0) {
    const empty = { value: 0, factors: [] }
    return { stability: 0, alignment: 0, risk: 0, breakdowns: { stability: empty, alignment: empty, risk: empty } }
  }

  // Score over the biomechanically critical phase only (same selection as detection).
  // Without this, standing/transition frames dominate and every video scores the same.
  const keyFrames = selectKeyFrames(frames, movementType)

  switch (movementType) {
    case 'lateral_cut':
    case 'jump_landing':
    case 'sprint':
      return computeAthletic(keyFrames, issues)
    case 'squat':
    case 'deadlift':
    case 'lunge':
      return computeSquat(keyFrames, issues)
    case 'plank':
      return computePlank(keyFrames, issues)
    case 'overhead_press':
    default:
      return computeAthletic(keyFrames, issues)
  }
}
