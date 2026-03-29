import type { PoseFrame, MovementType } from '@/types'
import { kneeAngle, LANDMARKS } from './angles'

export interface KeyMoment {
  frameIndex: number
  timestamp: number
  type: 'landing' | 'squat_bottom' | 'deadlift_bottom' | 'lunge_bottom' | 'press_top'
  label: string
}

/** Detect biomechanically significant frames for a given movement type. */
export function detectKeyMoments(frames: PoseFrame[], movementType: MovementType): KeyMoment[] {
  if (frames.length < 3) return []
  switch (movementType) {
    case 'jump_landing': return detectLanding(frames)
    case 'squat':        return detectSquatBottom(frames)
    case 'deadlift':     return detectDeadliftBottom(frames)
    case 'lunge':        return detectLungeBottom(frames)
    default:             return []
  }
}

/**
 * Landing frame: the point of maximum bilateral knee flexion after a jump.
 * A real landing is assumed only when the peak knee angle drops below 130°.
 */
function detectLanding(frames: PoseFrame[]): KeyMoment[] {
  let minKnee = 180
  let best: PoseFrame | null = null

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const avg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (avg < minKnee) { minKnee = avg; best = f }
  }

  if (!best || minKnee > 130) return []
  return [{
    frameIndex: best.frameIndex,
    timestamp: best.timestamp,
    type: 'landing',
    label: `Landing — ${minKnee.toFixed(0)}° knee flexion`,
  }]
}

/** Squat bottom: frame with minimum average bilateral knee angle. */
function detectSquatBottom(frames: PoseFrame[]): KeyMoment[] {
  let minKnee = 180
  let best: PoseFrame | null = null

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const avg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (avg < minKnee) { minKnee = avg; best = f }
  }

  if (!best) return []
  return [{
    frameIndex: best.frameIndex,
    timestamp: best.timestamp,
    type: 'squat_bottom',
    label: `Lowest point — ${minKnee.toFixed(0)}° knee angle`,
  }]
}

/** Deadlift bottom: frame where hip centerpoint is at maximum image-y (deepest hinge). */
function detectDeadliftBottom(frames: PoseFrame[]): KeyMoment[] {
  let maxHipY = -1
  let best: PoseFrame | null = null

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const hipY = (f.landmarks[LANDMARKS.LEFT_HIP].y + f.landmarks[LANDMARKS.RIGHT_HIP].y) / 2
    if (hipY > maxHipY) { maxHipY = hipY; best = f }
  }

  if (!best) return []
  return [{
    frameIndex: best.frameIndex,
    timestamp: best.timestamp,
    type: 'deadlift_bottom',
    label: 'Hip hinge — deepest position',
  }]
}

/** Lunge bottom: frame where the front knee reaches minimum angle. */
function detectLungeBottom(frames: PoseFrame[]): KeyMoment[] {
  let minKnee = 180
  let best: PoseFrame | null = null

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const front = Math.min(kneeAngle(f.landmarks, 'left'), kneeAngle(f.landmarks, 'right'))
    if (front < minKnee) { minKnee = front; best = f }
  }

  if (!best) return []
  return [{
    frameIndex: best.frameIndex,
    timestamp: best.timestamp,
    type: 'lunge_bottom',
    label: `Lunge depth — ${minKnee.toFixed(0)}° front knee`,
  }]
}
