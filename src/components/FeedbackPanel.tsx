import React, { useMemo, useState} from 'react';
import { Results } from '@mediapipe/pose';
import { ExerciseReference, PoseLandmark } from '@/src/types';
import { AlertCircle, CheckCircle2, Info, MessageSquare, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { GoogleGenAI } from "@google/genai";
import { speakFeedback } from '@/src/lib/elevenlabs';

interface FeedbackPanelProps {
  results: Results | null;
  selectedExercise: ExerciseReference;
  sessionFrames?: Results[];
}

const calculateAngle = (p1: PoseLandmark, p2: PoseLandmark, p3: PoseLandmark) => {
  const ba = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const bc = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
  
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  
  const angle = Math.acos(dot / (magA * magC));
  return (angle * 180) / Math.PI;
};

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ results, selectedExercise, sessionFrames = [] }) => {
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Helper to extract metric keys for a specific landmark set
  const calculateMetrics = (l: PoseLandmark[]) => {
    if (!l || l.length < 33) return null;
    // Map calculations to the specific keys used in ExerciseReference (types.ts)
    return {
      knee_angle: (calculateAngle(l[23], l[25], l[27]) + calculateAngle(l[24], l[26], l[28])) / 2,
      hip_angle: (calculateAngle(l[11], l[23], l[25]) + calculateAngle(l[12], l[24], l[26])) / 2,
      front_knee: calculateAngle(l[23], l[25], l[27]),
      back_knee: calculateAngle(l[24], l[26], l[28]),
      knee_flexion: calculateAngle(l[23], l[25], l[27]),
      shoulder_flexion: calculateAngle(l[23], l[11], l[13]),
      elbow_extension: calculateAngle(l[11], l[13], l[15]),
      hip_hinge: calculateAngle(l[11], l[23], l[25]),
      back_flatness: calculateAngle(l[11], l[23], l[24]),
      knee_valgus: 180 - (Math.abs(l[25].x - l[23].x) * 100),
      cutting_angle: calculateAngle(l[23], l[25], l[27]),
      torso_lean: calculateAngle(l[11], l[23], l[24]),
      symmetry: Math.abs(calculateAngle(l[23], l[25], l[27]) - calculateAngle(l[24], l[26], l[28])),
      knee_stability: 180 - (Math.abs(l[25].x - l[23].x) * 100),
      back_angle: calculateAngle(l[11], l[23], l[24]),
    };
  };

  const angles = useMemo(() => {
    return results?.poseLandmarks ? calculateMetrics(results.poseLandmarks as PoseLandmark[]) : null;
  }, [results]);

  // Detects if the knee is collapsing inward relative to the hip and ankle
  const detectKneeValgus = (l: PoseLandmark[]) => {
    const leftValgus = Math.abs(l[25].x - l[23].x);
    const rightValgus = Math.abs(l[26].x - l[24].x);
    return { leftValgus, rightValgus };
  };

  const getStatus = (angle: number, range: { min: number; max: number }) => {
    if (angle < range.min) return 'low';
    if (angle > range.max) return 'high';
    return 'optimal';
  };

  // Helper to find the "bottom" of a movement (max flexion)
  const findPeakFrame = (frames: Results[]) => {
    if (frames.length === 0) return null;
    
    return frames.reduce((peak, current) => {
      const getFlexionScore = (res: Results) => {
        const l = res.poseLandmarks;
        if (!l) return 0;
        // We calculate simple sum of knee/hip flexion. 
        // Lower angle = more flexion. Score = (180 - angle)
        const knee = (calculateAngle(l[23], l[25], l[27]) + calculateAngle(l[24], l[26], l[28])) / 2;
        const hip = (calculateAngle(l[11], l[23], l[25]) + calculateAngle(l[12], l[24], l[26])) / 2;
        return (180 - knee) + (180 - hip);
      };
      return getFlexionScore(current) > getFlexionScore(peak) ? current : peak;
    });
  };

  const analyzeWithAI = async () => {
    // Prioritize the recorded session if it exists, otherwise use current frame
    const targetResults = sessionFrames.length > 0 ? findPeakFrame(sessionFrames) : results;
    
    if (!targetResults || isAnalyzing) return;
    setIsAnalyzing(true);
    
    const landmarks = targetResults.poseLandmarks as PoseLandmark[];
    if (!landmarks) {
      setAiFeedback("No motion data detected in frame.");
      setIsAnalyzing(false);
      return;
    }

    const valgusData = detectKneeValgus(landmarks);
    const targetMetrics = calculateMetrics(landmarks);

    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

      const promptText = `Act as a world-class sports biomechanics coach. Analyze this ${selectedExercise.name}.
      Context: This is the peak performance frame from a recorded session.
      Landmarks: ${JSON.stringify(landmarks.slice(0, 33).map(l => ({ x: Number(l.x).toFixed(2), y: Number(l.y).toFixed(2), z: Number(l.z).toFixed(2) })))}
      Metrics: Angles=${JSON.stringify(targetMetrics)}, KneeValgusDev=${JSON.stringify(valgusData)}
      Protocol: ${JSON.stringify(selectedExercise.idealAngles)}
      
      Identify injury risks (ACL, ankle, etc.). Provide one concise correction sentence (max 20 words) that can be spoken aloud.`;

      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: promptText }] }]
      });
      
      // Extract text from the Unified SDK response structure
      const feedbackText = response.candidates?.[0]?.content?.parts?.[0]?.text || "No feedback generated.";
      
      setAiFeedback(feedbackText);
      // Trigger ElevenLabs Voice Coaching
      await speakFeedback(feedbackText);

    } catch (error) {
      console.error("Gemini SDK Error Details:", error);
      setAiFeedback(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(selectedExercise.idealAngles).map(([key, range]) => {
          const currentAngle = angles ? (angles as any)[key] || 0 : 0;
          const status = getStatus(currentAngle, range);
          
          return (
            <div key={key} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{range.label}</span>
                {status === 'optimal' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono text-white">{Math.round(currentAngle)}°</span>
                <span className="text-[10px] text-zinc-600 font-mono">/ {range.min}-{range.max}°</span>
              </div>
              <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    status === 'optimal' ? "bg-green-500" : "bg-amber-500"
                  )}
                  style={{ width: `${Math.min(100, (currentAngle / range.max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono text-white uppercase tracking-widest">AI Clinical Analysis</h3>
          </div>
          <button 
            onClick={analyzeWithAI}
            disabled={!results || isAnalyzing}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-[10px] font-mono uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            {isAnalyzing ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto text-zinc-400 text-sm font-light leading-relaxed">
          {aiFeedback ? (
            <div className="bg-zinc-950/50 border border-zinc-800 p-3 rounded italic">
              {aiFeedback}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <MessageSquare className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting data for clinical inference</p>
            </div>
          )}
        </div>
      </div>

      {/* Exercise Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg flex gap-4 items-start">
        <Info className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-mono text-white uppercase tracking-widest mb-1">{selectedExercise.name} Guidance</h4>
          <p className="text-xs text-zinc-500 leading-relaxed">{selectedExercise.description}</p>
        </div>
      </div>
    </div>
  );
};
