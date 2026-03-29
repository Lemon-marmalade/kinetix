import { create } from 'zustand'
import type { PoseFrame, DetectedIssue, Scores, MovementType } from '@/types'

interface SessionState {
  // Current session metadata
  sessionId: string | null
  movementType: MovementType
  videoUrl: string | null
  videoFile: File | null
  videoBlobUrl: string | null

  // Pose data
  poseFrames: PoseFrame[]
  hasLiveFrames: boolean   // true when frames came from live recording (skip re-extraction)
  repCount: number
  durationSeconds: number

  // Analysis results
  scores: Scores | null
  detectedIssues: DetectedIssue[]
  aiFeedback: string | null

  // Actions
  setSessionId: (id: string) => void
  setMovementType: (type: MovementType) => void
  setVideoFile: (file: File) => void
  setVideoUrl: (url: string) => void
  setVideoBlobUrl: (url: string) => void
  setPoseFrames: (frames: PoseFrame[]) => void
  setHasLiveFrames: (val: boolean) => void
  setRepCount: (count: number) => void
  setDuration: (seconds: number) => void
  setScores: (scores: Scores) => void
  setDetectedIssues: (issues: DetectedIssue[]) => void
  setAiFeedback: (feedback: string) => void
  resetSession: () => void
}

const initialState = {
  sessionId: null,
  movementType: 'lateral_cut' as MovementType,
  videoUrl: null,
  videoFile: null,
  videoBlobUrl: null,
  poseFrames: [],
  hasLiveFrames: false,
  repCount: 0,
  durationSeconds: 0,
  scores: null,
  detectedIssues: [],
  aiFeedback: null,
}

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setMovementType: (type) => set({ movementType: type }),
  setVideoFile: (file) => set({ videoFile: file }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setVideoBlobUrl: (url) => set({ videoBlobUrl: url }),
  setPoseFrames: (frames) => set({ poseFrames: frames }),
  setHasLiveFrames: (val) => set({ hasLiveFrames: val }),
  setRepCount: (count) => set({ repCount: count }),
  setDuration: (seconds) => set({ durationSeconds: seconds }),
  setScores: (scores) => set({ scores }),
  setDetectedIssues: (issues) => set({ detectedIssues: issues }),
  setAiFeedback: (feedback) => set({ aiFeedback: feedback }),
  resetSession: () => set(initialState),
}))
