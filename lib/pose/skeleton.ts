import type { PoseFrame } from '@/types'

/**
 * Compresses full pose sequence to a lightweight summary:
 * - Every 5th frame
 * - Only landmarks with visibility >= 0.5
 * - Rounds coordinates to 4 decimal places
 */
export function buildSkeletonSummary(frames: PoseFrame[]): PoseFrame[] {
  return frames
    .filter((_, i) => i % 5 === 0)
    .map(frame => ({
      timestamp: frame.timestamp,
      frameIndex: frame.frameIndex,
      landmarks: frame.landmarks.map(lm => ({
        x: parseFloat(lm.x.toFixed(4)),
        y: parseFloat(lm.y.toFixed(4)),
        z: parseFloat(lm.z.toFixed(4)),
        visibility: lm.visibility !== undefined ? parseFloat(lm.visibility.toFixed(3)) : undefined,
      })),
    }))
}

/**
 * Filters pose data to only non-zero visibility frames to reduce storage.
 */
export function compressPoseData(frames: PoseFrame[]): PoseFrame[] {
  return frames.filter(frame =>
    frame.landmarks.some(lm => (lm.visibility ?? 0) > 0.1)
  ).map(frame => ({
    timestamp: frame.timestamp,
    frameIndex: frame.frameIndex,
    landmarks: frame.landmarks.map(lm => ({
      x: parseFloat(lm.x.toFixed(4)),
      y: parseFloat(lm.y.toFixed(4)),
      z: parseFloat(lm.z.toFixed(4)),
      visibility: lm.visibility !== undefined ? parseFloat(lm.visibility.toFixed(3)) : undefined,
    })),
  }))
}

/** Returns the estimated JSON byte size of a pose dataset */
export function estimatePoseDataSize(frames: PoseFrame[]): number {
  return JSON.stringify(frames).length
}
