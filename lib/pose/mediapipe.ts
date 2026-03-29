'use client'

import type { PoseFrame } from '@/types'
import { smoothPoseFrames } from './smoothing'
import { loadMediapipePose } from './loadMediapipe'

export interface MediaPipeConfig {
  modelComplexity?: 0 | 1 | 2
  smoothLandmarks?: boolean
  minDetectionConfidence?: number
  minTrackingConfidence?: number
}

const DEFAULT_CONFIG: Required<MediaPipeConfig> = {
  modelComplexity: 2,          // Max accuracy
  smoothLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
}

export async function extractPoseFromVideo(
  videoEl: HTMLVideoElement,
  onProgress?: (progress: number) => void,
  config: MediaPipeConfig = {}
): Promise<PoseFrame[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const { Pose } = await loadMediapipePose()
  const pose = new Pose({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
  })

  pose.setOptions({
    modelComplexity: cfg.modelComplexity,
    smoothLandmarks: cfg.smoothLandmarks,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: cfg.minDetectionConfidence,
    minTrackingConfidence: cfg.minTrackingConfidence,
  })

  const frames: PoseFrame[] = []

  // CRITICAL: preserve the video's aspect ratio on the offscreen canvas.
  // Previously this was hardcoded to 640×480, which SQUASHES portrait videos
  // and causes MediaPipe to detect landmarks in a distorted coordinate space.
  const vW = videoEl.videoWidth || 640
  const vH = videoEl.videoHeight || 480
  const MAX_DIM = 1280  // process at up to 1280px for accuracy
  const scale = Math.min(MAX_DIM / vW, MAX_DIM / vH, 1)
  const processW = Math.max(2, Math.round(vW * scale))
  const processH = Math.max(2, Math.round(vH * scale))

  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = processW
  offscreenCanvas.height = processH
  const ctx = offscreenCanvas.getContext('2d')!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pose.onResults((results: any) => {
    if (results.poseLandmarks) {
      frames.push({
        timestamp: videoEl.currentTime,
        frameIndex: frames.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        landmarks: results.poseLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z ?? 0,
          visibility: lm.visibility ?? 1,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        worldLandmarks: results.poseWorldLandmarks?.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z ?? 0,
          visibility: lm.visibility ?? 1,
        })),
      })
    }
  })

  const duration = videoEl.duration
  // 20fps gives ~600 frames for 30s video — tighter keyframe spacing reduces
  // visible interpolation gaps and improves skeleton-to-video alignment.
  const fps = 20
  const frameInterval = 1 / fps
  const totalFrames = Math.floor(duration * fps)

  for (let i = 0; i < totalFrames; i++) {
    const time = i * frameInterval
    if (time >= duration) break

    await seekVideo(videoEl, time)
    ctx.drawImage(videoEl, 0, 0, processW, processH)
    await pose.send({ image: offscreenCanvas })

    onProgress?.((i + 1) / totalFrames)
  }

  await pose.close()

  // Apply light EMA smoothing (α=0.65) to damp per-frame jitter.
  // α=0.65 gives <1 frame of effective lag at 20fps, so the skeleton
  // stays aligned with the video while removing noise spikes.
  return smoothPoseFrames(frames)
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.04) {
      resolve()
      return
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}
