'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, Plus } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'New Session' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/profile', label: 'Profile' },
]

export default function AppHeader({ userInitial }: { userInitial?: string }) {
  const pathname = usePathname()

  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-8 sticky top-0 z-10 bg-[#0b0b0f]/95 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#00FF9D] rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-black" />
          </div>
          <span
            className="text-sm font-bold tracking-widest text-[#00FF9D] uppercase"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            KINETIX
          </span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  active
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-[#00FF9D] hover:bg-[#00e88a] text-black text-xs font-mono rounded-full px-4 py-2 transition-colors font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          New Session
        </Link>
        {userInitial && (
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-white/70 hover:border-white/20 transition-colors"
          >
            {userInitial}
          </Link>
        )}
      </div>
    </header>
  )
}
