// Voice coach — uses ElevenLabs TTS, falls back to Web Speech API if unavailable.

import { speak as elevenSpeak, preload, stop as elevenStop } from '@/lib/elevenlabs/tts'

// --- Web Speech API fallback ---
function wsFallback(text: string, interrupt = false) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  if (interrupt) window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.92; u.pitch = 1.05; u.volume = 0.9
  const voices = window.speechSynthesis.getVoices()
  const preferred = ['Samantha','Karen','Google US English','Microsoft Aria','Microsoft Jenny']
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name) && v.lang.startsWith('en'))
    if (v) { u.voice = v; break }
  }
  window.speechSynthesis.speak(u)
}

let useElevenLabs = true // flipped to false on first fetch failure

async function speak(text: string, interrupt = false) {
  if (!useElevenLabs) { wsFallback(text, interrupt); return }
  try {
    await elevenSpeak(text, interrupt)
  } catch {
    useElevenLabs = false
    wsFallback(text, interrupt)
  }
}

// --- Coach content ---

const REP_ENCOURAGEMENT = [
  'Nice one, keep that rhythm going.',
  'Good rep, stay controlled on the way down.',
  'Looking solid, maintain that depth.',
  'Good form, breathe out at the top.',
  'Keep that chest up and stay with it.',
  'That one was clean, great work.',
]

const MILESTONE_MESSAGES: Record<number, string> = {
  5:  'Five reps in. Great start, keep it steady.',
  10: 'Ten reps. You are building real momentum now.',
  15: 'Fifteen. Impressive consistency.',
  20: 'Twenty reps. That is outstanding effort.',
}

const ISSUE_CUES: Record<string, string> = {
  knee_valgus:         'Drive your knees out, keep them in line with your toes.',
  hip_drop:            'Keep those hips level and squeeze your glutes.',
  torso_instability:   'Brace your core and stand tall.',
  ankle_eversion:      'Press through the whole foot, avoid rolling in.',
  stiff_landing:       'Soft landing. Let your knees and hips absorb the impact.',
  shallow_squat_depth: 'Try to go a little deeper, aim for parallel.',
  forward_trunk_lean:  'Chest up, keep your torso more upright.',
  rounded_back:        'Neutral spine. Pull your shoulders back gently.',
}

const IDLE_PROMPTS = [
  'Keep your form dialed in.',
  'Nice rhythm. Remember to breathe out on the effort.',
  'You are doing great. Stay present.',
  'Control the full range of motion. Do not rush it.',
]

const PRELOAD_TEXTS = [
  ...REP_ENCOURAGEMENT,
  ...Object.values(MILESTONE_MESSAGES),
  ...Object.values(ISSUE_CUES),
  ...IDLE_PROMPTS,
]

let spokenIssues = new Set<string>()
let lastEncouragementIdx = 0
let idleMessagesSent = 0
let lastIdleAt = 0

export const voiceCoach = {
  onStart(movement: string) {
    spokenIssues = new Set()
    lastEncouragementIdx = 0
    idleMessagesSent = 0
    lastIdleAt = Date.now()
    useElevenLabs = true // reset per session in case previous session had a failure
    const label = movement.replace(/_/g, ' ')
    const intro = `Alright, let's work on your ${label}. Get into position when you are ready.`
    // Pre-fetch all common phrases in background — they will play instantly when needed
    preload([intro, ...PRELOAD_TEXTS])
    speak(intro, true).catch(() => {})
  },

  onRep(repCount: number, depthScore: number) {
    const milestone = MILESTONE_MESSAGES[repCount]
    if (milestone) { speak(milestone).catch(() => {}); return }
    if (depthScore < 45) { speak('Try to sink a bit deeper on the next one.').catch(() => {}); return }
    const msg = REP_ENCOURAGEMENT[lastEncouragementIdx % REP_ENCOURAGEMENT.length]
    lastEncouragementIdx++
    speak(msg).catch(() => {})
  },

  onIssue(issueType: string) {
    if (spokenIssues.has(issueType)) return
    const cue = ISSUE_CUES[issueType]
    if (!cue) return
    spokenIssues.add(issueType)
    speak(cue).catch(() => {})
  },

  onIdle() {
    const now = Date.now()
    if (now - lastIdleAt < 10000) return
    lastIdleAt = now
    speak(IDLE_PROMPTS[idleMessagesSent % IDLE_PROMPTS.length]).catch(() => {})
    idleMessagesSent++
  },

  onStop(repCount: number) {
    const repWord = repCount === 1 ? 'rep' : 'reps'
    const outro = repCount > 0
      ? `Session done. You completed ${repCount} ${repWord}. Really solid work today.`
      : `Session done. You completed ${repCount} ${repWord}. Let's reset and try another set when you're ready.`
    speak(outro, true).catch(() => {})
  },

  stop() {
    elevenStop()
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
  },
}
