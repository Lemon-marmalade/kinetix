import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kinetix',
  description: 'AI-powered pose estimation and movement analysis for athletes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Step 1: predeclare the MediaPipe bootstrap globals before pose.js loads. */}
        <Script src="/mediapipe-module-init.js" strategy="beforeInteractive" />
        {/* Step 2: load pose.js before app code that constructs Pose instances. */}
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
