import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, Mic, MicOff, Paperclip, Plus, MessageSquare, Trash2, Copy, Check, Menu } from 'lucide-react';
import { auth } from '@/api/firebase';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import robotLogo from '@/assets/robot_assistant.png';
import { compressImage } from '@/utils/imageCompression';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image_base64?: string;
}

interface ChatRoom {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: 'Halo! Saya adalah Asisten AI Data Center. AI ini dibuat oleh Tuan Gari Iriana, dan seluruh proyek ini dibangun oleh Tuan Gari Iriana.\n\nAda yang bisa saya bantu seputar kelistrikan (M/E), cooling system, atau operasional infrastruktur data center?\n\nJika saya kurang tepat memberikan jawaban, silakan laporkan ke Tuan saya yaitu Gari Iriana.'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createNewRoom(): ChatRoom {
  return {
    id: generateId(),
    title: 'Chat Baru',
    messages: [WELCOME_MESSAGE],
    createdAt: Date.now(),
  };
}

function loadRooms(email: string): ChatRoom[] {
  try {
    const saved = localStorage.getItem(`ai_chat_rooms_${email}`);
    if (saved) {
      const rooms = JSON.parse(saved) as ChatRoom[];
      if (rooms.length > 0) return rooms;
    }
  } catch { /* ignore */ }
  return [createNewRoom()];
}

function saveRooms(email: string, rooms: ChatRoom[]) {
  const stripped = rooms.map(room => ({
    ...room,
    messages: room.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  }));
  try {
    localStorage.setItem(`ai_chat_rooms_${email}`, JSON.stringify(stripped));
  } catch { /* localStorage full */ }
}

export function AIChatWidget() {
  const { user } = useAuth();
  const userEmail = user?.email || 'guest';

  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Multimodal Vision Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Lock body scroll when chat widget is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Jawaban disalin!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Speech-to-Text State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || createNewRoom();
  const messages = activeRoom?.messages || [WELCOME_MESSAGE];

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!SpeechRecognition) {
      toast.error('Browser Anda tidak mendukung Voice-to-Text.');
      return;
    }
    
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          console.error('Stop error:', err);
        }
      }
      setIsRecording(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'id-ID';

      rec.onstart = () => {
        setIsRecording(true);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error('Gagal mengenali suara.');
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Speech recognition start error:', err);
      toast.error('Gagal memulai perekaman suara.');
      setIsRecording(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 10MB.');
      return;
    }
    const compressToastId = toast.loading('Memproses gambar...');
    try {
      const compressed = await compressImage(file, { maxWidth: 800, quality: 0.6 });
      setSelectedImage(compressed);
      toast.success('Gambar berhasil diproses.', { id: compressToastId });
    } catch (err) {
      console.error('Failed to compress image:', err);
      toast.error('Gagal memproses gambar.', { id: compressToastId });
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load rooms and activeRoomId dynamically when userEmail changes
  useEffect(() => {
    if (!userEmail) return;
    const loadedRooms = loadRooms(userEmail);
    setRooms(loadedRooms);

    const savedActive = localStorage.getItem(`ai_chat_active_room_${userEmail}`);
    if (savedActive && loadedRooms.find(r => r.id === savedActive)) {
      setActiveRoomId(savedActive);
    } else {
      setActiveRoomId(loadedRooms[0].id);
    }
  }, [userEmail]);

  // Save rooms state to dynamic key
  useEffect(() => {
    if (rooms.length > 0 && userEmail) {
      saveRooms(userEmail, rooms);
    }
  }, [rooms, userEmail]);

  // Save activeRoomId to dynamic key
  useEffect(() => {
    if (activeRoomId && userEmail) {
      localStorage.setItem(`ai_chat_active_room_${userEmail}`, activeRoomId);
    }
  }, [activeRoomId, userEmail]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  const updateActiveRoomMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    setRooms(prev => prev.map(room =>
      room.id === activeRoomId ? { ...room, messages: updater(room.messages) } : room
    ));
  }, [activeRoomId]);

  const autoTitleRoom = useCallback((content: string) => {
    setRooms(prev => prev.map(room => {
      if (room.id !== activeRoomId || room.title !== 'Chat Baru') return room;
      return { ...room, title: content.length > 28 ? content.slice(0, 28) + '...' : content };
    }));
  }, [activeRoomId]);

  const handleNewChat = () => {
    const newRoom = createNewRoom();
    setRooms(prev => [newRoom, ...prev]);
    setActiveRoomId(newRoom.id);
    setInput('');
    setSelectedImage(null);
    setIsMobileSidebarOpen(false);
  };

  const handleSwitchRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setInput('');
    setSelectedImage(null);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteRoom = (roomId: string) => {
    setRooms(prev => {
      const updated = prev.filter(r => r.id !== roomId);
      if (updated.length === 0) {
        const newRoom = createNewRoom();
        setActiveRoomId(newRoom.id);
        return [newRoom];
      }
      if (roomId === activeRoomId) setActiveRoomId(updated[0].id);
      return updated;
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const imageBase64 = selectedImage ? selectedImage.split(',')[1] : undefined;

    const newUserMsg: Message = {
      role: 'user',
      content: userMessage || 'Mengirim gambar...',
      image_base64: imageBase64,
    };

    if (userMessage) autoTitleRoom(userMessage);

    const updatedMessages = [...messages, newUserMsg];
    updateActiveRoomMessages(() => updatedMessages);
    removeSelectedImage();
    setIsLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const chatUrl = apiBaseUrl.endsWith('/api')
        ? `${apiBaseUrl}/ai/chat`
        : `${apiBaseUrl}/api/ai/chat`;

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            image_base64: msg.image_base64,
          })),
        }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

      const data = await response.json();
      const cleanReply = (data.reply || 'Maaf, saya tidak menerima jawaban kosong.').replace(/\*\*/g, '');
      updateActiveRoomMessages(prev => [...prev, { role: 'assistant', content: cleanReply }]);
    } catch (err: any) {
      console.error('AI Chat error:', err);
      toast.error('Gagal mengirim pesan ke AI.');
      updateActiveRoomMessages(prev => [...prev, { role: 'assistant', content: 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Background Page Overlay (Gelap sedikit) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-[9997]"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-[88vw] sm:w-[500px] h-[78vh] sm:h-[480px] bg-slate-950/95 backdrop-blur-lg border border-slate-800/80 rounded-3xl shadow-2xl shadow-blue-500/5 flex overflow-hidden mb-4 relative"
            >
              {/* ═══ Backdrop Overlay for Mobile Sidebar ═══ */}
              {isMobileSidebarOpen && (
                <div
                  className="absolute inset-0 bg-black/60 z-10 sm:hidden"
                  onClick={() => setIsMobileSidebarOpen(false)}
                />
              )}

              {/* ═══ LEFT SIDEBAR — Responsive (Slides overlay on mobile, fixed on desktop) ═══ */}
              <div
                className={`absolute sm:relative z-20 h-full w-[140px] sm:w-[150px] border-r border-slate-800/80 bg-slate-950 sm:bg-slate-900/40 flex flex-col shrink-0 transition-transform duration-200 ${
                  isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
                }`}
              >
              {/* Sidebar Header */}
              <div className="p-3 border-b border-slate-800/60 flex items-center justify-between gap-1">
                <button
                  onClick={handleNewChat}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-blue-500/15"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Chat Baru
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors sm:hidden"
                  title="Tutup Menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Room List */}
              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className={`group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                      room.id === activeRoomId
                        ? 'bg-blue-600/15 border border-blue-500/25 text-white'
                        : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    onClick={() => handleSwitchRoom(room.id)}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0 opacity-60" />
                    <span className="flex-1 text-[11px] leading-tight truncate">{room.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-all"
                      title="Hapus"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ RIGHT PANEL — Chat Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat Header */}
              <div className="p-3 border-b border-slate-800/80 flex items-center gap-2 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors sm:hidden shrink-0"
                  title="Menu Riwayat"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                  <img src={robotLogo} alt="Robot Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white leading-tight truncate">{activeRoom?.title || 'Chat Baru'}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Online</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                  title="Tutup Chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative group/msg max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10'
                          : 'bg-slate-900 text-slate-300 border border-slate-800/80 rounded-tl-none pr-8'
                      }`}
                    >
                      {msg.image_base64 && (
                        <img
                          src={`data:image/jpeg;base64,${msg.image_base64}`}
                          alt="Uploaded"
                          className="rounded-xl mb-2 max-h-36 w-auto object-cover border border-white/10"
                        />
                      )}
                      {msg.content !== 'Mengirim gambar...' && msg.content}
                      {msg.content === 'Mengirim gambar...' && !msg.image_base64 && msg.content}

                      {/* Copy Button for Assistant responses */}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(msg.content, idx)}
                          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-all opacity-75 hover:opacity-100"
                          title="Salin jawaban"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 animate-scale" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-slate-400 text-[13px] flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>AI sedang berpikir...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Image Preview */}
              {selectedImage && (
                <div className="px-3 pt-2 bg-slate-900/30 border-t border-slate-800/80">
                  <div className="relative inline-block">
                    <img src={selectedImage} alt="Preview" className="h-16 w-auto rounded-xl border border-slate-700 object-cover" />
                    <button
                      type="button"
                      onClick={removeSelectedImage}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                      title="Hapus gambar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form
                onSubmit={handleSend}
                className="p-2.5 border-t border-slate-800/80 bg-slate-900/30 flex gap-1 items-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  title="Pilih Gambar"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                  title="Upload Gambar"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isLoading}
                  className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${
                    isRecording
                      ? 'text-red-400 bg-red-500/10 animate-pulse'
                      : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
                  }`}
                  title={isRecording ? 'Stop Rekaman' : 'Voice Note'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  placeholder={isRecording ? 'Bicara sekarang...' : 'Ketik pertanyaan teknis...'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-slate-950 border border-slate-800/80 focus:border-blue-500/50 rounded-2xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-blue-500/15 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center"
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <div className="relative group cursor-pointer">
        {/* Glowing aura rings */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-60 blur-md animate-pulse scale-110" />
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600/30 to-indigo-600/30 animate-ping opacity-40" />

        <motion.button
          whileHover={{ scale: 1.08, rotate: 2 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-blue-500/40 bg-slate-950 flex items-center justify-center shadow-lg shadow-blue-500/30"
          title="Buka AI Assistant"
        >
          <img
            src={robotLogo}
            alt="AI Assistant"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </motion.button>
      </div>
    </div>
  </>
  );
}
