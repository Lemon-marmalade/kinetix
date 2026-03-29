export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseData {
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  timestamp: number;
}

export interface ExerciseReference {
  id: string;
  name: string;
  description: string;
  idealAngles: {
    [key: string]: { min: number; max: number; label: string };
  };
}

export const EXERCISES: ExerciseReference[] = [
  {
    id: 'squat',
    name: 'Squat',
    description: 'Basic lower body strength test. Focus on depth and back angle.',
    idealAngles: {
      knee_angle: { min: 70, max: 110, label: 'Knee Flexion' },
      hip_angle: { min: 60, max: 100, label: 'Hip Flexion' },
      back_angle: { min: 160, max: 180, label: 'Back Straightness' },
    },
  },
  {
    id: 'football_cut',
    name: 'Football Cut',
    description: 'High-velocity change of direction. Monitor knee alignment and center of gravity.',
    idealAngles: {
      knee_valgus: { min: 170, max: 180, label: 'Knee Alignment' },
      cutting_angle: { min: 45, max: 60, label: 'Plant Angle' },
      torso_lean: { min: 15, max: 30, label: 'Torso Lean' },
    },
  },
  {
    id: 'jump_landing',
    name: 'Jump Landing',
    description: 'Focus on bilateral symmetry and soft landing mechanics to prevent ACL strain.',
    idealAngles: {
      knee_flexion: { min: 20, max: 45, label: 'Landing Absorption' },
      symmetry: { min: 0, max: 5, label: 'L/R Deviation' },
    },
  },
  {
    id: 'single_leg_squat',
    name: 'Single-Leg Squat',
    description: 'Core stability and glute medius activation test.',
    idealAngles: {
      knee_stability: { min: 175, max: 180, label: 'Frontal Plane Stability' },
      back_angle: { min: 160, max: 180, label: 'Back Alignment' },
    },
  },
  {
    id: 'lunge',
    name: 'Lunge',
    description: 'Step forward and drop your back knee towards the floor.',
    description: 'Unilateral stability test. Keep front knee over ankle.',
    idealAngles: {
      front_knee: { min: 80, max: 100, label: 'Front Knee' },
      back_knee: { min: 80, max: 100, label: 'Back Knee' },
    },
  },
  {
    id: 'overhead_press',
    name: 'Overhead Press',
    description: 'Press the weights overhead while keeping your core tight.',
    name: 'Push Press',
    description: 'Upper body extension. Check full lockout.',
    idealAngles: {
      shoulder_flexion: { min: 160, max: 180, label: 'Shoulder Flexion' },
      elbow_extension: { min: 170, max: 180, label: 'Elbow Extension' },
    },
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    description: 'Lift the weight from the floor while maintaining a neutral spine.',
    idealAngles: {
      hip_hinge: { min: 45, max: 75, label: 'Hip Hinge' },
      back_flatness: { min: 170, max: 180, label: 'Back Flatness' },
    },
  },
];
