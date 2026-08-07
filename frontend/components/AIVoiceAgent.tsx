// ============================================================================
// FILE: frontend/components/AIVoiceAgent.tsx
// Deskripsi: Komponen Antarmuka Operator Suara AI Interaktif (JARVIS Voice Agent).
//            Menampilkan efek bola animasi Orb 3D 6-Status (Siap, Menghubungkan,
//            Mendengarkan, Berpikir, Berbicara, Error) dengan indikator Visualizer Gelombang Suara,
//            serta mengintegrasikan `useVoiceAgent` & `useVoiceCommands`.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, PhoneOff, Wifi, WifiOff, Volume2, Settings, Play, Sliders, Hand } from 'lucide-react';
import { useVoiceAgent, VoiceAgentStatus } from '@/hooks/useVoiceAgent';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';

// ═══════════════════════════════════════════════════════════════════════════════
// AI Voice Agent — Real-time conversational AI operator
// ═══════════════════════════════════════════════════════════════════════════════

interface AIVoiceAgentProps {
  onClose: () => void;
}

// Status labels in Indonesian
const STATUS_LABELS: Record<VoiceAgentStatus, string> = {
  idle: 'Siap',
  connecting: 'Menghubungkan...',
  listening: 'Mendengarkan...',
  processing: 'Berpikir...',
  speaking: 'Berbicara...',
  error: 'Error',
};

// Status colors for the orb
const STATUS_COLORS: Record<VoiceAgentStatus, { primary: string; glow: string; bg: string }> = {
  idle: { primary: 'from-slate-500 to-slate-600', glow: 'shadow-slate-500/20', bg: 'bg-slate-500/10' },
  connecting: { primary: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/30', bg: 'bg-amber-500/10' },
  listening: { primary: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/40', bg: 'bg-blue-500/10' },
  processing: { primary: 'from-violet-500 to-purple-500', glow: 'shadow-violet-500/40', bg: 'bg-violet-500/10' },
  speaking: { primary: 'from-emerald-400 to-teal-500', glow: 'shadow-emerald-500/40', bg: 'bg-emerald-500/10' },
  error: { primary: 'from-red-500 to-rose-500', glow: 'shadow-red-500/30', bg: 'bg-red-500/10' },
};

export function AIVoiceAgent({ onClose }: AIVoiceAgentProps) {
  const { executeCommand, getAppState } = useVoiceCommands();
  const {
    status,
    transcript,
    aiResponse,
    conversationHistory,
    audioLevel,
    isConnected,
    error,
    startSession,
    endSession,
    isSupported,
    voices,
    settings,
    updateSettings,
    testVoice,
    interruptAI,
  } = useVoiceAgent(executeCommand, getAppState);

  const [showSettings, setShowSettings] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll conversation
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, transcript, aiResponse]);

  // Auto-start session on mount
  useEffect(() => {
    if (isSupported && status === 'idle') {
      startSession();
    }
  }, []);

  const handleClose = () => {
    endSession();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
          onClick={handleClose}
        />

        {/* Main Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[420px] max-h-[85vh] bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected || status !== 'idle' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {isConnected || status !== 'idle' ? 'JARVIS AI VOICE' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`}
                title="Pengaturan Suara & Model TTS"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ─── Voice Settings Panel Overlay ─── */}
          {showSettings ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/90 backdrop-blur-md"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  Pengaturan Suara AI
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-xs text-blue-400 hover:underline font-medium"
                >
                  Selesai
                </button>
              </div>

              {/* Speech Engine Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Mesin Suara (Speech Engine):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ engine: 'elevenlabs' })}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      settings.engine === 'elevenlabs'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ✨ ElevenLabs (Hiper-Realistis)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ engine: 'browser' })}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      settings.engine === 'browser'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    🌐 Browser Neural TTS
                  </button>
                </div>
              </div>

              {/* ElevenLabs Settings */}
              {settings.engine === 'elevenlabs' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Karakter Suara ElevenLabs:</label>
                  <select
                    value={settings.elevenLabsVoiceId}
                    onChange={(e) => updateSettings({ elevenLabsVoiceId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="pNInz6obpgDQGcFmaJgB">🎙️ Adam (JARVIS - Deep & Calm Male)</option>
                    <option value="ErXwobaYiN019PkySvjV">🎙️ Antoni (Natural Conversational Male)</option>
                    <option value="21m00Tcm4TlvDq8ikWAM">🎙️ Rachel (Clear & Professional Female)</option>
                    <option value="JBFqnCBsd6RMkjVDRZzb">🎙️ George (Warm British Male)</option>
                  </select>
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                    ⚡ ElevenLabs Active (API Key connected)
                  </p>
                </div>
              ) : (
                /* Model / Voice Dropdown */
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pilih Suara Browser (TTS Voice):</label>
                  <select
                    value={settings.voiceURI}
                    onChange={(e) => updateSettings({ voiceURI: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {voices.length === 0 && <option value="">Suara Default System</option>}
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 Tips: Pilih suara bertanda <span className="text-emerald-400 font-semibold">Natural</span> atau <span className="text-blue-400 font-semibold">Online</span>.
                  </p>
                </div>
              )}

              {/* Speed / Rate Slider */}
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-300 mb-1">
                  <span>Kecepatan Bicara (Speed):</span>
                  <span className="text-blue-400 font-bold">{settings.rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={settings.rate}
                  onChange={(e) => updateSettings({ rate: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Pitch Slider */}
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-slate-300 mb-1">
                  <span>Nada Suara (Pitch):</span>
                  <span className="text-blue-400 font-bold">{settings.pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={settings.pitch}
                  onChange={(e) => updateSettings({ pitch: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Test Voice Button */}
              <div className="pt-2">
                <button
                  onClick={testVoice}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
                  Tes Suara AI
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* ─── Animated Orb ─── */}
              <div className="flex flex-col items-center py-5 px-5 cursor-pointer" onClick={() => status === 'speaking' && interruptAI()}>
                <VoiceOrb status={status} audioLevel={audioLevel} />

                {/* Status Label */}
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center gap-2"
                >
                  <StatusIcon status={status} />
                  <span className={`text-sm font-semibold tracking-wide ${
                    status === 'error' ? 'text-red-400' :
                    status === 'speaking' ? 'text-emerald-400' :
                    status === 'listening' ? 'text-blue-400' :
                    status === 'processing' ? 'text-violet-400' :
                    'text-slate-400'
                  }`}>
                    {STATUS_LABELS[status]}
                  </span>
                </motion.div>

                {/* Barge-in Hint when AI is Speaking */}
                {status === 'speaking' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={interruptAI}
                    className="mt-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-[11px] font-medium text-amber-300 flex items-center gap-1.5 cursor-pointer hover:bg-amber-500/20 transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Bicara / Sentuh untuk potong AI
                  </motion.div>
                )}

                {/* Live Transcript */}
                {transcript && status === 'listening' && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 text-sm text-slate-300 text-center italic px-4 max-w-[90%] line-clamp-2"
                  >
                    "{transcript}"
                  </motion.p>
                )}

                {/* AI Response Preview */}
                {aiResponse && (status === 'speaking' || status === 'processing') && (
                  <motion.p
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-sm text-slate-200 text-center px-4 max-w-[90%] line-clamp-3 leading-relaxed"
                  >
                    {aiResponse}
                  </motion.p>
                )}

                {/* Error */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 text-xs text-red-400 text-center px-4"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Not Supported */}
                {!isSupported && (
                  <p className="mt-3 text-xs text-amber-400 text-center px-4">
                    Browser Anda tidak mendukung Speech Recognition. Gunakan Chrome atau Edge.
                  </p>
                )}
              </div>

              {/* ─── Conversation History ─── */}
              <div className="flex-1 min-h-0 px-4 pb-2 overflow-hidden">
                <div className="h-full max-h-[180px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {conversationHistory.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600/20 text-blue-200 border border-blue-500/20 rounded-tr-sm'
                          : msg.functionCall
                            ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20 rounded-tl-sm'
                            : 'bg-slate-800/60 text-slate-300 border border-slate-700/40 rounded-tl-sm'
                      }`}>
                        {msg.functionCall && (
                          <span className="text-[10px] font-mono text-violet-400 block mb-0.5">
                            ⚡ {msg.functionCall.name}
                          </span>
                        )}
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={historyEndRef} />
                </div>
              </div>

              {/* ─── Controls ─── */}
              <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-slate-800/40">
                {status === 'idle' || status === 'error' ? (
                  <button
                    onClick={startSession}
                    disabled={!isSupported}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mic className="w-4 h-4" />
                    Mulai Bicara
                  </button>
                ) : (
                  <>
                    {status === 'speaking' && (
                      <button
                        onClick={interruptAI}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 text-xs font-semibold rounded-2xl border border-amber-500/40 shadow-lg transition-all active:scale-95"
                        title="Potong pembicaraan AI sekarang"
                      >
                        <Hand className="w-3.5 h-3.5" />
                        Potong AI
                      </button>
                    )}
                    <button
                      onClick={handleClose}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold rounded-2xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      Akhiri
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Voice Orb Visualizer ───────────────────────────────────────────────────

function VoiceOrb({ status, audioLevel }: { status: VoiceAgentStatus; audioLevel: number }) {
  const colors = STATUS_COLORS[status];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  // Smooth audio level
  const smoothLevelRef = useRef(0);
  smoothLevelRef.current += (audioLevel - smoothLevelRef.current) * 0.15;
  const level = smoothLevelRef.current;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const size = 160;
    canvas.width = size * 2;
    canvas.height = size * 2;
    const center = size;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phaseRef.current += 0.02;

      const baseRadius = 50;
      const levelBoost = level * 25;

      // Outer glow rings
      for (let ring = 3; ring >= 1; ring--) {
        const ringRadius = baseRadius + levelBoost + ring * 12 + Math.sin(phaseRef.current + ring) * 3;
        const alpha = (0.08 - ring * 0.02) + level * 0.1;

        ctx.beginPath();
        ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = getStatusColor(status, alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Main orb with animated deformation
      const points = 64;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noiseA = Math.sin(angle * 3 + phaseRef.current * 2) * (3 + level * 12);
        const noiseB = Math.cos(angle * 5 + phaseRef.current * 1.5) * (2 + level * 8);
        const noiseC = Math.sin(angle * 7 + phaseRef.current * 3) * (1 + level * 5);

        let r = baseRadius + levelBoost + noiseA + noiseB + noiseC;

        // Processing: spin effect
        if (status === 'processing') {
          r += Math.sin(angle * 2 + phaseRef.current * 4) * 6;
        }

        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Gradient fill
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, baseRadius + levelBoost + 20);
      gradient.addColorStop(0, getStatusColor(status, 0.9));
      gradient.addColorStop(0.7, getStatusColor(status, 0.5));
      gradient.addColorStop(1, getStatusColor(status, 0.1));
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(center - 12, center - 12, baseRadius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status, level]);

  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Ambient glow */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.primary} opacity-20 blur-2xl scale-125 transition-all duration-700 ${
        status === 'listening' || status === 'speaking' ? 'animate-pulse' : ''
      }`} />

      {/* Canvas orb */}
      <canvas
        ref={canvasRef}
        className="w-40 h-40"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}

// ─── Status Icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: VoiceAgentStatus }) {
  const iconClass = 'w-3.5 h-3.5';
  switch (status) {
    case 'listening': return <Mic className={`${iconClass} text-blue-400 animate-pulse`} />;
    case 'processing': return <div className={`${iconClass} border-2 border-violet-400 border-t-transparent rounded-full animate-spin`} />;
    case 'speaking': return <Volume2 className={`${iconClass} text-emerald-400`} />;
    case 'connecting': return <Wifi className={`${iconClass} text-amber-400 animate-pulse`} />;
    case 'error': return <WifiOff className={`${iconClass} text-red-400`} />;
    default: return <MicOff className={`${iconClass} text-slate-500`} />;
  }
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

function getStatusColor(status: VoiceAgentStatus, alpha: number): string {
  const colors: Record<VoiceAgentStatus, [number, number, number]> = {
    idle: [100, 116, 139],
    connecting: [245, 158, 11],
    listening: [59, 130, 246],
    processing: [139, 92, 246],
    speaking: [52, 211, 153],
    error: [239, 68, 68],
  };
  const [r, g, b] = colors[status];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
