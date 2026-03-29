/**
 * Ideal pose landmark sets for each movement type.
 * Coordinates are normalized (0–1), front-facing view unless noted.
 *
 * getIdealLandmarksForPose() uses the USER'S actual joint angles to pick
 * the correct phase of the ideal (e.g., squat depth, hip hinge depth)
 * instead of guessing from video timestamp.
 */
import type { PoseLandmark, MovementType } from '@/types'

function lm(x: number, y: number, z = 0, v = 0.95): PoseLandmark {
  return { x, y, z, visibility: v }
}

function buildSkeleton(overrides: Partial<Record<number, PoseLandmark>>): PoseLandmark[] {
  const base: PoseLandmark[] = [
    lm(0.50, 0.07),  // 0  nose
    lm(0.47, 0.06),  // 1  left_eye_inner
    lm(0.46, 0.06),  // 2  left_eye
    lm(0.44, 0.06),  // 3  left_eye_outer
    lm(0.53, 0.06),  // 4  right_eye_inner
    lm(0.54, 0.06),  // 5  right_eye
    lm(0.56, 0.06),  // 6  right_eye_outer
    lm(0.42, 0.08),  // 7  left_ear
    lm(0.58, 0.08),  // 8  right_ear
    lm(0.48, 0.10),  // 9  mouth_left
    lm(0.52, 0.10),  // 10 mouth_right
    lm(0.37, 0.26),  // 11 left_shoulder
    lm(0.63, 0.26),  // 12 right_shoulder
    lm(0.27, 0.40),  // 13 left_elbow
    lm(0.73, 0.40),  // 14 right_elbow
    lm(0.22, 0.53),  // 15 left_wrist
    lm(0.78, 0.53),  // 16 right_wrist
    lm(0.20, 0.57),  // 17 left_pinky
    lm(0.80, 0.57),  // 18 right_pinky
    lm(0.21, 0.56),  // 19 left_index
    lm(0.79, 0.56),  // 20 right_index
    lm(0.22, 0.55),  // 21 left_thumb
    lm(0.78, 0.55),  // 22 right_thumb
    lm(0.42, 0.55),  // 23 left_hip
    lm(0.58, 0.55),  // 24 right_hip
    lm(0.41, 0.73),  // 25 left_knee
    lm(0.59, 0.73),  // 26 right_knee
    lm(0.41, 0.91),  // 27 left_ankle
    lm(0.59, 0.91),  // 28 right_ankle
    lm(0.40, 0.94),  // 29 left_heel
    lm(0.60, 0.94),  // 30 right_heel
    lm(0.39, 0.97),  // 31 left_foot_index
    lm(0.61, 0.97),  // 32 right_foot_index
  ]
  Object.entries(overrides).forEach(([i, val]) => { base[Number(i)] = val! })
  return base
}

// ─── Individual movement keyframes ───────────────────────────────────────────

const athleticStance = buildSkeleton({})

const squatBottom = buildSkeleton({
  0:  lm(0.50, 0.27),
  7:  lm(0.42, 0.29), 8:  lm(0.58, 0.29),
  11: lm(0.38, 0.43), 12: lm(0.62, 0.43),
  13: lm(0.29, 0.52), 14: lm(0.71, 0.52),
  15: lm(0.27, 0.60), 16: lm(0.73, 0.60),
  23: lm(0.40, 0.70), 24: lm(0.60, 0.70),
  25: lm(0.36, 0.72), 26: lm(0.64, 0.72),
  27: lm(0.34, 0.90), 28: lm(0.66, 0.90),
  29: lm(0.33, 0.93), 30: lm(0.67, 0.93),
  31: lm(0.31, 0.97), 32: lm(0.69, 0.97),
})

const squatMid = buildSkeleton({
  0:  lm(0.50, 0.17),
  11: lm(0.37, 0.34), 12: lm(0.63, 0.34),
  13: lm(0.28, 0.46), 14: lm(0.72, 0.46),
  15: lm(0.26, 0.56), 16: lm(0.74, 0.56),
  23: lm(0.41, 0.62), 24: lm(0.59, 0.62),
  25: lm(0.38, 0.73), 26: lm(0.62, 0.73),
  27: lm(0.37, 0.90), 28: lm(0.63, 0.90),
})

const squatTop = buildSkeleton({
  11: lm(0.37, 0.26), 12: lm(0.63, 0.26),
  23: lm(0.42, 0.54), 24: lm(0.58, 0.54),
  25: lm(0.41, 0.72), 26: lm(0.59, 0.72),
})

const plankIdeal = buildSkeleton({
  // Side view — straight line ear→shoulder→hip→ankle
  0:  lm(0.18, 0.38),
  7:  lm(0.19, 0.36), 8:  lm(0.19, 0.36),
  11: lm(0.26, 0.38), 12: lm(0.28, 0.38),
  13: lm(0.26, 0.58), 14: lm(0.28, 0.58),
  15: lm(0.25, 0.63), 16: lm(0.27, 0.63),
  23: lm(0.50, 0.38), 24: lm(0.52, 0.38),
  25: lm(0.68, 0.45), 26: lm(0.70, 0.45),
  27: lm(0.80, 0.60), 28: lm(0.82, 0.60),
  29: lm(0.82, 0.63), 30: lm(0.84, 0.63),
  31: lm(0.83, 0.65), 32: lm(0.85, 0.65),
})

const lateralCutPlant = buildSkeleton({
  0:  lm(0.52, 0.16),
  11: lm(0.38, 0.32), 12: lm(0.62, 0.32),
  13: lm(0.30, 0.44), 14: lm(0.68, 0.40),
  15: lm(0.24, 0.55), 16: lm(0.72, 0.50),
  23: lm(0.42, 0.57), 24: lm(0.58, 0.57),
  25: lm(0.38, 0.73), 26: lm(0.60, 0.73),
  27: lm(0.36, 0.90), 28: lm(0.61, 0.90),
  29: lm(0.35, 0.93), 30: lm(0.61, 0.93),
  31: lm(0.33, 0.97), 32: lm(0.62, 0.97),
})

const jumpLandingIdeal = buildSkeleton({
  0:  lm(0.50, 0.24),
  11: lm(0.37, 0.40), 12: lm(0.63, 0.40),
  13: lm(0.28, 0.50), 14: lm(0.72, 0.50),
  15: lm(0.23, 0.58), 16: lm(0.77, 0.58),
  23: lm(0.42, 0.63), 24: lm(0.58, 0.63),
  25: lm(0.38, 0.75), 26: lm(0.62, 0.75),
  27: lm(0.38, 0.90), 28: lm(0.62, 0.90),
  29: lm(0.37, 0.93), 30: lm(0.63, 0.93),
  31: lm(0.36, 0.97), 32: lm(0.64, 0.97),
})

const deadliftHinge = buildSkeleton({
  // Hip hinge: torso parallel to floor, neutral spine, shins vertical
  0:  lm(0.38, 0.30),
  7:  lm(0.35, 0.30), 8:  lm(0.41, 0.30),
  11: lm(0.30, 0.42), 12: lm(0.52, 0.42),
  13: lm(0.28, 0.54), 14: lm(0.56, 0.54),
  15: lm(0.28, 0.64), 16: lm(0.58, 0.64),
  23: lm(0.44, 0.54), 24: lm(0.58, 0.54),
  25: lm(0.43, 0.72), 26: lm(0.57, 0.72),
  27: lm(0.43, 0.89), 28: lm(0.57, 0.89),
  29: lm(0.42, 0.92), 30: lm(0.58, 0.92),
  31: lm(0.41, 0.96), 32: lm(0.59, 0.96),
})

const deadliftTop = buildSkeleton({
  11: lm(0.37, 0.26), 12: lm(0.63, 0.26),
  13: lm(0.28, 0.38), 14: lm(0.72, 0.38),
  15: lm(0.26, 0.50), 16: lm(0.74, 0.50),
  23: lm(0.42, 0.54), 24: lm(0.58, 0.54),
  25: lm(0.41, 0.72), 26: lm(0.59, 0.72),
})

const lungeBottom = buildSkeleton({
  // Front knee at 90°, back knee near floor
  0:  lm(0.50, 0.12),
  11: lm(0.38, 0.28), 12: lm(0.62, 0.28),
  13: lm(0.29, 0.40), 14: lm(0.71, 0.40),
  15: lm(0.24, 0.50), 16: lm(0.76, 0.50),
  23: lm(0.42, 0.50), 24: lm(0.58, 0.50),
  25: lm(0.38, 0.68), 26: lm(0.64, 0.72),
  27: lm(0.36, 0.88), 28: lm(0.72, 0.88),
  29: lm(0.35, 0.91), 30: lm(0.73, 0.91),
  31: lm(0.33, 0.96), 32: lm(0.74, 0.96),
})

const overheadPressTop = buildSkeleton({
  // Arms fully extended overhead
  11: lm(0.37, 0.28), 12: lm(0.63, 0.28),
  13: lm(0.32, 0.14), 14: lm(0.68, 0.14),
  15: lm(0.34, 0.04), 16: lm(0.66, 0.04),
  17: lm(0.33, 0.02), 18: lm(0.67, 0.02),
  19: lm(0.34, 0.02), 20: lm(0.66, 0.02),
  21: lm(0.35, 0.03), 22: lm(0.65, 0.03),
  23: lm(0.43, 0.54), 24: lm(0.57, 0.54),
})

const overheadPressBottom = buildSkeleton({
  // Bar at chin height, elbows at shoulder level
  11: lm(0.37, 0.26), 12: lm(0.63, 0.26),
  13: lm(0.26, 0.26), 14: lm(0.74, 0.26),
  15: lm(0.28, 0.22), 16: lm(0.72, 0.22),
  17: lm(0.27, 0.21), 18: lm(0.73, 0.21),
  19: lm(0.28, 0.21), 20: lm(0.72, 0.21),
  21: lm(0.29, 0.21), 22: lm(0.71, 0.21),
  23: lm(0.43, 0.54), 24: lm(0.57, 0.54),
})

const sprintDrivePhase = buildSkeleton({
  // High-knee drive: one leg forward, opposite arm back
  0:  lm(0.50, 0.10),
  11: lm(0.38, 0.26), 12: lm(0.62, 0.26),
  13: lm(0.48, 0.36), 14: lm(0.66, 0.40),
  15: lm(0.54, 0.30), 16: lm(0.72, 0.52),
  23: lm(0.44, 0.52), 24: lm(0.56, 0.52),
  25: lm(0.40, 0.48), 26: lm(0.58, 0.72),
  27: lm(0.40, 0.62), 28: lm(0.60, 0.90),
  29: lm(0.39, 0.64), 30: lm(0.60, 0.93),
  31: lm(0.38, 0.67), 32: lm(0.61, 0.97),
})

export const IDEAL_POSES: Record<MovementType, { label: string; keyframes: PoseLandmark[][] }> = {
  lateral_cut: { label: 'Ideal Cut', keyframes: [athleticStance, lateralCutPlant, athleticStance] },
  jump_landing: { label: 'Ideal Landing', keyframes: [athleticStance, jumpLandingIdeal, athleticStance] },
  squat: { label: 'Ideal Squat', keyframes: [squatTop, squatMid, squatBottom, squatMid, squatTop] },
  plank: { label: 'Ideal Plank', keyframes: [plankIdeal] },
  deadlift: { label: 'Ideal Deadlift', keyframes: [deadliftTop, deadliftHinge, deadliftTop] },
  lunge: { label: 'Ideal Lunge', keyframes: [athleticStance, lungeBottom, athleticStance] },
  overhead_press: { label: 'Ideal Press', keyframes: [overheadPressBottom, overheadPressTop, overheadPressBottom] },
  sprint: { label: 'Sprint Mechanics', keyframes: [athleticStance, sprintDrivePhase, athleticStance] },
}

/** Time-based fallback: linear interpolation through keyframes at progress t ∈ [0,1] */
export function getIdealLandmarks(movementType: MovementType, t: number): PoseLandmark[] {
  const keyframes = IDEAL_POSES[movementType]?.keyframes ?? [athleticStance]
  if (keyframes.length === 1) return keyframes[0]
  const idx = t * (keyframes.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(Math.ceil(idx), keyframes.length - 1)
  const alpha = idx - lo
  if (alpha === 0 || lo === hi) return keyframes[lo]
  return interpolate(keyframes[lo], keyframes[hi], alpha)
}

function interpolate(a: PoseLandmark[], b: PoseLandmark[], t: number): PoseLandmark[] {
  return a.map((lmA, i) => {
    const lmB = b[i]
    return {
      x: lmA.x + (lmB.x - lmA.x) * t,
      y: lmA.y + (lmB.y - lmA.y) * t,
      z: lmA.z + (lmB.z - lmA.z) * t,
      visibility: 0.8,
    }
  })
}

/** Angle at joint b (in degrees) between segments a→b and b→c */
function angleBetween(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ax = a.x - b.x, ay = a.y - b.y
  const cx = c.x - b.x, cy = c.y - b.y
  const dot = ax * cx + ay * cy
  const mag = Math.sqrt((ax * ax + ay * ay) * (cx * cx + cy * cy))
  if (mag < 1e-6) return 180
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

/**
 * Phase-based ideal skeleton: reads the user's actual joint angles to determine
 * where they are in the movement and returns the matching ideal form.
 * Much more accurate than time-based interpolation.
 */
export function getIdealLandmarksForPose(
  movementType: MovementType,
  userLms: PoseLandmark[]
): PoseLandmark[] {
  if (!userLms || userLms.length < 29) return getIdealLandmarks(movementType, 0.5)

  switch (movementType) {
    case 'squat': {
      const lKnee = angleBetween(userLms[23], userLms[25], userLms[27])
      const rKnee = angleBetween(userLms[24], userLms[26], userLms[28])
      const avgKnee = (lKnee + rKnee) / 2
      // 165° = standing (t=0), 85° = deep squat (t=1)
      const t = Math.max(0, Math.min(1, (165 - avgKnee) / 80))
      return getIdealLandmarks(movementType, t)
    }

    case 'deadlift': {
      // Hip angle: shoulder-hip-knee measures forward lean / hinge depth
      const lHip = angleBetween(userLms[11], userLms[23], userLms[25])
      const rHip = angleBetween(userLms[12], userLms[24], userLms[26])
      const avgHip = (lHip + rHip) / 2
      // 175° = standing (t=0), 85° = deep hinge (t=1)
      const t = Math.max(0, Math.min(1, (175 - avgHip) / 90))
      return getIdealLandmarks(movementType, t)
    }

    case 'lunge': {
      const lKnee = angleBetween(userLms[23], userLms[25], userLms[27])
      const rKnee = angleBetween(userLms[24], userLms[26], userLms[28])
      const frontKnee = Math.min(lKnee, rKnee)
      // 165° = standing (t=0), 85° = lunge depth (t=1)
      const t = Math.max(0, Math.min(1, (165 - frontKnee) / 80))
      return getIdealLandmarks(movementType, t)
    }

    case 'jump_landing': {
      const lKnee = angleBetween(userLms[23], userLms[25], userLms[27])
      const rKnee = angleBetween(userLms[24], userLms[26], userLms[28])
      const avgKnee = (lKnee + rKnee) / 2
      const t = Math.max(0, Math.min(1, (165 - avgKnee) / 70))
      return getIdealLandmarks(movementType, t)
    }

    case 'overhead_press': {
      // Elbow angle: low = arms bent/down, high = extended
      const lElbow = angleBetween(userLms[11], userLms[13], userLms[15])
      const rElbow = angleBetween(userLms[12], userLms[14], userLms[16])
      const avgElbow = (lElbow + rElbow) / 2
      // 70° = arms down (t=0), 170° = fully extended (t=1)
      const t = Math.max(0, Math.min(1, (avgElbow - 70) / 100))
      return getIdealLandmarks(movementType, t)
    }

    case 'lateral_cut': {
      const lKnee = angleBetween(userLms[23], userLms[25], userLms[27])
      const rKnee = angleBetween(userLms[24], userLms[26], userLms[28])
      const avgKnee = (lKnee + rKnee) / 2
      const t = Math.max(0, Math.min(1, (160 - avgKnee) / 60))
      return getIdealLandmarks(movementType, t)
    }

    case 'sprint': {
      // Hip angle indicates stride phase
      const lHip = angleBetween(userLms[11], userLms[23], userLms[25])
      const rHip = angleBetween(userLms[12], userLms[24], userLms[26])
      const minHip = Math.min(lHip, rHip)
      const t = Math.max(0, Math.min(1, (180 - minHip) / 90))
      return getIdealLandmarks(movementType, t)
    }

    default:
      return getIdealLandmarks(movementType, 0.5)
  }
}

/**
 * Interpolate reference frames at a given relative progress [0-1].
 * Used when a custom reference video has been uploaded.
 */
export function interpolateRefFrames(
  refFrames: { timestamp: number; landmarks: PoseLandmark[] }[],
  t: number
): PoseLandmark[] | null {
  if (!refFrames.length) return null
  const totalDur = refFrames[refFrames.length - 1].timestamp
  if (totalDur <= 0) return refFrames[0].landmarks
  const targetTime = t * totalDur

  let lo = 0, hi = refFrames.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (refFrames[mid].timestamp < targetTime) lo = mid + 1
    else hi = mid
  }
  if (lo === 0) return refFrames[0].landmarks
  const prev = refFrames[lo - 1], next = refFrames[lo]
  const span = next.timestamp - prev.timestamp
  const alpha = span > 0 ? (targetTime - prev.timestamp) / span : 1
  return interpolate(prev.landmarks, next.landmarks, Math.min(1, Math.max(0, alpha)))
}
