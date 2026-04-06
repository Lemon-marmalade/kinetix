'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileVideo, X, Video, ChevronRight, AlertCircle } from 'lucide-react'
import AppHeader from '@/components/ui/AppHeader'
import { createClient } from '@/lib/supabase/client'
import { uploadVideo, getVideoExpiresAt } from '@/lib/supabase/storage'
import { useSessionStore } from '@/stores/sessionStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import { MOVEMENT_META } from '@/types'
import type { MovementType } from '@/types'
import ProgressBar from '@/components/upload/ProgressBar'

const LiveRecorder = dynamic(() => import(/* webpackMode: "eager" */ '@/components/recording/LiveRecorder'), { ssr: false })

const MOVEMENTS: MovementType[] = [
  'lateral_cut', 'jump_landing', 'squat', 'deadlift',
  'lunge', 'plank', 'overhead_press', 'sprint',
]

const CATEGORY_COLORS = {
  athletic:  'border-white/10 bg-white/[0.02] hover:border-white/20',
  strength:  'border-white/10 bg-white/[0.02] hover:border-white/20',
  stability: 'border-white/10 bg-white/[0.02] hover:border-white/20',
  cardio:    'border-white/10 bg-white/[0.02] hover:border-white/20',
}

const CATEGORY_BADGE = {
  athletic:  'bg-white/[0.06] text-white/60',
  strength:  'bg-white/[0.06] text-white/60',
  stability: 'bg-white/[0.06] text-white/60',
  cardio:    'bg-white/[0.06] text-white/60',
}

type InputMode = 'upload' | 'record'

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setVideoFile, setVideoUrl, setVideoBlobUrl, setSessionId, movementType, setMovementType, setPoseFrames, setHasLiveFrames, setDetectedIssues, setRepCount, resetSession } = useSessionStore()
  const { status, progress, setStatus, setProgress, setError } = useAnalysisStore()

  const [mode, setMode] = useState<InputMode>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [step, setStep] = useState<'movement' | 'input'>('movement')

  const validateFile = (file: File): string | null => {
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) return 'Invalid file type. Use MP4, MOV, or WebM.'
    if (file.size > 200 * 1024 * 1024) return 'File too large. Maximum 200 MB.'
    return null
  }

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    setPoseFrames([])
    setDetectedIssues([])
    setHasLiveFrames(false)
    setSelectedFile(file)
    setVideoFile(file)
    setVideoBlobUrl(URL.createObjectURL(file))
  }, [setVideoFile, setVideoBlobUrl, setPoseFrames, setDetectedIssues, setHasLiveFrames])

  const handleRecordingComplete = useCallback((
    blob: Blob, blobUrl: string,
    frames: import('@/types').PoseFrame[],
    issues: import('@/types').DetectedIssue[],
    repCount: number,
  ) => {
    const file = new File([blob], 'recording.webm', { type: 'video/webm' })
    setSelectedFile(file)
    setVideoFile(file)
    setVideoBlobUrl(blobUrl)
    setRecordingBlobUrl(blobUrl)
    setPoseFrames(frames)
    setDetectedIssues(issues)
    setRepCount(repCount)
    setHasLiveFrames(true)
  }, [setVideoFile, setVideoBlobUrl, setPoseFrames, setHasLiveFrames, setDetectedIssues, setRepCount])

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return
    setStatus('uploading')
    setLocalError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const sessionId = crypto.randomUUID()
      setSessionId(sessionId)
      const videoUrl = await uploadVideo(
        selectedFile,
        user.id,
        sessionId,
        p => setProgress(Math.min(50, Math.max(0, p * 0.5)))
      )
      setVideoUrl(videoUrl)
      await supabase.from('sessions').insert({
        id: sessionId, user_id: user.id, movement_type: movementType,
        video_url: videoUrl, video_expires_at: getVideoExpiresAt(),
      })
      setStatus('processing')
      setProgress(50)
      router.push(`/analysis?session=${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const isUploading = status === 'uploading'
  const meta = MOVEMENT_META[movementType]

  return (
    <div className="min-h-screen bg-[#0b0b0f]">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#00FF9D]/3 blur-[140px] rounded-full" />
      </div>

      <AppHeader />

      {/* Thin line progress */}
      <div className="flex items-center gap-1.5 px-8 pt-3">
        {['Movement', 'Video'].map((_, i) => (
          <div
            key={i}
            className={`h-[2px] flex-1 rounded-full transition-all duration-300 ${
              (i === 0 && (step === 'movement' || step === 'input')) || (i === 1 && step === 'input')
                ? 'bg-[#00FF9D]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <main className="max-w-3xl mx-auto px-8 py-10">
        <AnimatePresence mode="wait">
          {/* Step 1: Movement Selection */}
          {step === 'movement' && (
            <motion.div key="movement" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">What movement are you analyzing?</h2>
              <p className="text-white/40 text-sm mb-8">Choose the type of movement in your video.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {MOVEMENTS.map(type => {
                  const m = MOVEMENT_META[type]
                  const isSelected = movementType === type
                  return (
                    <button
                      key={type}
                      onClick={() => { setMovementType(type); setStep('input') }}
                      className={`relative flex flex-col items-center justify-center gap-2 px-3 py-6 rounded-2xl border text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-[#00FF9D]/10 border-[#00FF9D]/50 text-white'
                          : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20 hover:text-white hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className={`absolute top-2.5 right-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-white bg-white' : 'border-white/20'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-[#00FF9D]" />}
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full capitalize ${
                        isSelected ? 'bg-white/20 text-white' : CATEGORY_BADGE[m.category]
                      }`}>{m.category}</span>
                      <span className="text-xs font-semibold text-center leading-tight">{m.label}</span>
                      <span className={`text-[9px] font-mono ${isSelected ? 'text-white/60' : 'text-white/25'}`}>{m.cameraAngle}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Input */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('movement')} className="text-white/40 hover:text-white text-xs font-mono transition-colors">
                  ← Back
                </button>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.1]">
                  <span className="text-sm font-semibold text-white">{meta.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_BADGE[meta.category]}`}>
                    {meta.category}
                  </span>
                </div>
              </div>

              <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Add your video</h2>
              <p className="text-white/40 text-sm mb-8">Upload a recording or capture live with your camera.</p>

              {/* Mode tabs */}
              <div className="flex bg-white/[0.04] rounded-2xl p-1 border border-white/[0.07] mb-6">
                {(['upload', 'record'] as InputMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setRecordingBlobUrl(null) }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono transition-all ${
                      mode === m ? 'bg-[#00FF9D] text-black shadow-sm' : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {m === 'upload' ? <><Upload className="w-3.5 h-3.5" />Upload Video</> : <><Video className="w-3.5 h-3.5" />Record Live</>}
                  </button>
                ))}
              </div>

              {/* Upload mode */}
              {mode === 'upload' && (
                <div
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center cursor-pointer transition-all ${
                    dragOver ? 'border-[#00FF9D] bg-[#00FF9D]/5' : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  <AnimatePresence mode="wait">
                    {selectedFile ? (
                      <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                        <FileVideo className="w-10 h-10 text-[#00FF9D] mx-auto mb-3" />
                        <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-xs text-white/30 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </motion.div>
                    ) : (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center mx-auto mb-4">
                          <Upload className="w-6 h-6 text-white/25" />
                        </div>
                        <p className="text-sm text-white/60 font-medium mb-1">Drop your video here</p>
                        <p className="text-xs text-white/25">MP4, MOV, WebM · Max 200 MB</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {selectedFile && (
                    <button className="absolute top-3 right-3 p-1 text-white/30 hover:text-white"
                      onClick={e => { e.stopPropagation(); setSelectedFile(null) }}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Record mode */}
              {mode === 'record' && !recordingBlobUrl && (
                <LiveRecorder movementType={movementType} onRecordingComplete={handleRecordingComplete} />
              )}

              {/* Post-recording preview */}
              {mode === 'record' && recordingBlobUrl && (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/[0.08]">
                    <video
                      src={recordingBlobUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/40 font-mono">
                    <span>Recording ready</span>
                    <button
                      onClick={() => { setRecordingBlobUrl(null); setSelectedFile(null) }}
                      className="text-white/30 hover:text-white transition-colors"
                    >
                      ✕ Redo
                    </button>
                  </div>
                </div>
              )}

              {/* Errors */}
              {(localError || status === 'error') && (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/40 rounded-2xl p-4 text-sm text-red-400 mt-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {localError ?? useAnalysisStore.getState().errorMessage}
                </div>
              )}

              {isUploading && <ProgressBar progress={progress} label="Uploading..." className="mt-4" />}

              {selectedFile && !isUploading && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  onClick={handleUploadAndAnalyze}
                  className="w-full mt-6 bg-[#00FF9D] hover:bg-[#00e88a] text-black font-mono text-sm font-semibold rounded-full py-4 transition-all shadow-lg shadow-black/20"
                >
                  Analyze {meta.label} →
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
