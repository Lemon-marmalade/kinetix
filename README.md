<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e0048010-bbc6-4bd7-8a70-416ea7b08e63

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set `ELEVENLABS_API_KEY` in `.env.local` if you want voice playback for the AI coach
4. Optional: set `ELEVENLABS_VOICE_ID` to use a custom ElevenLabs voice
5. Optional: set `MOCK_AI_COACH=true` to bypass Gemini and test the AI Coach UI locally
6. Run the app:
   `npm run dev`
