import type { PoseFrame, DetectedIssue, IssueSeverity, MovementType, IssueType } from '@/types'
import {
  kneeValgusDeviation, torsoLateralTilt, hipDropAbs, ankleAngle,
  lateralSymmetry, minKneeAngle, plankHipDeviation, shoulderAsymmetry,
  kneeAngle, hipAngle, LANDMARKS, midpoint,
} from './angles'
import type { PoseLandmark } from '@/types'

// ─── Normalized thresholds ─────────────────────────────────────────────────

const T = {
  VALGUS_MILD:     0.09,
  VALGUS_MODERATE: 0.22,
  VALGUS_SEVERE:   0.38,

  HIP_DROP_MILD:     0.06,
  HIP_DROP_MODERATE: 0.14,
  HIP_DROP_SEVERE:   0.24,

  TILT_MILD:     6,
  TILT_MODERATE: 14,
  TILT_SEVERE:   24,

  STIFF_SAFE:     90,
  STIFF_MILD:     70,
  STIFF_MODERATE: 50,
  STIFF_SEVERE:   35,

  PLANK_SAG_MILD:     0.020,
  PLANK_SAG_MODERATE: 0.045,
  PLANK_SAG_SEVERE:   0.080,

  SQUAT_DEPTH_OK:    -0.05,

  SHOULDER_SYM_MILD:     0.025,
  SHOULDER_SYM_MODERATE: 0.055,

  ASYM_MILD:     10,
  ASYM_MODERATE: 20,
  ASYM_SEVERE:   32,

  ANKLE_NORMAL:   72,
  ANKLE_MILD:     60,
  ANKLE_MODERATE: 48,

  MIN_VISIBILITY: 0.60,
}

type FrameFlag = { frameIndex: number; value: number }

// ─── Minimum frame counts to escalate severity ───────────────────────────────
const MIN_FRAMES_MODERATE = 3
const MIN_FRAMES_SEVERE   = 6

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

  if (avgSpread < 0.12) return 'side'
  if (avgSpread > 0.20) return 'front'
  return 'unknown'
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

export function selectKeyFrames(frames: PoseFrame[], movementType: MovementType): PoseFrame[] {
  if (frames.length < 6) return frames

  switch (movementType) {
    case 'squat':
    case 'lunge': {
      const angles = frames.map(f => {
        if (f.landmarks.length < 33) return 180
        return (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
      })
      const minA = Math.min(...angles)
      const maxA = Math.max(...angles)
      const range = maxA - minA
      if (range < 20) return frames
      const cutoff = minA + range * 0.30
      const key = frames.filter((_, i) => angles[i] <= cutoff)
      return key.length >= 3 ? key : frames
    }

    case 'jump_landing': {
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
  if (flags.length < 6) return null

  let sev = maxSeverity(flags, T.VALGUS_MILD, T.VALGUS_MODERATE, T.VALGUS_SEVERE)
  const peak = Math.max(...flags.map(f => f.value))

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
  if (cameraView !== 'front') return null

  const heelIdx  = side === 'left' ? LANDMARKS.LEFT_HEEL       : LANDMARKS.RIGHT_HEEL
  const footIdx  = side === 'left' ? LANDMARKS.LEFT_FOOT_INDEX : LANDMARKS.RIGHT_FOOT_INDEX
  const ankleIdx = side === 'left' ? LANDMARKS.LEFT_ANKLE      : LANDMARKS.RIGHT_ANKLE
  const kneeIdx  = side === 'left' ? LANDMARKS.LEFT_KNEE       : LANDMARKS.RIGHT_KNEE

  const ANKLE_VIS = 0.80

  const flags: FrameFlag[] = []

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    const lms = f.landmarks
    if (
      (lms[heelIdx]?.visibility  ?? 0) < ANKLE_VIS ||
      (lms[footIdx]?.visibility  ?? 0) < ANKLE_VIS ||
      (lms[ankleIdx]?.visibility ?? 0) < ANKLE_VIS ||
      (lms[kneeIdx]?.visibility  ?? 0) < ANKLE_VIS
    ) continue

    const val = ankleAngle(lms, side)
    if (val < T.ANKLE_MILD) flags.push({ frameIndex: f.frameIndex, value: val })
  }

  if (frequencyRatio(flags, frames.length) < 0.55) return null
  if (flags.length < 10) return null

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
  let deepestFrame: PoseFrame | null = null
  let minKneeAvg = 180

  for (const f of frames) {
    if (f.landmarks.length < 33) continue
    if (!hasConfidence(f.landmarks, [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP])) continue
    const avg = (kneeAngle(f.landmarks, 'left') + kneeAngle(f.landmarks, 'right')) / 2
    if (avg < minKneeAvg) { minKneeAvg = avg; deepestFrame = f }
  }

  if (!deepestFrame) return null
  if (minKneeAvg > 140) return null

  const lH = deepestFrame.landmarks[LANDMARKS.LEFT_HIP]
  const rH = deepestFrame.landmarks[LANDMARKS.RIGHT_HIP]
  const lK = deepestFrame.landmarks[LANDMARKS.LEFT_KNEE]
  const rK = deepestFrame.landmarks[LANDMARKS.RIGHT_KNEE]
  const hipMidY  = (lH.y + rH.y) / 2
  const kneeMidY = (lK.y + rK.y) / 2
  const depth = hipMidY - kneeMidY  // positive = hip below knee

  if (depth >= T.SQUAT_DEPTH_OK) return null

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

  const cam = detectCameraView(all)

  switch (movementType) {
    case 'lateral_cut':
      push(detectKneeValgus(key, 'left',  0.15, cam))
      push(detectKneeValgus(key, 'right', 0.15, cam))
      push(detectHipDrop(key, 0.15, cam))
      push(detectTorsoInstability(key, 0.15))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'jump_landing':
      push(detectKneeValgus(key, 'left',  0.15, cam))
      push(detectKneeValgus(key, 'right', 0.15, cam))
      push(detectStiffLanding(key))
      push(detectLandingAsymmetry(key))
      push(detectHipDrop(key, 0.15, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'squat':
      push(detectKneeValgus(key, 'left',  0.15, cam))
      push(detectKneeValgus(key, 'right', 0.15, cam))
      push(detectShallowSquatDepth(all))
      push(detectHipDrop(key, 0.15, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'plank':
      push(detectHipSag(key))
      push(detectShoulderAsymmetry(key, 0.20))
      push(detectTorsoInstability(key, 0.20))
      break

    case 'deadlift':
      push(detectHipDrop(key, 0.15, cam))
      push(detectKneeValgus(key, 'left',  0.15, cam))
      push(detectKneeValgus(key, 'right', 0.15, cam))
      push(detectShoulderAsymmetry(all, 0.20))
      break

    case 'lunge':
      push(detectKneeValgus(key, 'left',  0.15, cam))
      push(detectKneeValgus(key, 'right', 0.15, cam))
      push(detectTorsoInstability(key, 0.15))
      push(detectHipDrop(key, 0.15, cam))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break

    case 'overhead_press':
      push(detectShoulderAsymmetry(all, 0.20))
      push(detectTorsoInstability(all, 0.20))
      break

    case 'sprint':
      push(detectHipDrop(key, 0.15, cam))
      push(detectTorsoInstability(key, 0.15))
      push(detectLandingAsymmetry(key))
      push(detectAnkleEversion(all, 'left',  cam))
      push(detectAnkleEversion(all, 'right', cam))
      break
  }

  const deduped = deduplicateAndMerge(issues)
  const order: Record<IssueSeverity, number> = { severe: 0, moderate: 1, mild: 2 }
  return deduped.sort((a, b) => order[a.severity] - order[b.severity])
}
