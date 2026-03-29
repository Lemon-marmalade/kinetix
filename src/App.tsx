import React, { useState, useCallback } from 'react';
import { Results } from '@mediapipe/pose';
import { PoseAnalyzer } from './components/PoseAnalyzer';
import { Skeleton3D } from './components/Skeleton3D';
import { FeedbackPanel } from './components/FeedbackPanel';
import { EXERCISES, ExerciseReference } from './types';
import { Activity, LayoutGrid, Maximize2, Settings, User, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [results, setResults] = useState<Results | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseReference>(EXERCISES[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'focus'>('split');
  const [sessionFrames, setSessionFrames] = useState<Results[]>([]);

  const handleResults = useCallback((res: Results) => {
    setResults(res);
    if (isRecording) {
      setSessionFrames(prev => [...prev, res]);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (!isRecording) setSessionFrames([]); // Clear previous session when starting new
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-6 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold uppercase tracking-widest">PosePerfect AI</h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-tighter">Clinical Motion Analysis v1.0.4</p>
          </div>
        </div>

        <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar py-2">
          {['Dashboard', 'Patients', 'Library', 'Reports'].map((item) => (
            <button 
              key={item} 
              type="button"
              onClick={() => {
                console.log('Tab changed to:', item);
                setActiveTab(item);
              }}
              className={cn(
                "text-[10px] font-mono uppercase tracking-widest transition-all cursor-pointer relative py-2 px-1 min-w-[60px] z-50",
                activeTab === item ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <span className="relative z-10">{item}</span>
              {activeTab === item && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-88px)]">
        {activeTab === 'Dashboard' ? (
          <>
            {/* Left Sidebar: Controls & Selection */}
            <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
              <section>
                <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <LayoutGrid className="w-3 h-3" />
                  Protocol Selection
                </h2>
                <div className="flex flex-col gap-2">
                  {EXERCISES.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelectedExercise(ex)}
                      className={cn(
                        "w-full p-4 rounded-lg border text-left transition-all duration-200 group cursor-pointer relative z-20",
                        selectedExercise.id === ex.id 
                          ? "bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                          : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-mono uppercase tracking-widest">{ex.name}</span>
                        <ChevronRight className={cn(
                          "w-3 h-3 transition-transform",
                          selectedExercise.id === ex.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                        )} />
                      </div>
                      <p className="text-[10px] opacity-60 leading-relaxed truncate">{ex.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-auto">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-4 h-4 text-zinc-500" />
                    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Session Stats</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">Duration</span>
                      <span className="text-xs font-mono text-zinc-300">00:00:00</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">Confidence</span>
                      <span className="text-xs font-mono text-green-500">98.2%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">Repetitions</span>
                      <span className="text-xs font-mono text-zinc-300">0</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Center: Main Viewport */}
            <div className="lg:col-span-6 flex flex-col gap-6 relative z-10">
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={toggleRecording}
                      className={cn(
                        "px-6 py-2 rounded-full text-[10px] font-mono uppercase tracking-widest transition-all cursor-pointer z-30",
                        isRecording 
                          ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]" 
                          : "bg-white hover:bg-zinc-200 text-black"
                      )}
                    >
                      {isRecording ? "Stop Session" : "Start Session"}
                    </button>
                    <div className="h-4 w-[1px] bg-zinc-800" />
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setViewMode('split')}
                        title="Split View"
                        className={cn(
                          "p-2 rounded transition-colors cursor-pointer z-30",
                          viewMode === 'split' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                        )}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => setViewMode('focus')}
                        title="Focus View"
                        className={cn(
                          "p-2 rounded transition-colors cursor-pointer z-30",
                          viewMode === 'focus' ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-400"
                        )}
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest hidden sm:block">
                    Lat: <span className="text-zinc-400">12ms</span> | FPS: <span className="text-zinc-400">30</span>
                  </div>
                </div>

                <div className={cn(
                  "flex-1 grid gap-4 relative group",
                  viewMode === 'split' ? "grid-rows-2" : "grid-rows-1"
                )}>
                  <PoseAnalyzer onResults={handleResults} isRecording={isRecording} />
                  {viewMode === 'split' && <Skeleton3D results={results} />}
                  
                  {/* Viewport Overlay Info */}
                  <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-none z-20">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white">Live Feed</span>
                      </div>
                    </div>
                    
                    {/* Active Protocol Badge */}
                    <div className="px-4 py-2 bg-purple-600/90 backdrop-blur-md border border-purple-400/30 rounded-xl flex items-center gap-3 self-start shadow-xl">
                      <Activity size={14} className="text-white animate-pulse" />
                      <div>
                        <p className="text-[8px] font-mono uppercase tracking-tighter text-purple-200 leading-none mb-1">Active Protocol</p>
                        <p className="text-xs font-bold uppercase tracking-widest text-white leading-none">{selectedExercise.name}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Feedback & Metrics */}
            <div className="lg:col-span-3 overflow-y-auto custom-scrollbar">
              <FeedbackPanel results={results} selectedExercise={selectedExercise} sessionFrames={sessionFrames} />
            </div>
          </>
        ) : (
          <div className="col-span-12 flex flex-col items-center justify-center text-center p-12 bg-zinc-900/20 rounded-3xl border border-zinc-800/50 border-dashed">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
              <Activity className="text-purple-500" size={32} />
            </div>
            <h2 className="text-2xl font-light text-white mb-2">{activeTab} Interface</h2>
            <p className="text-zinc-500 max-w-md mx-auto mb-8">
              This clinical module is currently being synchronized with your patient database. 
              Real-time analysis is available in the Dashboard.
            </p>
            <button 
              type="button"
              onClick={() => setActiveTab('Dashboard')}
              className="px-8 py-3 bg-white text-black rounded-xl transition-all font-mono text-[10px] uppercase tracking-widest hover:bg-zinc-200 cursor-pointer z-50"
            >
              Return to Analysis
            </button>
          </div>
        )}
      </main>

      {/* Background Decoration */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay" />
      </div>
    </div>
  );
}
