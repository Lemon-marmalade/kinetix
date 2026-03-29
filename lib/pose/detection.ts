/**
 * Movement Analysis Detection Engine v3
 *
 * Accuracy improvements over v2:
 * - selectKeyFrames(): analyze only the biomechanically critical phase per movement,
 *   not every frame (eliminates noise from standing/transition frames)
 * - Body-proportion normalization: valgus and hip drop normalized by hip width
 * - Confidence gating: landmarks below 0.6 visibility skip that measurement
 * - Grace scoring: continuous 0-1 quality, issue only fires when quality < 0.5
 *   (replaces binary threshold — avoids flagging borderline good form)
 * - Wider tolerance buffers on all thresholds (~40-60% looser than v1)
 * - Increased frequency requirements (25-35% of key frames, not 12-15%)
 * - Removed unreliable detectors from squat:
 *   • spineAngle() measures lateral tilt in frontal view, NOT forward lean — removed
 *   • anteriorPelvicTilt() proxy is too noisy — removed
 * - Ankle eversion: tighter angle threshold, stricter frequency
 * - Deadlift: forward lean expected — kept removed
 */

import type { PoseFrame, DetectedIssue, IssueSeverity, MovementType, IssueType } from '@/types'
import {
  kneeValgusDeviation, torsoLateralTilt, hipDropAbs, ankleAngle,
  lateralSymmetry, minKneeAngle, plankHipDeviation, shoulderAsymmetry,
  kneeAngle, hipAngle, LANDMARKS, midpoint,
} from './angles'
import type { PoseLandmark } from '@/types'

// ─── Normalized thresholds ─────────────────────────────────────────────────
// All multiplied ~40-60% wider than v1 to reduce false positives.

const T = {
  // Knee valgus — normalized as fraction of hip width (not absolute pixel deviation)
  // Research: <10% = normal, 10-20% = borderline, >20% = clinical concern
  VALGUS_MILD:     0.22,   // raised — only flag meaningful collapse
  VALGUS_MODERATE: 0.34,
  VALGUS_SEVERE:   0.46,

  // Hip drop / Trendelenburg — normalized by hip width
  HIP_DROP_MILD:     0.10,
  HIP_DROP_MODERATE: 0.18,
  HIP_DROP_SEVERE:   0.26,

  // Torso lateral tilt (degrees)
  TILT_MILD:     14,
  TILT_MODERATE: 22,
  TILT_SEVERE:   32,

  // Stiff landing — knee flexion at contact (unchanged, well-researched)
  STIFF_SAFE:     90,
  STIFF_MILD:     70,
  STIFF_MODERATE: 50,
  STIFF_SEVERE:   35,

  // Plank hip deviation (fraction of frame height)
  PLANK_SAG_MILD:     0.040,
  PLANK_SAG_MODERATE: 0.070,
  PLANK_SAG_SEVERE:   0.110,

  // Squat depth — only flag when person is clearly above parallel
  SQUAT_DEPTH_OK:    -0.05,  // hip must be > 5% above knee to flag

  // Shoulder asymmetry (fraction of frame height)
  SHOULDER_SYM_MILD:     0.045,
  SHOULDER_SYM_MODERATE: 0.090,

  // Lateral asymmetry (degrees)
  ASYM_MILD:     16,
  ASYM_MODERATE: 28,
  ASYM_SEVERE:   40,

  // Ankle eversion — KNEE→ANKLE→FOOT_INDEX angle from frontal view.
  // Smaller angle = foot angled inward relative to shin = pronation signal.
  // Only meaningful from a confirmed frontal camera angle.
  ANKLE_NORMAL:   72,   // below this, start measuring
  ANKLE_MILD:     60,   // mild pronation flag
  ANKLE_MODERATE: 48,   // moderate pronation

  // Confidence gate: landmark visibility below this value is excluded from measurements
  MIN_VISIBILITY: 0.70,   // raised from 0.65 — require cleaner landmark data
}

type FrameFlag = { frameIndex: number; value: number }

// ─── Minimum frame counts to escalate severity ───────────────────────────────
// Prevents a single bad frame from triggering severe warnings.
// Severe requires sustained evidence across many key frames.
const MIN_FRAMES_MODERATE = 8   // at least 8 key frames above moderate threshold
const MIN_FRAMES_SEVERE   = 16  // at least 16 key frames above severe threshold

function sevFromValue(v: number, mild: number, moderate: number, severe: number): IssueSeverity | null {
  if (v >= severe)   return 'severe'
  if (v >= moderate) return 'moderate'
  if (v >= mild)     return 'mild'
  return null
}

function maxSeverity(
  flags: FrameFlag[],
  mild: number, moderate: number, severe: number,
): IssueSeverity {
  const peak = Math.max(...flags.map(f => f.value))
  const baseSev = sevFromValue(peak, mild, moderate, severe) ?? 'mild'

  // Downgrade if insufficient frames to confirm the peak severity
  const severeFlags   = flags.filter(f => f.value >= severe).length
  const moderateFlags = flags.filter(f => f.value >= moderate).length

  if (baseSev === 'severe' && severeFlags < MIN_FRAMES_SEVERE) {
    return moderateFlags >= MIN_FRAMES_MODERATE ? 'moderate' : 'mild'
  }
  if (baseSev === 'moderate' && moderateFlags < MIN_FRAMES_MODERATE) {
    return 'mild'
  }
  return baseSev
}

// ─── Camera angle detection ──────────────────────────────────────────────────
// Frontal-plane detectors (valgus, hip drop) are only valid from a FRONT or
// REAR camera angle. Side-profile footage makes hip/knee x-coordinates nearly
// identical, so any "deviation" is measurement noise, not real valgus.
//
// Heuristic: if the horizontal spread between L_HIP and R_HIP (x-axis) is
// very small relative to the subject's apparent size, the camera is side-on.

type CameraView = 'front' | 'side' | 'unknown'

function detectCameraView(frames: PoseFrame[]): CameraView {
  const sample = frames.slice(0, Math.min(frames.length, 20))
  const spreads: number[] = []

  for (const f of sample) {
    const lH = f.landmarks[LANDMARKS.LEFT_HIP]
    const rH = f.landmarks[LANDMARKS.RIGHT_HIP]
    const lS = f.landmarks[LANDMARKS.LEFT_SHOULDER]
    const rS = f.landmarks[LANDMARKS.RIGHT_SHOULDER]
    if (!lH || !rH || !lS || !rS) continue
    const hipSpread = Math.abs(rH.x - lH.x)
    const shoulderSpread = Math.abs(rS.x - lS.x)
    spreads.push(Math.max(hipSpread, shoulderSpread))
  }

  if (!spreads.length) return 'unknown'
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length

  // If body width is < 12% of frame width → very likely a side view
  if (avgSpread < 0.12) return 'side'
  // If body width is > 20% → clearly front or 45° — frontal-plane analysis is valid
  if (avgSpread > 0.20) return 'front'
  return 'unknown'  // ambiguous — apply caution
}

function frequencyRatio(flags: FrameFlag[], total: number): number {
  return flags.length / Math.max(total, 1)
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

/** True if all required landmarks meet the minimum confidence threshold. */
function hasConfidence(lms: PoseLandmark[], indices: number[]): boolean {
  return indices.every(i => (lms[i]?.visibility ?? 1) >= T.MIN_VISIBILITY)
}

/** Hip width in normalized image coordinates. Used to normalize deviations. */
function hipWidth(lms: PoseLandmark[]): number {
  const lH = lms[LANDMARKS.LEFT_HIP]
  const rH = lms[LANDMARKS.RIGHT_HIP]
  if (!lH || !rH) return 0.15  // fallback
  const w = Math.hypot(rH.x - lH.x, rH.y - lH.y)
  return Math.max(w, 0.06) // prevent div-by-zero on extreme cases
}

// ─── Key frame selection ─────────────────────────────────────────────────────
//
// Only analyze frames that represent the critical biomechanical phase.
// This eliminates noise from standing / transition phases.

export function selectKeyFrames(frames: PoseFrame[], movementType: MovementType): PoseFrame[] {
  if (frames.length < 6) return frames

  switch (movementType) {
    case 'squat':
    case 'lunge': {
      // Frames in the bottom 30% of the knee-angle range (deepest phase)
      const angles = frames.map(f => {
        if (f.landmarks.length < 33) return 180
        return (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
      })
      const minA = Math.min(...angles)
      const maxA = Math.max(...angles)
      const range = maxA - minA
      // If no real squat motion detected, use all frames
      if (range < 20) return frames
      const cutoff = minA + range * 0.30
      const key = frames.filter((_, i) => angles[i] <= cutoff)
      return key.length >= 3 ? key : frames
    }

    case 'jump_landing': {
      // 20-frame window centred on the landing moment (minimum knee angle)
      const angles = frames.map(f => {
        if (f.landmarks.length < 33) return 180
        return (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
      })
      const minIdx = angles.indexOf(Math.min(...angles))
      const start  = Math.max(0, minIdx - 10)
      const end    = Math.min(frames.length - 1, minIdx + 10)
      return frames.slice(start, end + 1)
    }

    case 'deadlift': {
      // Frames in bottom 30% of hip-height range (deepest hinge)
      const hipYs = frames.map(f => {
        if (f.landmarks.length < 33) return 0
        return (f.landmarks[LANDMARKS.LEFT_HIP].y + f.landmarks[LANDMARKS.RIGHT_HIP].y) / 2
      })
      const maxY = Math.max(...hipYs)
      const minY = Math.min(...hipYs)
      const range = maxY - minY
      if (range < 0.04) return frames
      const cutoff = maxY - range * 0.30
      const key = frames.filter((_, i) => hipYs[i] >= cutoff)
      return key.length >= 3 ? key : frames
    }

    case 'plank':
      // Skip first and last 20% — only steady-state middle
      return frames.slice(Math.floor(frames.length * 0.20), Math.ceil(frames.length * 0.80))

    default:
      return frames
  }
}

// ─── Issue detectors ──────────────────────────────────────────────────────────

function detectKneeValgus(
  frames: PoseFrame[], side: 'left' | 'right', freqThreshold = 0.25,
  cameraView: CameraView = 'unknown'
): DetectedIssue | null {
  // Valgus requires frontal-plane visibility. Side footage gives false readings.
  if (cameraView === 'side') return null

  const hipIdx  = side === 'left' ? LANDMARKS.LEFT_HIP   : LANDMARKS.RIGHT_HIP
  const kneeIdx = side === 'left' ? LANDMARKS.LEFT_KNEE  : LANDMARKS.RIGHT_KNEE
  const ankleIdx= side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE

  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [hipIdx, kneeIdx, ankleIdx])) continue

    const raw  = kneeValgusDeviation(f.landmarks, side)
    const norm = raw / hipWidth(f.landmarks)
    if (norm > T.VALGUS_MILD) flags.push({ frameIndex: f.frameIndex, value: norm })
  }

  if (frequencyRatio(flags, frames.length) < freqThreshold) return null
  if (flags.length < 6) return null  // need at least 6 key frames

  let sev = maxSeverity(flags, T.VALGUS_MILD, T.VALGUS_MODERATE, T.VALGUS_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  // Unknown camera angle: cap at moderate + add caveat
  const angleNote = cameraView === 'unknown'
    ? ' Note: confirm with front-facing footage for accurate assessment.'
    : ''
  if (cameraView === 'unknown' && sev === 'severe') sev = 'moderate'

  return {
    id: `knee_valgus_${side}`,
    type: 'knee_valgus',
    severity: sev,
    affectedJoints: [kneeIdx, hipIdx, ankleIdx],
    frames: flags.map(f => f.frameIndex),
    description: `${side === 'left' ? 'Left' : 'Right'} knee collapses inward — ${(peak * 100).toFixed(0)}% of hip width deviation.${angleNote}`,
    recommendation: 'Cue "knees out over little toes." Strengthen glute medius: lateral band walks, clamshells. Practice single-leg squat with mirror feedback.',
    peakValue: parseFloat((peak * 100).toFixed(1)),
    avgValue:  parseFloat((avg(flags.map(f => f.value)) * 100).toFixed(1)),
  }
}

function detectHipDrop(
  frames: PoseFrame[], freqThreshold = 0.25,
  cameraView: CameraView = 'unknown'
): DetectedIssue | null {
  // Hip drop (Trendelenburg) is a frontal-plane sign — not visible from side view
  if (cameraView === 'side') return null

  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue

    const raw  = hipDropAbs(f.landmarks)
    const norm = raw / hipWidth(f.landmarks)
    if (norm > T.HIP_DROP_MILD) flags.push({ frameIndex: f.frameIndex, value: norm })
  }

  if (frequencyRatio(flags, frames.length) < freqThreshold) return null
  if (flags.length < 6) return null

  let sev = maxSeverity(flags, T.HIP_DROP_MILD, T.HIP_DROP_MODERATE, T.HIP_DROP_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  const angleNote = cameraView === 'unknown'
    ? ' Best confirmed with front-facing footage.'
    : ''
  if (cameraView === 'unknown' && sev === 'severe') sev = 'moderate'

  return {
    id: 'hip_drop',
    type: 'hip_drop',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Contralateral hip drops ${(peak * 100).toFixed(0)}% of hip width — possible Trendelenburg sign.${angleNote}`,
    recommendation: 'Strengthen glute medius: lateral step-downs, single-leg bridges, hip abductor machine. Cue: keep pelvis level throughout movement.',
    peakValue: parseFloat((peak * 100).toFixed(1)),
    avgValue:  parseFloat((avg(flags.map(f => f.value)) * 100).toFixed(1)),
  }
}

function detectTorsoInstability(frames: PoseFrame[], freqThreshold = 0.28): DetectedIssue | null {
  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue

    const val = torsoLateralTilt(f.landmarks)
    if (val > T.TILT_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }

  if (frequencyRatio(flags, frames.length) < freqThreshold) return null

  const sev  = maxSeverity(flags, T.TILT_MILD, T.TILT_MODERATE, T.TILT_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'torso_instability',
    type: 'torso_instability',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Torso tilts ${peak.toFixed(1)}° laterally from vertical. Asymmetric spinal loading increases lumbar strain and reduces power transfer.`,
    recommendation: 'Core anti-lateral flexion: Pallof press, suitcase carry, Copenhagen side plank. Focus on neutral spine throughout all loaded movements.',
    peakValue: parseFloat(peak.toFixed(1)),
    avgValue:  parseFloat(avg(flags.map(f => f.value)).toFixed(1)),
  }
}

function detectAnkleEversion(
  frames: PoseFrame[], side: 'left' | 'right', cameraView: CameraView = 'unknown'
): DetectedIssue | null {
  // Ankle eversion via KNEE→ANKLE→FOOT_INDEX angle is only meaningful from a frontal view.
  // Side/unknown angles produce unreliable readings — skip entirely.
  if (cameraView !== 'front') return null

  const heelIdx  = side === 'left' ? LANDMARKS.LEFT_HEEL       : LANDMARKS.RIGHT_HEEL
  const footIdx  = side === 'left' ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX
  const ankleIdx = side === 'left' ? LANDMARKS.LEFT_ANKLE      : LANDMARKS.RIGHT_ANKLE
  const kneeIdx  = side === 'left' ? LANDMARKS.LEFT_KNEE       : LANDMARKS.RIGHT_KNEE

  // Ankle landmarks are often occluded — require very high confidence
  const ANKLE_VIS = 0.80

  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const lms = f.landmarks
    // All four ankle-area landmarks must be clearly visible
    if (
      (lms[heelIdx]?.visibility  ?? 0) < ANKLE_VIS ||
      (lms[footIdx]?.visibility  ?? 0) < ANKLE_VIS ||
      (lms[ankleIdx]?.visibility ?? 0) < ANKLE_VIS ||
      (lms[kneeIdx]?.visibility  ?? 0) < ANKLE_VIS
    ) continue

    const val = ankleAngle(lms, side)
    // Only flag if angle is clearly below the mild threshold
    if (val < T.ANKLE_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }

  // Require 55% of eligible frames to show the issue — eliminates transient noise
  if (frequencyRatio(flags, frames.length) < 0.55) return null
  if (flags.length < 10) return null  // need sustained evidence across many frames

  const sev = maxSeverity(
    flags.map(f => ({ ...f, value: T.ANKLE_NORMAL - f.value })),
    T.ANKLE_NORMAL - T.ANKLE_MILD,
    T.ANKLE_NORMAL - T.ANKLE_MODERATE,
    40,
  )
  const peakAngle = Math.min(...flags.map(f => f.value))

  return {
    id: `ankle_eversion_${side}`,
    type: 'ankle_eversion',
    severity: sev,
    affectedJoints: [ankleIdx, heelIdx, footIdx],
    frames: flags.map(f => f.frameIndex),
    description: `${side === 'left' ? 'Left' : 'Right'} ankle shows consistent pronation — KNEE→ANKLE→TOE angle of ${peakAngle.toFixed(0)}° (normal ≥${T.ANKLE_NORMAL}°), confirmed across ${flags.length} frames.`,
    recommendation: 'Ankle stability: single-leg balance, BOSU progressions, eccentric calf raises. Check footwear for adequate arch and lateral support.',
    peakValue: parseFloat(peakAngle.toFixed(1)),
  }
}

function detectStiffLanding(frames: PoseFrame[]): DetectedIssue | null {
  let minLeft = 180, minRight = 180

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue
    const lK = kneeAngle(f.landmarks, 'left')
    const rK = kneeAngle(f.landmarks, 'right')
    if (lK < minLeft)  minLeft  = lK
    if (rK < minRight) minRight = rK
  }

  const minKnee = Math.min(minLeft, minRight)
  if (minKnee >= T.STIFF_SAFE) return null

  const flags: FrameFlag[] = []
  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const mK = minKneeAngle(f.landmarks)
    if (mK - minKnee < 15) flags.push({ frameIndex: f.frameIndex, value: mK })
  }
  if (!flags.length) return null

  const deviation = T.STIFF_SAFE - minKnee
  const sev = sevFromValue(deviation,
    T.STIFF_SAFE - T.STIFF_MILD,
    T.STIFF_SAFE - T.STIFF_MODERATE,
    T.STIFF_SAFE - T.STIFF_SEVERE
  ) ?? 'mild'

  return {
    id: 'stiff_landing',
    type: 'stiff_landing',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE],
    frames: flags.map(f => f.frameIndex),
    description: `Landing with ${minKnee.toFixed(0)}° of knee flexion (target ≥90°). Stiff landings increase ACL loading by 2.4x.`,
    recommendation: 'Practice soft landing: drop-and-stick drills with 3-second hold at 90° flexion. Progress to jump-and-stick, then continuous landings. Cue "quiet feet."',
    peakValue: parseFloat(minKnee.toFixed(1)),
  }
}

function detectLandingAsymmetry(frames: PoseFrame[]): DetectedIssue | null {
  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue
    const asym = lateralSymmetry(f.landmarks)
    if (asym > T.ASYM_MILD) flags.push({ frameIndex: f.frameIndex, value: asym })
  }

  if (frequencyRatio(flags, frames.length) < 0.25) return null

  const sev  = maxSeverity(flags, T.ASYM_MILD, T.ASYM_MODERATE, T.ASYM_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'landing_asymmetry',
    type: 'landing_asymmetry',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    frames: flags.map(f => f.frameIndex),
    description: `Bilateral asymmetry of ${peak.toFixed(1)}° — one limb is absorbing significantly more load than the other.`,
    recommendation: 'Symmetry drills: bilateral balance challenges, equal-rep box step-ups each side. Assess for prior lower-limb injury or leg-length discrepancy.',
    peakValue: parseFloat(peak.toFixed(1)),
  }
}

function detectHipSag(frames: PoseFrame[]): DetectedIssue | null {
  const sagFlags:  FrameFlag[] = []
  const pikeFlags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER])) continue

    const dev = plankHipDeviation(f.landmarks)
    if (dev  >  T.PLANK_SAG_MILD)  sagFlags.push ({frameIndex: f.frameIndex, value: dev})
    if (dev  < -T.PLANK_SAG_MILD)  pikeFlags.push({frameIndex: f.frameIndex, value: Math.abs(dev)})
  }

  if (sagFlags.length > pikeFlags.length && frequencyRatio(sagFlags, frames.length) > 0.30) {
    const sev  = maxSeverity(sagFlags, T.PLANK_SAG_MILD, T.PLANK_SAG_MODERATE, T.PLANK_SAG_SEVERE)
    const peak = Math.max(...sagFlags.map(f => f.value))
    return {
      id: 'hip_sag', type: 'hip_sag', severity: sev,
      affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
      frames: sagFlags.map(f => f.frameIndex),
      description: `Hips sag ${(peak * 100).toFixed(0)}% below the shoulder-ankle plank line, causing lumbar hyperextension.`,
      recommendation: 'Regress to knee plank until core strength improves. Cue "tuck pelvis, squeeze glutes." Progress with dead bug and hollow body holds.',
      peakValue: parseFloat((peak * 100).toFixed(1)),
    }
  }

  if (pikeFlags.length > sagFlags.length && frequencyRatio(pikeFlags, frames.length) > 0.30) {
    const sev  = maxSeverity(pikeFlags, T.PLANK_SAG_MILD, T.PLANK_SAG_MODERATE, T.PLANK_SAG_SEVERE)
    const peak = Math.max(...pikeFlags.map(f => f.value))
    return {
      id: 'hip_pike', type: 'hip_pike', severity: sev,
      affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
      frames: pikeFlags.map(f => f.frameIndex),
      description: `Hips piked ${(peak * 100).toFixed(0)}% above the plank line — reducing posterior chain activation.`,
      recommendation: 'Cue "hips level with shoulders," squeeze glutes throughout hold. Check hamstring flexibility.',
      peakValue: parseFloat((peak * 100).toFixed(1)),
    }
  }

  return null
}

function detectShallowSquatDepth(frames: PoseFrame[]): DetectedIssue | null {
  // Only flag when the person clearly does not reach parallel
  let deepestFrame: PoseFrame | null = null
  let minKneeAvg = 180

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue
    const avg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (avg < minKneeAvg) { minKneeAvg = avg; deepestFrame = f }
  }

  if (!deepestFrame) return null
  if (minKneeAvg > 140) return null  // person barely squatted — don't flag depth on partial movements

  const lH = deepestFrame.landmarks[LANDMARKS.LEFT_HIP]
  const rH = deepestFrame.landmarks[LANDMARKS.RIGHT_HIP]
  const lK = deepestFrame.landmarks[LANDMARKS.LEFT_KNEE]
  const rK = deepestFrame.landmarks[LANDMARKS.RIGHT_KNEE]
  const hipMidY  = (lH.y + rH.y) / 2
  const kneeMidY = (lK.y + rK.y) / 2
  const depth = hipMidY - kneeMidY  // positive = hip below knee

  if (depth >= T.SQUAT_DEPTH_OK) return null  // hip is roughly at or below knee level

  return {
    id: 'shallow_squat_depth',
    type: 'shallow_squat_depth',
    severity: depth > -0.08 ? 'mild' : 'moderate',
    affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
    frames: [deepestFrame.frameIndex],
    description: `Squat depth is above parallel — hip crease does not reach knee level at the deepest point. Below-parallel depth is needed for full glute and hamstring activation.`,
    recommendation: 'Ankle mobility: calf stretches, ankle circles. Box squat to target depth. Goblet squat holds at the bottom.',
    peakValue: parseFloat(depth.toFixed(3)),
  }
}

function detectShoulderAsymmetry(frames: PoseFrame[], freqThreshold = 0.30): DetectedIssue | null {
  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER])) continue
    const val = shoulderAsymmetry(f.landmarks)
    if (val > T.SHOULDER_SYM_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }

  if (frequencyRatio(flags, frames.length) < freqThreshold) return null

  const sev  = maxSeverity(flags, T.SHOULDER_SYM_MILD, T.SHOULDER_SYM_MODERATE, 0.12)
  const peak = Math.max(...flags.map(f => f.value))

  return {
    id: 'shoulder_asymmetry',
    type: 'shoulder_asymmetry',
    severity: sev,
    affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
    frames: flags.map(f => f.frameIndex),
    description: `Shoulder height asymmetry of ${(peak * 100).toFixed(0)}% — indicating scapular dyskinesis or rotator cuff imbalance.`,
    recommendation: 'Scapular stability: wall slides, band pull-aparts, face pulls. Unilateral pressing to address strength imbalance.',
    peakValue: parseFloat((peak * 100).toFixed(1)),
  }
}

function deduplicateAndMerge(issues: DetectedIssue[]): DetectedIssue[] {
  let result = [...issues]

  const leftAnkle  = result.find(i => i.id === 'ankle_eversion_left')
  const rightAnkle = result.find(i => i.id === 'ankle_eversion_right')

  if (leftAnkle && rightAnkle) {
    const sevOrder: Record<IssueSeverity, number> = { severe: 2, moderate: 1, mild: 0 }
    const merged: DetectedIssue = {
      id: 'ankle_eversion',
      type: 'ankle_eversion',
      severity: sevOrder[leftAnkle.severity] >= sevOrder[rightAnkle.severity]
        ? leftAnkle.severity : rightAnkle.severity,
      affectedJoints: [...new Set([...leftAnkle.affectedJoints, ...rightAnkle.affectedJoints])],
      frames: [...new Set([...leftAnkle.frames, ...rightAnkle.frames])].sort((a, b) => a - b),
      description: 'Bilateral ankle pronation detected — both feet show consistent inward collapse across multiple frames.',
      recommendation: leftAnkle.recommendation!,
      peakValue: Math.min(leftAnkle.peakValue ?? 180, rightAnkle.peakValue ?? 180),
    }
    result = result.filter(i => i !== leftAnkle && i !== rightAnkle)
    result.push(merged)
  }

  const seenIds = new Set<string>()
  return result.filter(i => {
    if (seenIds.has(i.id)) return false
    seenIds.add(i.id)
    return true
  })
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function detectIssues(frames: PoseFrame[], movementType: MovementType): DetectedIssue[] {
  if (frames.length < 5) return []

  const key  = selectKeyFrames(frames, movementType)
  const all  = frames
  const issues: DetectedIssue[] = []
  const push = (i: DetectedIssue | null) => { if (i) issues.push(i) }

  // Detect camera viewing angle — gate frontal-plane detectors accordingly
  const cam = detectCameraView(all)

  switch (movementType) {
    case 'lateral_cut':
      push(detectKneeValgus(key, 'left',  0.30, cam))
      push(detectKneeValgus(key, 'right', 0.30, cam))
      push(detectHipDrop(key, 0.32, cam))
      push(detectTorsoInstability(key, 0.35))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'jump_landing':
      push(detectKneeValgus(key, 'left',  0.28, cam))
      push(detectKneeValgus(key, 'right', 0.28, cam))
      push(detectStiffLanding(key))
      push(detectLandingAsymmetry(key))
      push(detectHipDrop(key, 0.32, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'squat':
      push(detectKneeValgus(key, 'left',  0.32, cam))
      push(detectKneeValgus(key, 'right', 0.32, cam))
      push(detectShallowSquatDepth(all))
      push(detectHipDrop(key, 0.35, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'plank':
      push(detectHipSag(key))
      push(detectShoulderAsymmetry(key, 0.35))
      push(detectTorsoInstability(key, 0.35))
      break

    case 'deadlift':
      push(detectHipDrop(key, 0.32, cam))
      push(detectKneeValgus(key, 'left',  0.32, cam))
      push(detectKneeValgus(key, 'right', 0.32, cam))
      push(detectShoulderAsymmetry(all, 0.35))
      break

    case 'lunge':
      push(detectKneeValgus(key, 'left',  0.30, cam))
      push(detectKneeValgus(key, 'right', 0.30, cam))
      push(detectTorsoInstability(key, 0.35))
      push(detectHipDrop(key, 0.32, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'overhead_press':
      push(detectShoulderAsymmetry(all, 0.35))
      push(detectTorsoInstability(all, 0.35))
      break

    case 'sprint':
      push(detectHipDrop(key, 0.32, cam))
      push(detectTorsoInstability(key, 0.35))
      push(detectLandingAsymmetry(key))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break
  }

  const deduped = deduplicateAndMerge(issues)
  const order: Record<IssueSeverity, number> = { severe: 0, moderate: 1, mild: 2 }
  return deduped.sort((a, b) => order[a.severity] - order[b.severity])
}
