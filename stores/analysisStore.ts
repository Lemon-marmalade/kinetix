import { create } from 'zustand'

export type AnalysisStatus = 'idle' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'error'

interface AnalysisState {
  status: AnalysisStatus
  progress: number   // 0–100
  errorMessage: string | null
  activeIssueId: string | null   // for frame scrubbing on issue click

  setStatus: (status: AnalysisStatus) => void
  setProgress: (progress: number) => void
  setError: (message: string) => void
  setActiveIssueId: (id: string | null) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  status: 'idle',
  progress: 0,
  errorMessage: null,
  activeIssueId: null,

  setStatus: (status) => set({ status, ...(status !== 'error' ? { errorMessage: null } : {}) }),
  setProgress: (progress) => set({ progress }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setActiveIssueId: (id) => set({ activeIssueId: id }),
  reset: () => set({ status: 'idle', progress: 0, errorMessage: null, activeIssueId: null }),
}))
