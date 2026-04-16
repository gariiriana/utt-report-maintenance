import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CameraModalProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  title?: string;
}

export function CameraModal({ onCapture, onClose, title = 'Ambil Foto Dokumentasi' }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser ini tidak mendukung akses kamera.');
      setIsInitializing(false);
      return;
    }

    const handleStream = (newStream: MediaStream) => {
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setIsReady(true);
      setError(null);
    };

    try {
      setIsInitializing(true);
      setError(null);
      
      // Attempt 1: Back camera with HD resolution
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        handleStream(stream);
      } catch (err) {
        console.warn('Attempt 1 (environment) failed:', err);
        
        // Attempt 2: Default camera without resolution constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          handleStream(stream);
        } catch (err2) {
          throw err2; // Final failure
        }
      }
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      let errorMsg = 'Gagal mengakses kamera.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Izin kamera ditolak. Silakan berikan izin akses kamera di pengaturan browser Anda.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'Tidak ditemukan perangkat kamera pada perangkat ini.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.';
      }

      setError(errorMsg);
      toast.error('Gagal akses kamera');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Matching video aspect ratio
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(base64);
  };

  const handleApply = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/15 rounded-lg">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-bold text-white tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative aspect-square bg-black overflow-hidden flex items-center justify-center">
          {capturedImage ? (
            <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${isReady ? 'opacity-100' : 'opacity-0'} transition-opacity`}
              />
              
              {isInitializing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 font-medium">Memulai Kamera...</p>
                </div>
              )}

              {error && (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{error}</p>
                  <button 
                    onClick={startCamera}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}

              {isReady && !error && (
                <>
                  <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[30] p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-all active:scale-95 shadow-lg"
                    title="Tutup Kamera"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="absolute inset-x-8 inset-y-8 border-2 border-white/20 rounded-2xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60 -mt-0.5 -ml-0.5 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60 -mt-0.5 -mr-0.5 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60 -mb-0.5 -ml-0.5 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60 -mb-0.5 -mr-0.5 rounded-br-lg" />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-900/50">
          <div className="flex items-center justify-center gap-6">
            {!capturedImage ? (
              <button
                onClick={takePhoto}
                disabled={!isReady || !!error}
                className="w-20 h-20 bg-white rounded-full p-1 border-4 border-slate-700 hover:scale-105 active:scale-95 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-white transition">
                   <div className="w-8 h-8 border-4 border-slate-900 rounded-full" />
                </div>
              </button>
            ) : (
              <div className="flex gap-4 w-full">
                <button
                  onClick={retake}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition shadow-xl"
                >
                  <RefreshCw className="w-5 h-5" />
                  Ulangi
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition shadow-xl shadow-blue-600/20"
                >
                  <Check className="w-5 h-5" />
                  Pakai Foto
                </button>
              </div>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </motion.div>
    </motion.div>
  );
}
