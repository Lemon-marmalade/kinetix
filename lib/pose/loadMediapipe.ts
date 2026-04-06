// MediaPipe Pose is loaded via <Script strategy="beforeInteractive"> in layout.tsx.
// Here we just wait for window.Pose to become available.
export interface PoseInstance {
  setOptions: (opts: object) => void
  onResults: (cb: (results: unknown) => void) => void
  send: (input: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>
  close: () => Promise<void>
}

export type PoseConstructor = new (config: { locateFile?: (file: string) => string }) => PoseInstance

export async function loadMediapipePose(): Promise<{ Pose: PoseConstructor }> {
  if (typeof window === 'undefined') throw new Error('Client only')

  const start = Date.now()
  const win = window as Window & { Pose?: PoseConstructor }
  while (!win.Pose) {
    if (Date.now() - start > 15_000) throw new Error('MediaPipe Pose failed to load (timeout)')
    await new Promise(r => setTimeout(r, 100))
  }

  return { Pose: win.Pose }
}
