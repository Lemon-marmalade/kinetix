import { useState, useEffect } from 'react';
import { GlassCard } from './components/GlassCard';
import { MetricCard } from './components/MetricCard';
import { SkeletalTracking } from './components/SkeletalTracking';
import { PoseAnalyzer } from '../../../PoseAnalyzer';
import { Skeleton3D } from '../../../Skeleton3D';
import { Activity, Target, Zap, TrendingUp } from 'lucide-react';

type HomeSplashProps = {
  onStartWorkout: () => void;
};

function HomeSplash({ onStartWorkout }: HomeSplashProps) {
  return (
    <div className="h-screen w-screen relative overflow-hidden" style={{ background: '#000000' }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 255, 157, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 255, 157, 0.05) 1px, transparent 1px),
            radial-gradient(circle at 20% 20%, rgba(0, 255, 157, 0.08), transparent 80%),
            radial-gradient(circle at 80% 80%, rgba(0, 255, 157, 0.05), transparent 70%)`,
          backgroundSize: '110px 110px, 110px 110px, 400px 400px, 400px 400px',
          opacity: 0.2,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/95 to-black" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
        <div className="mb-4 text-left absolute top-6 left-6 rounded-xl border border-[#00FF9D]/30 bg-[#1A1D23]/90 px-4 py-2 backdrop-blur-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D8E7E5]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00FF9D] animate-pulse shadow-[0_0_10px_rgba(0,255,157,0.65)]" />
            LIVE TRACKING ACTIVE
          </span>
        </div>

        <h1
          className="text-center uppercase"
          style={{
            fontFamily: "'Orbitron', 'HeadLineA', 'Army', 'Impact', 'Arial Black', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(6.5rem, 18vw, 15rem)',
            color: '#00ff8a',
            transform: 'scale(1.02, 0.96)',
            textShadow: '0 0 1.5px rgba(0,255,157,0.65), 0 0 10px rgba(0,255,157,0.7), 0 0 24px rgba(0,255,157,0.5)',
            WebkitTextStroke: '1.6px rgba(0, 255, 157, 0.5)',
            letterSpacing: '0em',
            filter: 'drop-shadow(0 0 14px rgba(0,255,157,0.45))',
          }}
        >
          KINETIX
        </h1>

        <p
          className="mt-4 text-lg md:text-xl text-[#94A3B8] tracking-wide"
          style={{ fontFamily: "'Tiro Tamil', serif", maxWidth: '42rem' }}
        >
          AI-Powered Motion Analysis System
        </p>

        <button
          onClick={onStartWorkout}
          className="mt-12 px-14 py-5 rounded-2xl font-black uppercase tracking-wider text-black text-xl md:text-2xl transition-all duration-300"
          style={{
            fontFamily: "'Tiro Tamil', serif",
            background: 'linear-gradient(135deg, #00FF9D, #03CFAE)',
            boxShadow: '0 0 30px rgba(0,255,157,0.4), 0 0 60px rgba(0,255,157,0.25), 0 0 120px rgba(0,255,157,0.12)',
            color: '#020a03',
            textShadow: '0 0 12px rgba(0,255,157,0.6)',
            border: '1px solid rgba(0,255,157,0.5)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          START WORKOUT
        </button>
      </div>
    </div>
  );
}

function App() {
  const [homeActive, setHomeActive] = useState(true);
  const [heartRate, setHeartRate] = useState(142);
  const [calories, setCalories] = useState(387);
  const [duration, setDuration] = useState(1247);
  const [isRecording, setIsRecording] = useState(false);
  const [results, setResults] = useState<import('@mediapipe/pose').Results | null>(null);

  // Simulate live data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartRate((prev) => prev + (Math.random() - 0.5) * 4);
      setCalories((prev) => prev + Math.random() * 2);
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (homeActive) {
    return <HomeSplash onStartWorkout={() => { setHomeActive(false); setIsRecording(true); }} />;
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0f 0%, #151520 50%, #0a0a0f 100%)',
        fontFamily: "'Tiro Tamil', serif",
      }}
    >
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #00ff88 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 136, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 136, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 p-8 max-w-[1800px] mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1
              className="text-7xl font-bold mb-2"
              style={{
                fontFamily: "'HeadLineA', 'Impact', 'Arial Black', sans-serif",
                background: 'linear-gradient(135deg, #00ff88 0%, #00ffdd 50%, #00ff88 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '0 0 40px rgba(0, 255, 136, 0.5), 0 0 80px rgba(0, 255, 136, 0.3)',
                filter: 'drop-shadow(0 0 20px rgba(0, 255, 136, 0.6))',
              }}
            >
              KINETIX
            </h1>
            <p className="text-white/60 tracking-wide" style={{ fontFamily: "'Tiro Tamil', serif" }}>
              AI-POWERED MOTION ANALYSIS SYSTEM
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                background: isRecording
                  ? 'linear-gradient(135deg, #f83600 0%, #f9d423 100%)'
                  : 'linear-gradient(135deg, #00ff88 0%, #00cc6e 100%)',
                boxShadow: isRecording
                  ? '0 0 20px rgba(248, 54, 0, 0.4), 0 10px 30px rgba(0, 0, 0, 0.3)'
                  : '0 0 20px rgba(0, 255, 136, 0.4), 0 10px 30px rgba(0, 0, 0, 0.3)',
                color: '#0a0a0f',
                fontFamily: "'Tiro Tamil', serif",
              }}
              onClick={() => setIsRecording((prev) => !prev)}
            >
              {isRecording ? 'STOP WORKOUT' : 'START WORKOUT'}
            </button>
            <button
<<<<<<< HEAD

              onClick={() => setShowHealthProfile(true)}
              className="px-6 py-3 rounded-xl font-semibold border-2 border-blue-400 text-blue-300 hover:bg-blue-500/20 transition duration-300"
            >
              Health Profile
            </button>

>>>>>>> 4cd930e (Remove unnecessary PAUSE button)
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Stats */}
          <div className="col-span-3 space-y-6">
            {/* Heart Rate */}
            <GlassCard className="p-6">
              <MetricCard
                label="Heart Rate"
                value={Math.round(heartRate).toString()}
                unit="BPM"
                trend="up"
                trendValue="+2.4%"
                icon="❤️"
              />
              <div className="mt-4 h-16 flex items-end gap-1 transition-all duration-[2000ms] ease-in-out">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t transition-all duration-[2000ms] ease-in-out"
                    style={{
                      height: `${34 + Math.sin((i + duration) * 0.18) * 8 + Math.random() * 8}%`,
                      background: 'linear-gradient(to top, #00ff88, #00ffdd)',
                      opacity: 0.75 + i * 0.01,
                    }}
                  />
                ))}
              </div>
            </GlassCard>

            {/* Calories */}
            <GlassCard className="p-6">
              <MetricCard
                label="Calories Burned"
                value={Math.round(calories).toString()}
                unit="KCAL"
                trend="up"
                trendValue="+15"
                icon="🔥"
              />
              <div className="mt-4 relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(calories / 500) * 100}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #00ff88)',
                    boxShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
                  }}
                />
              </div>
              <p className="mt-2 text-white/50 text-sm" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                Goal: 500 KCAL
              </p>
            </GlassCard>

            {/* Form Score */}
            <GlassCard className="p-6">
              <MetricCard
                label="Form Quality"
                value="94"
                unit="%"
                trend="up"
                trendValue="Excellent"
                icon="⭐"
              />
              <div className="mt-4 space-y-2">
                {['Posture', 'Balance', 'Alignment'].map((item, i) => (
                  <div key={item} className="flex items-center justify-between text-sm">
                    <span className="text-white/60" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      {item}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="w-2 h-2 rounded-full"
                          style={{
                            background: idx < 4 - i * 0.5 ? '#00ff88' : 'rgba(255, 255, 255, 0.2)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Center - Camera Feed */}
          <div className="col-span-6 space-y-6">
            <GlassCard className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Live Pose Tracker</h2>
                <span className="text-xs text-white/70 rounded-full px-3 py-1" style={{ background: 'rgba(15, 23, 42, 0.55)' }}>
                  {isRecording ? 'Recording' : 'Standby'}
                </span>
              </div>
              <PoseAnalyzer onResults={setResults} isRecording={isRecording} />
            </GlassCard>

            <GlassCard className="p-4">
              <h2 className="text-lg font-bold text-white mb-4">3D Skeleton (real-time)</h2>
              <div className="h-[420px]">
                <Skeleton3D results={results} />
              </div>
            </GlassCard>

            {/* Exercise Info */}
            <div className="grid grid-cols-3 gap-4">
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00ff88]/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-[#00ff88]" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      Exercise
                    </p>
                    <p className="text-white font-semibold" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      Squats
                    </p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#3b82f6]" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      Reps
                    </p>
                    <p className="text-white font-semibold" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      24 / 30
                    </p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00ff88]/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-[#00ff88]" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      Duration
                    </p>
                    <p className="text-white font-semibold" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      {formatTime(duration)}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Right Sidebar - Analysis */}
          <div className="col-span-3 space-y-6">
            {/* Movement Analysis */}
            <GlassCard className="p-6">
              <h3
                className="text-white font-semibold mb-4 flex items-center gap-2"
                style={{ fontFamily: "'Tiro Tamil', serif" }}
              >
                <TrendingUp className="w-5 h-5 text-[#00ff88]" />
                Movement Analysis
              </h3>
              <div className="space-y-4">
                {[
                  { joint: 'Knee Angle', value: 87, optimal: 90, status: 'good' },
                  { joint: 'Hip Depth', value: 92, optimal: 90, status: 'excellent' },
                  { joint: 'Back Position', value: 78, optimal: 85, status: 'warning' },
                ].map((item) => (
                  <div key={item.joint}>
                    <div className="flex justify-between mb-1">
                      <span className="text-white/80 text-sm" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                        {item.joint}
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: item.status === 'excellent' ? '#00ff88' : item.status === 'good' ? '#3b82f6' : '#ff6b6b',
                          fontFamily: "'Tiro Tamil', serif",
                        }}
                      >
                        {item.value}°
                      </span>
                    </div>
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                        style={{
                          width: `${(item.value / 100) * 100}%`,
                          background:
                            item.status === 'excellent'
                              ? 'linear-gradient(90deg, #00ff88, #00ffdd)'
                              : item.status === 'good'
                              ? 'linear-gradient(90deg, #3b82f6, #00ff88)'
                              : 'linear-gradient(90deg, #ff6b6b, #ff9f6b)',
                          boxShadow: `0 0 10px ${item.status === 'excellent' ? '#00ff88' : item.status === 'good' ? '#3b82f6' : '#ff6b6b'}`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* AI Insights */}
            <GlassCard className="p-6">
              <h3
                className="text-white font-semibold mb-4"
                style={{ fontFamily: "'Tiro Tamil', serif" }}
              >
                AI Insights
              </h3>
              <div className="space-y-3">
                {[
                  { type: 'success', text: 'Excellent depth consistency' },
                  { type: 'info', text: 'Maintain chest up position' },
                  { type: 'warning', text: 'Knee tracking could improve' },
                ].map((insight, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5"
                      style={{
                        background:
                          insight.type === 'success' ? '#00ff88' : insight.type === 'info' ? '#3b82f6' : '#ff9f6b',
                        boxShadow: `0 0 8px ${insight.type === 'success' ? '#00ff88' : insight.type === 'info' ? '#3b82f6' : '#ff9f6b'}`,
                      }}
                    />
                    <p className="text-white/70 text-sm" style={{ fontFamily: "'Tiro Tamil', serif" }}>
                      {insight.text}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Weekly Progress */}
            <GlassCard className="p-6">
              <h3
                className="text-white font-semibold mb-4"
                style={{ fontFamily: "'Tiro Tamil', serif" }}
              >
                Weekly Progress
              </h3>
              <div className="flex items-end justify-between h-32 gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t-lg transition-all duration-300"
                        style={{
                          height: `${[60, 75, 85, 70, 90, 65, 80][i]}%`,
                          background:
                            i === 6
                              ? 'linear-gradient(to top, #00ff88, #00ffdd)'
                              : 'linear-gradient(to top, #3b82f6, #5b9cf6)',
                          opacity: i === 6 ? 1 : 0.5,
                          boxShadow: i === 6 ? '0 0 20px rgba(0, 255, 136, 0.5)' : 'none',
                        }}
                      />
                    </div>
                    <span
                      className="text-xs text-white/50"
                      style={{ fontFamily: "'Tiro Tamil', serif" }}
                    >
                      {day}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
