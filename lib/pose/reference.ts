import type { PoseFrame, ReferenceSequence, ReferenceComparisonResult, JointDeviation, MovementType } from '@/types'
import { LANDMARK_NAMES } from './angles'

// Key joints to compare (indices into landmarks array)
const COMPARISON_JOINTS = [11, 12, 23, 24, 25, 26, 27, 28]

/** Simple DTW distance between two sequences of scalar values */
function dtwDistance(a: number[], b: number[]): number {
  const n = a.length
  const m = b.length
  const dtw: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity))
  dtw[0][0] = 0

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1])
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1])
    }
  }
  return dtw[n][m] / Math.max(n, m)
}

/** Normalize a sequence to fixed length via linear interpolation */
function normalizeLength(frames: PoseFrame[], targetLength: number): PoseFrame[] {
  if (frames.length === 0) return []
  if (frames.length === targetLength) return frames
  const result: PoseFrame[] = []
  for (let i = 0; i < targetLength; i++) {
    const t = (i / (targetLength - 1)) * (frames.length - 1)
    const lo = Math.floor(t)
    const hi = Math.min(Math.ceil(t), frames.length - 1)
    const alpha = t - lo
    const loFrame = frames[lo]
    const hiFrame = frames[hi]
    result.push({
      timestamp: loFrame.timestamp * (1 - alpha) + hiFrame.timestamp * alpha,
      frameIndex: i,
      landmarks: loFrame.landmarks.map((lm, idx) => ({
        x: lm.x * (1 - alpha) + hiFrame.landmarks[idx].x * alpha,
        y: lm.y * (1 - alpha) + hiFrame.landmarks[idx].y * alpha,
        z: lm.z * (1 - alpha) + hiFrame.landmarks[idx].z * alpha,
        visibility: (lm.visibility ?? 1) * (1 - alpha) + (hiFrame.landmarks[idx].visibility ?? 1) * alpha,
      })),
    })
  }
  return result
}

/** Load a reference sequence from /public/reference/ */
export async function loadReferenceSequence(filename: string): Promise<ReferenceSequence> {
  const response = await fetch(`/reference/${filename}`)
  if (!response.ok) throw new Error(`Failed to load reference: ${filename}`)
  return response.json()
}

/** Load all built-in reference sequences for a movement type */
export async function loadBuiltInReferences(movementType: MovementType): Promise<ReferenceSequence[]> {
  if (movementType === 'lateral_cut') {
    const [ref1, ref2] = await Promise.all([
      loadReferenceSequence('lateral_cut_ideal_1.json'),
      loadReferenceSequence('lateral_cut_ideal_2.json'),
    ])
    return [ref1, ref2]
  }
  // Jump landing references could be added later
  return []
}

/** Compare user pose sequence against a reference sequence */
export function compareToReference(
  userFrames: PoseFrame[],
  referenceFrames: PoseFrame[]
): ReferenceComparisonResult {
  const targetLength = Math.min(30, Math.max(userFrames.length, referenceFrames.length))
  const userNorm = normalizeLength(userFrames, targetLength)
  const refNorm = normalizeLength(referenceFrames, targetLength)

  // Per-joint DTW distance
  const jointDeviations: JointDeviation[] = COMPARISON_JOINTS.map(jointIdx => {
    const userXSeq = userNorm.map(f => f.landmarks[jointIdx]?.x ?? 0)
    const userYSeq = userNorm.map(f => f.landmarks[jointIdx]?.y ?? 0)
    const refXSeq = refNorm.map(f => f.landmarks[jointIdx]?.x ?? 0)
    const refYSeq = refNorm.map(f => f.landmarks[jointIdx]?.y ?? 0)

    const xDist = dtwDistance(userXSeq, refXSeq)
    const yDist = dtwDistance(userYSeq, refYSeq)
    const totalDeviation = (xDist + yDist) * 100 // convert to percentage-like

    const severity =
      totalDeviation > 15 ? 'severe' :
      totalDeviation > 8 ? 'moderate' : 'mild'

    return {
      jointIndex: jointIdx,
      jointName: LANDMARK_NAMES[jointIdx] ?? `Joint ${jointIdx}`,
      deviationDegrees: parseFloat(totalDeviation.toFixed(2)),
      severity,
    }
  })

  // Temporal alignment: mean across all joint DTW scores
  const temporalAlignment = 1 - Math.min(1, jointDeviations.reduce((s, j) => s + j.deviationDegrees, 0) / (COMPARISON_JOINTS.length * 20))

  // Symmetry score across all frames
  let symmetrySum = 0
  for (const frame of userNorm) {
    const lms = frame.landmarks
    if (lms.length < 33) continue
    const lHipX = lms[23].x
    const rHipX = lms[24].x
    const midX = (lHipX + rHipX) / 2
    const lKneeX = lms[25].x
    const rKneeX = lms[26].x
    symmetrySum += Math.abs((lKneeX - midX) + (rKneeX - midX))
  }
  const rawSymmetry = symmetrySum / Math.max(userNorm.length, 1)
  const symmetryScore = clamp01(1 - rawSymmetry * 10)

  const overallSimilarity = clamp01((temporalAlignment + symmetryScore) / 2)

  return {
    overallSimilarity: parseFloat((overallSimilarity * 100).toFixed(1)),
    symmetryScore: parseFloat((symmetryScore * 100).toFixed(1)),
    jointDeviations,
    temporalAlignment: parseFloat((temporalAlignment * 100).toFixed(1)),
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Return the top N most deviated joint names */
export function getTopDeviatedJoints(comparison: ReferenceComparisonResult, n = 3): string[] {
  return [...comparison.jointDeviations]
    .sort((a, b) => b.deviationDegrees - a.deviationDegrees)
    .slice(0, n)
    .map(j => j.jointName)
}
