import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Session } from '@/types'
import SessionDetailClient from './SessionDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !session) notFound()

  return <SessionDetailClient session={session as Session} />
}
