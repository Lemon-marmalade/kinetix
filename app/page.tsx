import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Activity } from 'lucide-react'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-8">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#00FF9D] rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-black" />
          </div>
          <span className="text-sm font-bold tracking-widest text-[#00FF9D] uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            KINETIX
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="text-xs font-mono text-white/50 hover:text-white transition-colors uppercase tracking-widest">
              Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-xs font-mono text-white/50 hover:text-white transition-colors uppercase tracking-widest">
                Sign In
              </Link>
              <Link href="/signup" className="text-xs font-mono bg-[#00FF9D] text-black px-4 py-1.5 rounded-full uppercase tracking-widest hover:bg-[#00e88a] transition-colors font-bold">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Live badge */}
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-mono tracking-wider text-zinc-400 uppercase">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00FF9D] animate-pulse" />
          AI-Powered Biomechanics
        </span>
      </div>

      {/* Headline */}
      <h1
        className="text-[#00FF9D] uppercase"
        style={{
          fontFamily: "'Orbitron', 'Impact', 'Arial Black', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(4.5rem, 14vw, 12rem)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        KINETIX
      </h1>

      <p className="mt-6 text-base text-zinc-500 max-w-md leading-relaxed">
        Upload a video or record live. Get instant AI analysis of your movement patterns, biomechanics, and form.
      </p>

      {/* CTAs */}
      <div className="mt-10 flex items-center gap-4">
        {user ? (
          <Link
            href="/dashboard"
            className="px-8 py-3 rounded-xl font-mono text-xs uppercase tracking-widest bg-[#00FF9D] text-black hover:bg-[#00e88a] transition-colors font-bold"
          >
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="px-8 py-3 rounded-xl font-mono text-xs uppercase tracking-widest bg-[#00FF9D] text-black hover:bg-[#00e88a] transition-colors font-bold"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 rounded-xl font-mono text-xs uppercase tracking-widest border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
