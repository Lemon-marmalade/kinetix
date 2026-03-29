import type { PoseFrame, PoseLandmark } from '@/types'

/**
 * EMA factor: higher = more responsive, lower = more smoothing.
 * 0.65 gives ~35% weight to the prior frame — reduces jitter while
 * keeping effectively <1 frame of positional lag at 20fps (50ms).
 * The old value (0.35) caused ~2-3 frames of lag, visibly displacing
 * the skeleton from the actual body position.
 */
const ALPHA = 0.65

/** Landmarks below this confidence are replaced with the prior frame value to suppress jitter. */
const VISIBILITY_THRESHOLD = 0.5

/**
 * Apply exponential moving average smoothing across a pose frame sequence.
 * Low-confidence keypoints fall back to the previous frame's position, preventing
 * unstable or noisy detections from polluting downstream analysis.
 */
export function smoothPoseFrames(frames: PoseFrame[]): PoseFrame[] {
  if (frames.length === 0) return []

  const smoothed: PoseFrame[] = []
  let prev: PoseLandmark[] = frames[0].landmarks

  for (const frame of frames) {
    const cur = frame.landmarks
    const out: PoseLandmark[] = cur.map((lm, i) => {
      const p = prev[i]
      if (!p) return lm

      // Unreliable keypoint — carry forward previous position to avoid jitter
      if ((lm.visibility ?? 1) < VISIBILITY_THRESHOLD) {
        return { ...p, visibility: lm.visibility }
      }

      return {
        x: ALPHA * lm.x + (1 - ALPHA) * p.x,
        y: ALPHA * lm.y + (1 - ALPHA) * p.y,
        z: ALPHA * lm.z + (1 - ALPHA) * p.z,
        visibility: lm.visibility,
      }
    })

    smoothed.push({ ...frame, landmarks: out })
    prev = out
  }

  return smoothed
}
