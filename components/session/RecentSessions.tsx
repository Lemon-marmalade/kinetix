'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@/types'
import SessionCard from './SessionCard'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface RecentSessionsProps {
  /** Injected by Irene's dashboard layout */
  userId?: string
}

/**
 * RecentSessions — exported component for Irene's dashboard layout.
 *
 * Usage:
 *   import RecentSessions from '@/components/session/RecentSessions'
 *   <RecentSessions />
 *
 * Stub interface for Nina's health profile:
 *   The session data shape (Session[]) is exported as `SessionData` from @/types
 *   and can be passed to Nina's trend components.
 */
export default function RecentSessions({ userId }: RecentSessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true)
      try {
        const supabase = createClient()

        let query = supabase
          .from('sessions')
          .select('id, user_id, movement_type, timestamp, video_url, scores, detected_issues, rep_count, duration_seconds')
          .order('timestamp', { ascending: false })
          .limit(5)

        if (userId) query = query.eq('user_id', userId)

        const { data, error } = await query
        if (error) throw error
        setSessions((data ?? []) as Session[])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [userId])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-400 font-mono">{error}</p>
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl p-8 text-center">
        <p className="text-sm text-zinc-500">No sessions yet.</p>
        <Link href="/upload" className="text-xs text-purple-400 hover:text-purple-300 mt-2 block transition-colors">
          Upload your first video →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, i) => (
        <SessionCard key={session.id} session={session} index={i} />
      ))}
      <Link
        href="/sessions"
        className="flex items-center justify-center gap-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors pt-2"
      >
        View all sessions <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  )
}
