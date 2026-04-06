# Kinetix

Intelligent movement coaching powered by real-time pose analysis.

Kinetix analyzes how you move and delivers instant, actionable feedback to improve form and reduce injury risk — making high-quality movement coaching accessible to everyone.

---

## Inspiration

Movement quality impacts everyone, not just athletes. But access to coaching and physical therapy is often expensive or out of reach. Kinetix was built to democratize movement coaching, giving anyone access to high-quality feedback, anytime.

---

## What It Does

- Analyzes movement from video uploads or live camera input
- Tracks body joints using pose estimation
- Evaluates form using joint angles and biomechanical rules
- Detects inefficient or unsafe movement patterns
- Delivers real-time coaching feedback and suggestions
- Tracks progress and user data with persistent profiles

Kinetix focuses on movement quality, not just motion tracking.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Pose Estimation | MediaPipe Pose |
| Frontend | Next.js, HTML, CSS |
| Backend & Data | Supabase (auth, database, user profiles) |
| AI Prototyping | Google AI Studio |
| Design | Figma |

---

## Challenges

- Handling noisy, real-world pose estimation data
- Reducing false positives in movement analysis
- Building a responsive UI with real-time feedback loops
- Scoping and prioritizing features under hackathon time constraints

---

## Accomplishments

- Built a real-time pose analysis and scoring engine
- Integrated Supabase to handle user auth, profiles, and progress tracking
- Shipped a clean, intuitive UI from scratch
- Delivered a fully functional product within a hackathon timeline

---

## What We Learned

- Working with real-time, imperfect sensor data
- Decomposing complex systems into modular, testable components
- Collaborating effectively under pressure
- Turning an idea into a shippable product end-to-end

---

## What's Next

- Reference-based movement comparison
- Personalized feedback and long-term progress tracking
- Injury risk prediction modeling
- Expansion into rehab, yoga, and general fitness use cases

---

## Goal

Help people move better, train smarter, and stay injury-free.

## How to Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set `ELEVENLABS_API_KEY` in `.env.local` if you want voice playback for the AI coach
4. Optional: set `ELEVENLABS_VOICE_ID` to use a custom ElevenLabs voice
5. Optional: set `MOCK_AI_COACH=true` to bypass Gemini and test the AI Coach UI locally
6. Run the app:
   `npm run dev`

