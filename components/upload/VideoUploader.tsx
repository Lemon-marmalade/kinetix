'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileVideo, X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadVideo, getVideoExpiresAt } from '@/lib/supabase/storage'
import { useSessionStore } from '@/stores/sessionStore'
import { useAnalysisStore } from '@/stores/analysisStore'
import type { MovementType } from '@/types'
import ProgressBar from './ProgressBar'

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_SIZE_MB = 200

export default function VideoUploader() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setVideoFile, setVideoUrl, setVideoBlobUrl, setSessionId, movementType, setMovementType } = useSessionStore()
  const { status, progress, setStatus, setProgress, setError } = useAnalysisStore()

  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Invalid file type. Accepted: MP4, MOV, WebM'
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File too large. Max ${MAX_SIZE_MB}MB`
    return null
  }

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    setSelectedFile(file)
    setVideoFile(file)
    setVideoBlobUrl(URL.createObjectURL(file))
  }, [setVideoFile, setVideoBlobUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleUpload = async () => {
    if (!selectedFile) return

    setStatus('uploading')
    setProgress(0)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const sessionId = crypto.randomUUID()
      setSessionId(sessionId)

      const videoUrl = await uploadVideo(selectedFile, user.id, sessionId, (p) => {
        setProgress(p * 0.5) // upload is first 50%
      })

      setVideoUrl(videoUrl)

      // Create initial session row in Supabase
      const { error: dbError } = await supabase.from('sessions').insert({
        id: sessionId,
        user_id: user.id,
        movement_type: movementType,
        video_url: videoUrl,
        video_expires_at: getVideoExpiresAt(),
      })

      if (dbError) throw new Error(dbError.message)

      setStatus('processing')
      setProgress(50)

      router.push(`/analysis?session=${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const isUploading = status === 'uploading'

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Movement type selector */}
      <div>
        <label className="block text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">
          Movement Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['lateral_cut', 'jump_landing'] as MovementType[]).map(type => (
            <button
              key={type}
              onClick={() => setMovementType(type)}
              className={`p-4 rounded-xl border text-left transition-all ${
                movementType === type
                  ? 'bg-purple-600/20 border-purple-500 text-white'
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <span className="text-xs font-mono uppercase tracking-widest block">
                {type === 'lateral_cut' ? 'Lateral Cut' : 'Jump Landing'}
              </span>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                {type === 'lateral_cut' ? 'Football agility movement' : 'Vertical/box jump analysis'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all ${
          dragOver ? 'border-purple-500 bg-purple-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div key="selected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <FileVideo className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <p className="text-sm text-white font-medium">{selectedFile.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Drop your video here or click to browse</p>
              <p className="text-xs text-zinc-600 mt-2">MP4, MOV, WebM · Max {MAX_SIZE_MB}MB</p>
            </motion.div>
          )}
        </AnimatePresence>

        {selectedFile && (
          <button
            className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-300"
            onClick={e => { e.stopPropagation(); setSelectedFile(null); setLocalError(null) }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {(localError || status === 'error') && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 rounded-xl p-4 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {localError ?? useAnalysisStore.getState().errorMessage}
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <ProgressBar progress={progress} label="Uploading video..." />
      )}

      {/* Upload button */}
      {selectedFile && !isUploading && (
        <button
          onClick={handleUpload}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs uppercase tracking-widest rounded-xl py-4 transition-colors"
        >
          Upload & Analyze
        </button>
      )}
    </div>
  )
}
