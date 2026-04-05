import { NextRequest, NextResponse } from 'next/server'

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'
const API_KEY = process.env.ELEVENLABS_API_KEY ?? process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
  }

  let text: string
  try {
    ;({ text } = await req.json())
    if (!text?.trim()) throw new Error('empty')
  } catch {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.1, use_speaker_boost: true },
      }),
    }
  )

  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '')
    return NextResponse.json({ error: `ElevenLabs error: ${body}` }, { status: upstream.status })
  }

  const audio = await upstream.arrayBuffer()
  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
