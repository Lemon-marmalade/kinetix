// MediaPipe Pose is loaded via <Script strategy="beforeInteractive"> in layout.tsx.
// That makes it a synchronous HTML <script> tag with proper document.currentScript,
// which lets mediapipe's WASM helper scripts reach the internal Module object.
// Here we just wait for window.Pose to be ready.

export interface PoseInstance {
  setOptions: (opts: object) => void
  onResults: (cb: (results: unknown) => void) => void
  send: (input: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>
  close: () => Promise<void>
}

export type PoseConstructor = new (config: { locateFile?: (file: string) => string }) => PoseInstance

export async function loadMediapipePose(): Promise<{ Pose: PoseConstructor }> {
  if (typeof window === 'undefined') throw new Error('Client only')

  // Script is pre-loaded — usually already available, but poll in case of slow network
  const start = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any
  while (!win.Pose) {
    if (Date.now() - start > 15_000) throw new Error('MediaPipe Pose failed to load (timeout)')
    await new Promise(r => setTimeout(r, 100))
  }

  return { Pose: win.Pose as PoseConstructor }
}
