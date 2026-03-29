import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'FORM — Sports Biomechanics',
  description: 'AI-powered pose estimation and movement analysis for athletes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Step 1: pre-declare window.Module so pose.js merges into the global object.
            Emscripten helper scripts (loaded by pose.js at runtime) run in global scope
            and expect Module.CDN_URL to exist on window — this guarantees it does. */}
        <Script src="/mediapipe-module-init.js" strategy="beforeInteractive" />
        {/* Step 2: load pose.js as a synchronous beforeInteractive script so it runs
            with document.currentScript access intact and finds the pre-declared Module. */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-[#050505] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
