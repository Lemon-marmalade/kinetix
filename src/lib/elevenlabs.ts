export const speakFeedback = async (text: string) => {
  // In Next.js client components, use NEXT_PUBLIC_ prefix
  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
  const voiceId = "pNInz6obpg8ndclQU7nc"; // A clear, authoritative coaching voice

  if (!apiKey || apiKey === "undefined") {
    console.warn("ElevenLabs API Key missing in environment variables. Skipping voice feedback.");
    return;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!response.ok) throw new Error('ElevenLabs API request failed');

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
  }
};
