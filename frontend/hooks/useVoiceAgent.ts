import { useCallback, useRef, useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// useVoiceAgent — Ultra-Responsive Voice Agent (ChatGPT VoiceMode Style)
// - Instant Audio-Level Barge-In (Cut off AI speech in <50ms)
// - Sentence Chunking Queue (Zero-delay speech cancellation)
// - Smart Neural Voice Auto-Filter (Prioritizes Natural Neural Voices)
// - Ultra-Short Conversational Persona (1 short natural sentence)
// ═══════════════════════════════════════════════════════════════════════════════

export type VoiceAgentStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface FunctionCallMessage {
  name: string;
  args: Record<string, unknown>;
}

export interface VoiceSettings {
  engine: 'elevenlabs' | 'browser';
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  voiceURI: string;
  rate: number;
  pitch: number;
}

export interface VoiceAgentState {
  status: VoiceAgentStatus;
  transcript: string;
  aiResponse: string;
  conversationHistory: ConversationMessage[];
  audioLevel: number;
  isConnected: boolean;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  settings: VoiceSettings;
}

interface UseVoiceAgentReturn extends VoiceAgentState {
  startSession: () => void;
  endSession: () => void;
  isSupported: boolean;
  updateSettings: (newSettings: Partial<VoiceSettings>) => void;
  testVoice: () => void;
  interruptAI: () => void;
}

// WebSocket message types
interface WSMessage {
  type: string;
  data?: unknown;
}

const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const DEFAULT_SETTINGS: VoiceSettings = {
  engine: 'elevenlabs',
  elevenLabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_9ae15c6cdca7139e2190eaa687878fb06bdbf23a9734885a',
  elevenLabsVoiceId: import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam (JARVIS)
  voiceURI: '',
  rate: 1.05,
  pitch: 1.0,
};

export function useVoiceAgent(
  onFunctionCall?: (name: string, args: Record<string, unknown>) => Promise<{ success: boolean; result: string }>,
  getAppState?: () => Record<string, unknown>,
): UseVoiceAgentReturn {
  const [status, setStatus] = useState<VoiceAgentStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback((newStatus: VoiceAgentStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
  }, []);

  // Voice settings state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem('utt_voice_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const isBargeInRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const isProcessingRef = useRef(false);
  const aiResponseRef = useRef('');
  const useHttpFallbackRef = useRef(false);
  const conversationHistoryRef = useRef<ConversationMessage[]>([]);
  const settingsRef = useRef(settings);
  const statusRef = useRef(status);

  // Sentence Chunk Queue for instant interruption
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingChunkRef = useRef(false);
  const startListeningRef = useRef<(() => void) | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const lastSpeechTextRef = useRef('');

  // Keep refs synced
  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  useEffect(() => {
    settingsRef.current = settings;
    try {
      localStorage.setItem('utt_voice_settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const isSupported = !!SpeechRecognitionAPI && 'speechSynthesis' in window;

  // ─── Load Available Voices (Filter for Natural Neural Voices) ─────────
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        // Filter out ancient robotic desktop voices if modern ones exist
        const sorted = [...available].sort((a, b) => {
          const aIsNatural = a.name.includes('Natural') || a.name.includes('Google') || a.name.includes('Online');
          const bIsNatural = b.name.includes('Natural') || b.name.includes('Google') || b.name.includes('Online');
          if (aIsNatural && !bIsNatural) return -1;
          if (!aIsNatural && bIsNatural) return 1;
          return 0;
        });

        setVoices(sorted);

        // Auto select best Indonesian natural voice if no voiceURI selected
        if (!settings.voiceURI) {
          const idNaturalVoice = sorted.find(v => (v.lang.startsWith('id') || v.lang.startsWith('ms')) && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google'))) ||
                                sorted.find(v => v.lang.startsWith('id') || v.lang.startsWith('ms')) ||
                                sorted[0];
          if (idNaturalVoice) {
            setSettings(prev => ({ ...prev, voiceURI: idNaturalVoice.voiceURI }));
          }
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // ─── Audio Level Monitoring & Instant Volume Interruption ───────────
  const startAudioLevelMonitor = useCallback(async () => {
    try {
      if (audioStreamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setAudioLevel(avg);

        // ⚡ INSTANT VOLUME BARGE-IN: If user speaks into mic (volume > 0.18) while AI is speaking
        if (statusRef.current === 'speaking' && avg > 0.18) {
          stopSpeaking();
          if (!useHttpFallbackRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            sendWSMessage({ type: 'barge_in' });
          }
          updateStatus('listening');
        }

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error('Failed to start audio monitor:', err);
    }
  }, []);

  const stopAudioLevelMonitor = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // ─── Chunked TTS Queue for 0ms Interruption ─────────────────────────
  const speakNextChunk = useCallback(() => {
    if (speechQueueRef.current.length === 0 || isBargeInRef.current) {
      isSpeakingChunkRef.current = false;
      if (!isBargeInRef.current && sessionActiveRef.current) {
        isProcessingRef.current = false;
        updateStatus('listening');
        setTranscript('');
        startListeningRef.current?.();
      }
      return;
    }

    const nextChunk = speechQueueRef.current.shift();
    if (!nextChunk) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(nextChunk);
    utterance.lang = 'id-ID';
    utterance.rate = settingsRef.current.rate;
    utterance.pitch = settingsRef.current.pitch;
    utterance.volume = 1.0;

    const availableVoices = window.speechSynthesis.getVoices();
    let chosenVoice: SpeechSynthesisVoice | undefined;

    if (settingsRef.current.voiceURI) {
      chosenVoice = availableVoices.find(v => v.voiceURI === settingsRef.current.voiceURI);
    }

    if (!chosenVoice) {
      chosenVoice = availableVoices.find(v => (v.lang.startsWith('id') || v.lang.startsWith('ms')) && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google'))) ||
                    availableVoices.find(v => v.lang.startsWith('id') || v.lang.startsWith('ms')) ||
                    availableVoices[0];
    }

    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onstart = () => {
      updateStatus('speaking');
      isSpeakingChunkRef.current = true;
      // Start listening in background for audio barge-in
      setTimeout(() => {
        if (sessionActiveRef.current) {
          startListeningRef.current?.();
        }
      }, 50);
    };

    utterance.onend = () => {
      if (isBargeInRef.current) return;
      speakNextChunk();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('TTS Chunk error:', e.error);
      }
      if (isBargeInRef.current) return;
      speakNextChunk();
    };

    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);

  const speakElevenLabs = useCallback(async (text: string): Promise<boolean> => {
    const apiKey = settingsRef.current.elevenLabsApiKey || import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_9ae15c6cdca7139e2190eaa687878fb06bdbf23a9734885a';
    const voiceId = settingsRef.current.elevenLabsVoiceId || import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

    if (!apiKey) return false;

    try {
      const cleanText = text.replace(/[*#`_\-]/g, '').trim();
      if (!cleanText) return true;

      if (elevenLabsAudioRef.current) {
        elevenLabsAudioRef.current.pause();
        elevenLabsAudioRef.current = null;
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        console.warn('ElevenLabs API returned status:', response.status);
        return false;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      elevenLabsAudioRef.current = audio;

      audio.onplay = () => {
        updateStatus('speaking');
        isSpeakingChunkRef.current = true;
        setTranscript('');
      };

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        elevenLabsAudioRef.current = null;
        isSpeakingChunkRef.current = false;
        if (sessionActiveRef.current) {
          isProcessingRef.current = false;
          updateStatus('listening');
          setTranscript('');
          stopListeningRef.current?.();
          setTimeout(() => {
            if (sessionActiveRef.current) startListeningRef.current?.();
          }, 200);
        }
      };

      audio.onerror = (e) => {
        console.error('ElevenLabs Audio Error:', e);
        elevenLabsAudioRef.current = null;
        isSpeakingChunkRef.current = false;
        isProcessingRef.current = false;
        if (sessionActiveRef.current) {
          updateStatus('listening');
          setTranscript('');
          stopListeningRef.current?.();
          setTimeout(() => {
            if (sessionActiveRef.current) startListeningRef.current?.();
          }, 200);
        }
      };

      await audio.play();
      return true;
    } catch (err) {
      console.error('ElevenLabs speech error:', err);
      return false;
    }
  }, []);

  const speakWebSpeech = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    const cleanText = text.replace(/[*#`_\-]/g, '').trim();
    if (!cleanText) return;

    const chunks = cleanText
      .split(/(?<=[.!?,\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    speechQueueRef.current = chunks.length > 0 ? chunks : [cleanText];
    isBargeInRef.current = false;
    speakNextChunk();
  }, [speakNextChunk]);

  const speak = useCallback(async (text: string) => {
    if (settingsRef.current.engine === 'elevenlabs') {
      const success = await speakElevenLabs(text);
      if (success) return;
    }

    speakWebSpeech(text);
  }, [speakElevenLabs, speakWebSpeech]);

  const stopSpeaking = useCallback(() => {
    isBargeInRef.current = true;
    speechQueueRef.current = [];
    isSpeakingChunkRef.current = false;

    if (elevenLabsAudioRef.current) {
      elevenLabsAudioRef.current.pause();
      elevenLabsAudioRef.current.currentTime = 0;
      elevenLabsAudioRef.current = null;
    }

    window.speechSynthesis.cancel();
    synthRef.current = null;
  }, []);

  const interruptAI = useCallback(() => {
    stopSpeaking();
    updateStatus('listening');
    startListeningRef.current?.();
  }, [stopSpeaking]);

  const testVoice = useCallback(() => {
    speak('Mmm oke, ini pengujian suara asisten AI data center. Suara ini sudah disesuaikan agar lebih natural.');
  }, [speak]);

  // ─── HTTP Fallback Voice Chat (ChatGPT VoiceMode Style) ───────────────
  const processHttpVoiceChat = useCallback(async (userText: string) => {
    updateStatus('processing');
    setTranscript('');
    stopListeningRef.current?.();
    try {
      let token: string | undefined;
      try {
        const { auth } = await import('@/api/firebase');
        token = await auth.currentUser?.getIdToken(false);
        if (!token && auth.currentUser) {
          // force-refresh token once
          token = await auth.currentUser.getIdToken(true);
        }
      } catch {
        // Firebase offline/permission issue — proceed without token (dev mode)
        token = undefined;
      }

      // Always use Vite proxy path (/api/ai/chat) — works in dev and production
      const chatUrl = '/api/ai/chat';

      const chatGPTVoicePrompt = `Kamu adalah JARVIS, AI Voice Agent operator resmi untuk DwimitraSystem (PT Dwimitra Ekatama Mandiri / PT UTT) di Data Center NeutraDC Cikarang.
Creator: Tuan Gari Iriana.

ATURAN UTAMA PERCAKAPAN SUARA (SANGAT KETAT):
1. Jawab HANYA dalam 1 KALIMAT SINGKAT & NATURAL (maksimal 8-15 kata). Bicara persis seperti asisten pribadi di telepon/walkie-talkie nyata.
2. Selalu gunakan pembuka natural & ramah: "Siap Tuan Gari...", "Baik Tuan, dilaksanakan...", "Mmm oke...", "Sip, bentar ya...", "Beres Tuan!".
3. DILARANG KERAS menggunakan format markdown (*, #, _, -, bullet, tabel) karena teks langsung diucapkan via audio!
4. DILARANG berbicara panjang lebar atau membaca tabel.
5. Jika pengguna meminta tindakan (navigasi halaman, buat laporan, cari data, export, refresh, tutup), sertakan tag aksi di PALING AKHIR jawaban:
   - Navigasi halaman: [ACTION: NAVIGATE: <halaman>]
     (Daftar halaman: admin, report, documents, files, findings, finding_archive, corrective, corrective_archive, ptw, absen_tbm, absen_induction, pm_schedule, boq, berita_acara, monthly_report, spareparts, standby_kpi)
   - Buat laporan baru: [ACTION: CREATE_REPORT]
   - Export/Download PDF: [ACTION: EXPORT_PDF]
   - Cari data/laporan: [ACTION: SEARCH: <query>]
   - Refresh data: [ACTION: REFRESH]
   - Tutup modal/dialog: [ACTION: CLOSE_MODAL]
6. Jika user hanya menyapa atau mengobrol santai, balas singkat, ramah, dan siap menerima instruksi.`;

      const messagesPayload = [
        { role: 'system', content: chatGPTVoicePrompt },
        ...currentHist.slice(-6).map(msg => ({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.content,
        })),
        { role: 'user', content: userText },
      ];

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: messagesPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const resData = await response.json();
      let replyText = resData.reply || resData.data?.reply || 'Mmm oke, maaf terjadi kendala pada server AI.';
      
      // JARVIS Autonomous Action Extraction & Execution
      const actionMatch = replyText.match(/\[ACTION:\s*([^\]]+)\]/i);
      let cleanReplyText = replyText.replace(/\[ACTION:\s*([^\]]+)\]/gi, '').replace(/[*#`_]/g, '').trim();

      if (actionMatch) {
        const fullAction = actionMatch[1].trim();
        if (fullAction.startsWith('NAVIGATE:')) {
          const targetPage = fullAction.replace('NAVIGATE:', '').trim();
          onFunctionCall?.('navigate_to_page', { page: targetPage });
        } else if (fullAction === 'CREATE_REPORT' || fullAction === 'CREATE_SERVICE_REPORT') {
          onFunctionCall?.('create_service_report', { report_type: 'service_report' });
        } else if (fullAction.includes('EXPORT_PDF')) {
          onFunctionCall?.('export_pdf', {});
        } else if (fullAction.includes('AUTO_FILL')) {
          onFunctionCall?.('ai_analyze_report', { action: 'auto_fill' });
        } else if (fullAction.includes('REFRESH')) {
          onFunctionCall?.('refresh_data', {});
        } else if (fullAction.includes('CLOSE_MODAL')) {
          onFunctionCall?.('close_modal', {});
        } else if (fullAction.startsWith('SEARCH:')) {
          const query = fullAction.replace('SEARCH:', '').trim();
          onFunctionCall?.('search_reports', { query });
        }
      }

      setAiResponse(cleanReplyText);
      aiResponseRef.current = cleanReplyText;
      setConversationHistory(prev => [...prev, {
        role: 'ai',
        content: cleanReplyText,
        timestamp: Date.now(),
      }]);

      speak(cleanReplyText);
    } catch (err: any) {
      console.error('HTTP Voice fallback error:', err);
      isProcessingRef.current = false;
      if (sessionActiveRef.current) {
        setTimeout(() => {
          updateStatus('listening');
          lastSpeechTextRef.current = '';
          startListeningRef.current?.();
        }, 500);
      }
    }
  }, [speak, onFunctionCall]);

  // ─── STT (Speech-to-Text) ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI || !sessionActiveRef.current || isProcessingRef.current) return;

    // Kill any existing recognition session first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isListeningRef.current = false;

    // Brief pause to let Chrome release mic hardware between sessions
    setTimeout(() => {
      if (!sessionActiveRef.current || isProcessingRef.current) return;

      try {
        const recognition = new SpeechRecognitionAPI();
        // continuous=false is MORE RELIABLE in Chrome — avoids AudioContext mic conflict
        // We manually restart on onend to simulate continuous listening
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'id-ID';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          isListeningRef.current = true;
          if (statusRef.current !== 'speaking' && statusRef.current !== 'processing') {
            updateStatus('listening');
          }
        };

        recognition.onresult = (event: any) => {
          if (statusRef.current === 'speaking' || statusRef.current === 'processing' || isProcessingRef.current) {
            return;
          }

          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          // Show live transcript (interim)
          if (interimTranscript) {
            setTranscript(interimTranscript);
          }

          // When Chrome gives a final result, send it to AI
          if (finalTranscript.trim()) {
            const userText = finalTranscript.trim();
            setTranscript(userText);
            lastSpeechTextRef.current = '';
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            isProcessingRef.current = true;
            isListeningRef.current = false;
            try { recognition.abort(); } catch {}
            recognitionRef.current = null;

            setConversationHistory(prev => [...prev, {
              role: 'user',
              content: userText,
              timestamp: Date.now(),
            }]);

            processHttpVoiceChat(userText);
          }
        };

        recognition.onerror = (event: any) => {
          isListeningRef.current = false;
          recognitionRef.current = null;
          // 'no-speech' is normal — just restart silently
          if (event.error === 'no-speech' || event.error === 'audio-capture') {
            if (sessionActiveRef.current && !isProcessingRef.current) {
              setTimeout(() => {
                if (sessionActiveRef.current && !isProcessingRef.current) {
                  startListeningRef.current?.();
                }
              }, 100);
            }
            return;
          }
          if (sessionActiveRef.current && !isProcessingRef.current && statusRef.current !== 'processing') {
            setTimeout(() => {
              if (sessionActiveRef.current && !isProcessingRef.current) {
                startListeningRef.current?.();
              }
            }, 300);
          }
        };

        recognition.onend = () => {
          isListeningRef.current = false;
          recognitionRef.current = null;
          // Auto-restart unless we're processing a user's message
          if (sessionActiveRef.current && !isProcessingRef.current && statusRef.current !== 'processing') {
            setTimeout(() => {
              if (sessionActiveRef.current && !isProcessingRef.current) {
                startListeningRef.current?.();
              }
            }, 100);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        isListeningRef.current = false;
      }
    }, 150);
  }, [processHttpVoiceChat]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // ─── WebSocket ─────────────────────────────────────────────────────────
  const sendWSMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const enableHttpFallbackMode = useCallback(() => {
    console.warn('WebSocket connection unavailable or failed. Switching to HTTP Voice Agent mode.');
    useHttpFallbackRef.current = true;
    setIsConnected(true);
    setError(null);
    updateStatus('listening');
    sessionActiveRef.current = true;
    isProcessingRef.current = false;
    // NOTE: Do NOT call startAudioLevelMonitor() here —
    // AudioContext getUserMedia() conflicts with Chrome SpeechRecognition mic access,
    // causing onresult to never fire. Orb animation runs via CSS instead.
    startListening();
  }, [startListening]);

  const connectWebSocket = useCallback(async () => {
    try {
      const { auth } = await import('@/api/firebase');
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Tidak dapat mengautentikasi. Silakan login ulang.');
        updateStatus('error');
        return;
      }

      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      let wsUrl: string;
      if (apiBaseUrl.startsWith('http')) {
        wsUrl = apiBaseUrl.replace(/^http/, 'ws');
        if (wsUrl.endsWith('/api')) {
          wsUrl = wsUrl.replace(/\/api$/, '/api/voice/ws');
        } else {
          wsUrl += '/api/voice/ws';
        }
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/api/voice/ws`;
      }
      wsUrl += `?token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let connectionTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch {}
          enableHttpFallbackMode();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(connectionTimer);
        useHttpFallbackRef.current = false;
        setIsConnected(true);
        setError(null);
        updateStatus('listening');
        sessionActiveRef.current = true;
        isProcessingRef.current = false;

        if (getAppState) {
          sendWSMessage({ type: 'app_state', data: getAppState() });
        }

        startListening();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          handleWSMessage(msg);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimer);
        if (!useHttpFallbackRef.current && wsRef.current) {
          enableHttpFallbackMode();
          return;
        }
        setIsConnected(false);
        sessionActiveRef.current = false;
        if (event.code !== 1000 && event.code !== 1001 && !useHttpFallbackRef.current) {
          console.warn('WebSocket closed unexpectedly:', event.code, event.reason);
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimer);
        if (!useHttpFallbackRef.current) {
          enableHttpFallbackMode();
        }
      };
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      enableHttpFallbackMode();
    }
  }, [getAppState, startAudioLevelMonitor, startListening, sendWSMessage, enableHttpFallbackMode]);

  // ─── Handle WebSocket Messages ─────────────────────────────────────────
  const handleWSMessage = useCallback((msg: WSMessage) => {
    const data = msg.data as any;

    switch (msg.type) {
      case 'session_ready':
        break;

      case 'ai_thinking':
        setStatus('processing');
        setAiResponse('');
        aiResponseRef.current = '';
        break;

      case 'ai_response':
        if (data?.text) {
          const cleanText = data.text.replace(/[*#`_]/g, '').trim();
          setAiResponse(cleanText);
          aiResponseRef.current = cleanText;
          setConversationHistory(prev => [...prev, {
            role: 'ai',
            content: cleanText,
            timestamp: Date.now(),
          }]);
        }
        break;

      case 'tts_start': {
        const textToSpeak = data?.text || aiResponseRef.current;
        if (textToSpeak) {
          speak(textToSpeak);
        }
        break;
      }

      case 'function_call':
        handleFunctionCall(data as FunctionCallMessage);
        break;

      case 'error':
        if (data?.message) {
          setError(data.message);
          setAiResponse(data.message);
          aiResponseRef.current = data.message;
          setConversationHistory(prev => [...prev, {
            role: 'ai',
            content: data.message,
            timestamp: Date.now(),
          }]);
          if (sessionActiveRef.current) {
            setTimeout(() => {
              setStatus('listening');
              startListening();
            }, 1000);
          }
        }
        break;
    }
  }, [speak, startListening]);

  // ─── Handle Function Calls ─────────────────────────────────────────────
  const handleFunctionCall = useCallback(async (fnCall: FunctionCallMessage) => {
    setConversationHistory(prev => [...prev, {
      role: 'ai',
      content: `⚡ Menjalankan: ${fnCall.name}`,
      timestamp: Date.now(),
      functionCall: fnCall,
    }]);

    let result = { success: false, result: 'Function not implemented' };

    if (onFunctionCall) {
      try {
        result = await onFunctionCall(fnCall.name, fnCall.args);
      } catch (err: any) {
        result = { success: false, result: err.message || 'Execution failed' };
      }
    }

    sendWSMessage({
      type: 'function_result',
      data: {
        name: fnCall.name,
        success: result.success,
        result: result.result,
      },
    });

    if (getAppState) {
      setTimeout(() => {
        sendWSMessage({ type: 'app_state', data: getAppState!() });
      }, 500);
    }
  }, [onFunctionCall, sendWSMessage, getAppState]);

  // ─── Session Control ───────────────────────────────────────────────────
  const startSession = useCallback(() => {
    if (status !== 'idle' && status !== 'error') return;
    sessionActiveRef.current = true;
    isProcessingRef.current = false;
    updateStatus('connecting');
    setError(null);
    setTranscript('');
    setAiResponse('');
    useHttpFallbackRef.current = false;
    connectWebSocket();
  }, [status, connectWebSocket]);

  const endSession = useCallback(() => {
    sessionActiveRef.current = false;
    isProcessingRef.current = false;
    useHttpFallbackRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    lastSpeechTextRef.current = '';
    stopListening();
    stopSpeaking();
    stopAudioLevelMonitor();

    if (wsRef.current) {
      sendWSMessage({ type: 'end_session' });
      wsRef.current.close(1000, 'User ended session');
      wsRef.current = null;
    }

    updateStatus('idle');
    setIsConnected(false);
    setTranscript('');
    setAiResponse('');
  }, [stopListening, stopSpeaking, stopAudioLevelMonitor, sendWSMessage]);

  // ─── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      useHttpFallbackRef.current = false;
      stopListening();
      stopSpeaking();
      stopAudioLevelMonitor();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, []);

  return {
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
  };
}
