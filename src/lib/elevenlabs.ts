export const speakFeedback = async (text: string) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = "pNInz6obpg8ndclQU7nc"; // Using a clear, coaching-style voice

  if (!apiKey) {
    console.warn("ElevenLabs API Key missing. Skipping voice feedback.");
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
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
  }
};