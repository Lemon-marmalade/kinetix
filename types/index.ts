export interface PoseLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export type MovementType =
  | 'lateral_cut'
  | 'jump_landing'
  | 'squat'
  | 'plank'
  | 'deadlift'
  | 'lunge'
  | 'overhead_press'
  | 'sprint'

export const MOVEMENT_META: Record<MovementType, {
  label: string
  category: 'athletic' | 'strength' | 'stability' | 'cardio'
  description: string
  cameraAngle: string
  primaryMuscles: string[]
  injuryFocuses: string[]
  complexity: 'simple' | 'moderate' | 'complex'
}> = {
  lateral_cut: {
    label: 'Lateral Cut',
    category: 'athletic',
    description: 'Side-to-side cutting motion used in football, soccer, basketball.',
    cameraAngle: 'Front or 45°',
    primaryMuscles: ['Quads', 'Glutes', 'Hip Abductors', 'Ankle Stabilizers'],
    injuryFocuses: ['ACL', 'Ankle Sprain', 'IT Band'],
    complexity: 'complex',
  },
  jump_landing: {
    label: 'Jump Landing',
    category: 'athletic',
    description: 'Vertical or box jump with landing analysis.',
    cameraAngle: 'Front',
    primaryMuscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
    injuryFocuses: ['ACL', 'Patellar Tendon', 'Ankle'],
    complexity: 'complex',
  },
  squat: {
    label: 'Squat',
    category: 'strength',
    description: 'Bodyweight or loaded squat movement.',
    cameraAngle: 'Front or Side',
    primaryMuscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    injuryFocuses: ['Knee', 'Lower Back', 'Hip'],
    complexity: 'moderate',
  },
  plank: {
    label: 'Plank',
    category: 'stability',
    description: 'Isometric core stability hold.',
    cameraAngle: 'Side',
    primaryMuscles: ['Core', 'Shoulders', 'Glutes'],
    injuryFocuses: ['Lower Back', 'Shoulder', 'Wrist'],
    complexity: 'simple',
  },
  deadlift: {
    label: 'Deadlift',
    category: 'strength',
    description: 'Hip hinge lifting pattern from floor.',
    cameraAngle: 'Side',
    primaryMuscles: ['Hamstrings', 'Glutes', 'Lower Back', 'Traps'],
    injuryFocuses: ['Lumbar Disc', 'Hamstring', 'Hip'],
    complexity: 'complex',
  },
  lunge: {
    label: 'Lunge',
    category: 'strength',
    description: 'Forward or reverse lunge pattern.',
    cameraAngle: 'Front or Side',
    primaryMuscles: ['Quads', 'Glutes', 'Hip Flexors'],
    injuryFocuses: ['Knee', 'Hip Flexor', 'Ankle'],
    complexity: 'moderate',
  },
  overhead_press: {
    label: 'Overhead Press',
    category: 'strength',
    description: 'Vertical pressing movement above head.',
    cameraAngle: 'Side',
    primaryMuscles: ['Deltoids', 'Triceps', 'Upper Traps', 'Core'],
    injuryFocuses: ['Rotator Cuff', 'Lumbar', 'Cervical Spine'],
    complexity: 'moderate',
  },
  sprint: {
    label: 'Sprint',
    category: 'cardio',
    description: 'High-speed running gait analysis.',
    cameraAngle: 'Side',
    primaryMuscles: ['Hamstrings', 'Quads', 'Glutes', 'Calves'],
    injuryFocuses: ['Hamstring Strain', 'Hip Flexor', 'Achilles'],
    complexity: 'complex',
  },
}

export interface PoseFrame {
  timestamp: number
  frameIndex: number
  landmarks: PoseLandmark[]
  worldLandmarks?: PoseLandmark[]
}

export type IssueSeverity = 'mild' | 'moderate' | 'severe'

export type IssueType =
  | 'knee_valgus'
  | 'torso_instability'
  | 'hip_drop'
  | 'ankle_eversion'
  | 'landing_asymmetry'
  | 'stiff_landing'
  | 'forward_trunk_lean'
  | 'hip_sag'
  | 'hip_pike'
  | 'rounded_back'
  | 'knee_over_toe'
  | 'shallow_squat_depth'
  | 'shoulder_asymmetry'
  | 'head_forward'
  | 'lumbar_hyperextension'
  | 'pelvic_tilt'

export const ISSUE_META: Record<IssueType, {
  label: string
  injuryRisk: string[]
  bodyRegion: 'lower_body' | 'upper_body' | 'core' | 'full_body'
  clinicalNote: string
}> = {
  knee_valgus: {
    label: 'Knee Valgus (Cave-In)',
    injuryRisk: ['ACL Tear', 'Patellofemoral Pain Syndrome', 'IT Band Syndrome'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Dynamic valgus is the #1 biomechanical predictor of non-contact ACL injury. Hewett et al., 2005.',
  },
  torso_instability: {
    label: 'Torso Lateral Instability',
    injuryRisk: ['Lumbar Strain', 'Hip Flexor Overload'],
    bodyRegion: 'core',
    clinicalNote: 'Excessive lateral trunk lean shifts load asymmetrically onto the lumbar facet joints.',
  },
  hip_drop: {
    label: 'Hip Drop (Trendelenburg)',
    injuryRisk: ['IT Band Syndrome', 'Hip Abductor Strain', 'Iliotibial Band Friction'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Contralateral pelvic drop indicates hip abductor weakness (glute medius). Noehren et al., 2007.',
  },
  ankle_eversion: {
    label: 'Ankle Eversion',
    injuryRisk: ['Lateral Ankle Sprain', 'Peroneal Tendinopathy', 'Plantar Fasciitis'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Excessive foot pronation alters the kinetic chain from ankle through hip.',
  },
  landing_asymmetry: {
    label: 'Asymmetric Landing',
    injuryRisk: ['Unilateral ACL Stress', 'Compensatory Overuse Injury'],
    bodyRegion: 'full_body',
    clinicalNote: 'Bilateral landing force asymmetry >10% significantly increases unilateral joint loading.',
  },
  stiff_landing: {
    label: 'Stiff Landing (Insufficient Flexion)',
    injuryRisk: ['ACL Tear', 'Patellar Tendinopathy', 'Tibial Stress Fracture'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Knee flexion <30° at initial contact increases ACL loading 2.4x. Decker et al., 2003.',
  },
  forward_trunk_lean: {
    label: 'Excessive Forward Trunk Lean',
    injuryRisk: ['Lumbar Disc Herniation', 'Hip Flexor Strain'],
    bodyRegion: 'core',
    clinicalNote: 'Trunk lean >45° in squat/deadlift dramatically increases L4-L5 disc compressive forces.',
  },
  hip_sag: {
    label: 'Hip Sag',
    injuryRisk: ['Lumbar Hyperextension', 'Disc Compression', 'Core Weakness'],
    bodyRegion: 'core',
    clinicalNote: 'Sagging hips in plank place the lumbar spine in hyperextension. McGill, 2010.',
  },
  hip_pike: {
    label: 'Hip Pike (Elevated)',
    injuryRisk: ['Reduced Core Activation', 'Shoulder Impingement'],
    bodyRegion: 'core',
    clinicalNote: 'Piked hips reduce posterior chain engagement and shift load to shoulders.',
  },
  rounded_back: {
    label: 'Rounded Lower Back',
    injuryRisk: ['Lumbar Disc Herniation', 'Spinal Ligament Strain'],
    bodyRegion: 'core',
    clinicalNote: 'Lumbar flexion under load is the primary mechanism for disc herniation. McGill, 2007.',
  },
  knee_over_toe: {
    label: 'Knee Tracking Past Toes',
    injuryRisk: ['Patellar Tendinopathy', 'Anterior Knee Pain'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Excessive tibial forward lean increases patellofemoral compressive forces.',
  },
  shallow_squat_depth: {
    label: 'Shallow Squat Depth',
    injuryRisk: ['Reduced Glute Activation', 'Quad Dominance'],
    bodyRegion: 'lower_body',
    clinicalNote: 'Below-parallel depth is required for full posterior chain recruitment.',
  },
  shoulder_asymmetry: {
    label: 'Shoulder Asymmetry',
    injuryRisk: ['Rotator Cuff Impingement', 'AC Joint Stress'],
    bodyRegion: 'upper_body',
    clinicalNote: 'Unequal shoulder height during pressing indicates scapular instability.',
  },
  head_forward: {
    label: 'Forward Head Posture',
    injuryRisk: ['Cervical Disc Stress', 'Suboccipital Muscle Strain'],
    bodyRegion: 'upper_body',
    clinicalNote: 'Every inch of forward head posture adds ~10 lbs of effective weight on the cervical spine.',
  },
  lumbar_hyperextension: {
    label: 'Lumbar Hyperextension',
    injuryRisk: ['Facet Joint Irritation', 'Spondylolysis'],
    bodyRegion: 'core',
    clinicalNote: 'Excessive lumbar extension compresses posterior facet joints and neural foramina.',
  },
  pelvic_tilt: {
    label: 'Anterior Pelvic Tilt',
    injuryRisk: ['Hip Flexor Tightness', 'Hamstring Strain Risk', 'Lower Back Pain'],
    bodyRegion: 'core',
    clinicalNote: 'Anterior pelvic tilt elongates and weakens hamstrings, increasing strain risk at speed.',
  },
}

export interface DetectedIssue {
  id: string
  type: IssueType
  severity: IssueSeverity
  affectedJoints: number[]
  frames: number[]
  description: string
  recommendation: string
  peakValue?: number
  avgValue?: number
}

export interface ScoreFactor {
  name: string
  contribution: number
  description: string
}

export interface ScoreBreakdown {
  value: number
  factors: ScoreFactor[]
}

export interface Scores {
  stability: number
  alignment: number
  risk: number
  breakdowns: {
    stability: ScoreBreakdown
    alignment: ScoreBreakdown
    risk: ScoreBreakdown
  }
}

export interface Session {
  id: string
  user_id: string
  movement_type: MovementType
  timestamp: string
  video_url?: string | null
  video_expires_at?: string
  pose_data?: PoseFrame[]
  pose_skeleton_summary?: PoseFrame[]
  scores?: Scores
  detected_issues?: DetectedIssue[]
  ai_feedback?: string
  rep_count?: number
  duration_seconds?: number
}

export interface PastInjury {
  id: string
  bodyPart: string
  injuryType: string
  date?: string
  recovered: boolean
  notes?: string
}

export interface UserProfile {
  id: string
  name?: string
  sport?: string
  position?: string
  age?: number
  height_cm?: number
  weight_kg?: number
  dominant_side?: 'left' | 'right'
  fitness_level?: 'beginner' | 'intermediate' | 'advanced' | 'elite'
  past_injuries?: PastInjury[]
  created_at: string
}

export interface ReferenceSequence {
  id: string
  name: string
  movementType: MovementType
  frames: PoseFrame[]
  description: string
}

export interface JointDeviation {
  jointIndex: number
  jointName: string
  deviationDegrees: number
  severity: IssueSeverity
}

export interface ReferenceComparisonResult {
  overallSimilarity: number
  symmetryScore: number
  jointDeviations: JointDeviation[]
  temporalAlignment: number
}
