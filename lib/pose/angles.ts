import type { PoseLandmark } from '@/types'

export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
}

export const LANDMARK_NAMES: Record<number, string> = {
  0: 'Nose', 7: 'Left Ear', 8: 'Right Ear',
  11: 'Left Shoulder', 12: 'Right Shoulder',
  13: 'Left Elbow', 14: 'Right Elbow',
  15: 'Left Wrist', 16: 'Right Wrist',
  23: 'Left Hip', 24: 'Right Hip',
  25: 'Left Knee', 26: 'Right Knee',
  27: 'Left Ankle', 28: 'Right Ankle',
  29: 'Left Heel', 30: 'Right Heel',
  31: 'Left Foot', 32: 'Right Foot',
}

export type Vec3 = [number, number, number]

export function vec(a: PoseLandmark, b: PoseLandmark): Vec3 {
  return [b.x - a.x, b.y - a.y, b.z - a.z]
}

export function dot(v1: Vec3, v2: Vec3): number {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
}

export function mag(v: Vec3): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
}

/** Angle in degrees at vertex b, formed by a–b–c */
export function angleDeg(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const v1 = vec(b, a)
  const v2 = vec(b, c)
  const m = mag(v1) * mag(v2)
  if (m === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot(v1, v2) / m))) * 180) / Math.PI
}

/** Angle of line a→b from vertical (Y axis), in degrees (0=vertical, 90=horizontal) */
export function angleFromVertical(a: PoseLandmark, b: PoseLandmark): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI
}

/** Angle of line a→b from horizontal (X axis) */
export function angleFromHorizontal(a: PoseLandmark, b: PoseLandmark): number {
  return 90 - angleFromVertical(a, b)
}

/** Mid-point of two landmarks */
export function midpoint(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

// ─── Joint-specific helpers ──────────────────────────────────────────────────

export function kneeAngle(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const [H, K, A] = side === 'left'
    ? [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE]
    : [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE]
  return angleDeg(lms[H], lms[K], lms[A])
}

export function hipAngle(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const [S, H, K] = side === 'left'
    ? [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE]
    : [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE]
  return angleDeg(lms[S], lms[H], lms[K])
}

export function ankleAngle(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const [K, A, F] = side === 'left'
    ? [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX]
    : [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX]
  return angleDeg(lms[K], lms[A], lms[F])
}

export function shoulderAngle(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const [E, S, H] = side === 'left'
    ? [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP]
    : [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP]
  return angleDeg(lms[E], lms[S], lms[H])
}

export function elbowAngle(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const [S, E, W] = side === 'left'
    ? [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST]
    : [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST]
  return angleDeg(lms[S], lms[E], lms[W])
}

/** Torso lateral tilt from vertical (shoulder-mid to hip-mid angle) */
export function torsoLateralTilt(lms: PoseLandmark[]): number {
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  const hMid = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  return angleFromVertical(hMid, sMid)
}

/** Trunk forward lean: how far shoulders lean forward relative to hips (uses z + y) */
export function trunkForwardLean(lms: PoseLandmark[]): number {
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  const hMid = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  // Angle of shoulder-hip vector from vertical in the sagittal plane
  const dz = sMid.z - hMid.z
  const dy = sMid.y - hMid.y
  return Math.abs((Math.atan2(Math.abs(dz), Math.abs(dy)) * 180) / Math.PI)
}

/** Hip level difference — positive if left is lower (larger y value) */
export function hipDropDelta(lms: PoseLandmark[]): number {
  return lms[LANDMARKS.LEFT_HIP].y - lms[LANDMARKS.RIGHT_HIP].y
}

export function hipDropAbs(lms: PoseLandmark[]): number {
  return Math.abs(hipDropDelta(lms))
}

/**
 * Knee valgus deviation: positive = valgus (medial collapse)
 * Measures how far knee deviates inward from the hip-ankle midline.
 */
export function kneeValgusDeviation(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const hip = lms[side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP]
  const knee = lms[side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE]
  const ankle = lms[side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE]
  const midX = (hip.x + ankle.x) / 2
  // Left: medial = rightward = positive deviation from midline
  // Right: medial = leftward = negative x relative to midline
  return side === 'left' ? midX - knee.x : knee.x - midX
}

/** Knee-toe alignment: positive = knee past toe */
export function kneeToeDeviation(lms: PoseLandmark[], side: 'left' | 'right'): number {
  const knee = lms[side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE]
  const foot = lms[side === 'left' ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX]
  // In frontal view: knee.x should not exceed foot.x range laterally
  // More reliable: knee.z - foot.z (depth) but z is noisy, use y as proxy for sagittal lean
  return 0 // placeholder — see squat-specific detection
}

/**
 * Hip alignment relative to plank line (shoulder → ankle).
 * Returns positive if hips are sagging below line, negative if piked above.
 */
export function plankHipDeviation(lms: PoseLandmark[]): number {
  const shoulder = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  const ankle = midpoint(lms[LANDMARKS.LEFT_ANKLE], lms[LANDMARKS.RIGHT_ANKLE])
  const hip = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  // Linear interpolation of y along the shoulder-ankle line at hip's x position
  const t = (hip.x - shoulder.x) / (ankle.x - shoulder.x || 0.001)
  const lineY = shoulder.y + t * (ankle.y - shoulder.y)
  return hip.y - lineY // positive = below line = sag, negative = above line = pike
}

/** Head-forward posture: how far nose is ahead (larger z) of shoulders */
export function headForwardDeviation(lms: PoseLandmark[]): number {
  const nose = lms[LANDMARKS.NOSE]
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  // Use x deviation in frontal view as proxy
  return Math.abs(nose.x - sMid.x) * 2
}

/** Shoulder height asymmetry */
export function shoulderAsymmetry(lms: PoseLandmark[]): number {
  return Math.abs(lms[LANDMARKS.LEFT_SHOULDER].y - lms[LANDMARKS.RIGHT_SHOULDER].y)
}

/** Lateral symmetry: angle difference between left and right knees */
export function lateralSymmetry(lms: PoseLandmark[]): number {
  const lK = kneeAngle(lms, 'left')
  const rK = kneeAngle(lms, 'right')
  const lH = hipAngle(lms, 'left')
  const rH = hipAngle(lms, 'right')
  return (Math.abs(lK - rK) + Math.abs(lH - rH)) / 2
}

/** Minimum knee angle across both sides (used for stiff landing detection) */
export function minKneeAngle(lms: PoseLandmark[]): number {
  return Math.min(kneeAngle(lms, 'left'), kneeAngle(lms, 'right'))
}

/** Hip depth relative to knee — positive = hip below knee (good squat depth) */
export function squatDepthDelta(lms: PoseLandmark[]): number {
  const hipMidY = (lms[LANDMARKS.LEFT_HIP].y + lms[LANDMARKS.RIGHT_HIP].y) / 2
  const kneeMidY = (lms[LANDMARKS.LEFT_KNEE].y + lms[LANDMARKS.RIGHT_KNEE].y) / 2
  return hipMidY - kneeMidY // positive = hip is lower (y increases downward in image) = good depth
}

/** Spine angle estimate: shoulder-to-hip angle from vertical */
export function spineAngle(lms: PoseLandmark[]): number {
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  const hMid = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  return angleFromVertical(hMid, sMid)
}

/** Lumbar hyperextension proxy: pelvis-shoulder alignment (x-axis lean in frontal view) */
export function lumbarExtensionProxy(lms: PoseLandmark[]): number {
  const hMid = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  // Positive = shoulders behind hips (extension pattern)
  return hMid.z - sMid.z
}

/** Pelvic tilt proxy: difference between hip y and knee y normalized to torso height */
export function anteriorPelvicTilt(lms: PoseLandmark[]): number {
  // In frontal view: if hip is significantly higher than neutral relative to knees
  const hMid = midpoint(lms[LANDMARKS.LEFT_HIP], lms[LANDMARKS.RIGHT_HIP])
  const kMid = midpoint(lms[LANDMARKS.LEFT_KNEE], lms[LANDMARKS.RIGHT_KNEE])
  const sMid = midpoint(lms[LANDMARKS.LEFT_SHOULDER], lms[LANDMARKS.RIGHT_SHOULDER])
  const torsoHeight = Math.abs(sMid.y - hMid.y)
  const thighLen = Math.abs(hMid.y - kMid.y)
  if (torsoHeight === 0) return 0
  // Ratio: if thigh is short relative to torso = anterior tilt proxy
  return Math.max(0, 1 - thighLen / torsoHeight) * 10
}
