import type { PoseLandmark } from '@/types'
import { kneeAngle, hipAngle, LANDMARKS } from './angles'

export type MovementPhase = 'top' | 'descending' | 'bottom' | 'ascending'

export interface RepCounterState {
  repCount: number
  phase: MovementPhase
  currentDepth: number   // 0-100, 100 = full depth
  lastRepTimestamp: number
  repHistory: RepRecord[]
}

export interface RepRecord {
  repNumber: number
  timestamp: number
  minKneeAngle: number   // smaller = deeper
  depthScore: number     // 0-100
}

// Movement-specific thresholds
const THRESHOLDS: Partial<Record<string, { downAngle: number; upAngle: number; depthTarget: number }>> = {
  squat:       { downAngle: 105, upAngle: 155, depthTarget: 90  },  // 90° = parallel
  lunge:       { downAngle: 100, upAngle: 155, depthTarget: 90  },
  jump_landing:{ downAngle: 100, upAngle: 150, depthTarget: 80  },
  deadlift:    { downAngle: 80,  upAngle: 160, depthTarget: 130 },  // hip angle
}

function getJointAngle(lms: PoseLandmark[], movement: string): number {
  if (movement === 'deadlift') {
    return (hipAngle(lms, 'left') + hipAngle(lms, 'right')) / 2
  }
  const l = lms[LANDMARKS.LEFT_KNEE]
  const r = lms[LANDMARKS.RIGHT_KNEE]
  if (!l || !r) return 180
  // Use the side with better visibility
  const lVis = l.visibility ?? 0
  const rVis = r.visibility ?? 0
  if (lVis > rVis + 0.1) return kneeAngle(lms, 'left')
  if (rVis > lVis + 0.1) return kneeAngle(lms, 'right')
  return (kneeAngle(lms, 'left') + kneeAngle(lms, 'right')) / 2
}

export function createRepCounter(movement: string): {
  state: RepCounterState
  update: (lms: PoseLandmark[], timestamp: number) => RepCounterState
} {
  const thresh = THRESHOLDS[movement] ?? { downAngle: 110, upAngle: 155, depthTarget: 90 }

  const state: RepCounterState = {
    repCount: 0,
    phase: 'top',
    currentDepth: 0,
    lastRepTimestamp: 0,
    repHistory: [],
  }

  let minAngleThisRep = 180

  const update = (lms: PoseLandmark[], timestamp: number): RepCounterState => {
    if (!lms || lms.length < 33) return state

    const angle = getJointAngle(lms, movement)

    // Track deepest angle this rep
    if (angle < minAngleThisRep) minAngleThisRep = angle

    // Depth score: how close to target depth (e.g. 90° for squat)
    const totalRange = thresh.upAngle - thresh.downAngle
    const currentDepth = Math.min(100, Math.max(0,
      ((thresh.upAngle - angle) / totalRange) * 100
    ))
    state.currentDepth = Math.round(currentDepth)

    // State machine
    switch (state.phase) {
      case 'top':
        if (angle < thresh.upAngle - 15) {
          state.phase = 'descending'
          minAngleThisRep = angle
        }
        break

      case 'descending':
        if (angle < thresh.downAngle) {
          state.phase = 'bottom'
        } else if (angle > thresh.upAngle - 10) {
          // Went back up without reaching depth
          state.phase = 'top'
          minAngleThisRep = 180
        }
        break

      case 'bottom':
        if (angle > thresh.downAngle + 15) {
          state.phase = 'ascending'
        }
        break

      case 'ascending':
        if (angle >= thresh.upAngle) {
          // Completed rep
          state.repCount++
          const depthScore = Math.min(100, Math.max(0,
            ((thresh.upAngle - minAngleThisRep) / totalRange) * 100
          ))
          state.repHistory.push({
            repNumber: state.repCount,
            timestamp,
            minKneeAngle: minAngleThisRep,
            depthScore: Math.round(depthScore),
          })
          state.lastRepTimestamp = timestamp
          state.phase = 'top'
          minAngleThisRep = 180
        } else if (angle < thresh.downAngle + 5) {
          // Went back down (bounce)
          state.phase = 'bottom'
        }
        break
    }

    return { ...state }
  }

  return { state, update }
}

export function getDepthCue(movement: string, depth: number): string | null {
  if (movement !== 'squat' && movement !== 'lunge') return null
  if (depth < 30) return 'Go deeper — aim for parallel'
  if (depth < 60) return 'Halfway there, keep descending'
  if (depth >= 85) return 'Good depth!'
  return null
}
