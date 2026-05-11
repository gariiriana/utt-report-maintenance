import { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCcw, Check, User } from 'lucide-react';
import { Button } from './button';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  placeholder?: string;
}

export function CameraCapture({ onCapture, placeholder = "Ambil Foto Wajah" }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setError(null);
    console.log("--- Camera Diagnostics ---");

    if (!window.isSecureContext) {
      setError("Kamera butuh link HTTPS atau localhost.");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setError("Browser tidak mendukung fitur kamera.");
      return;
    }

    try {

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log("Available video devices:", videoDevices);

      if (videoDevices.length === 0) {
        setError("Hardware kamera tidak ditemukan di perangkat ini.");
        return;
      }

      const constraints = [
        { video: { facingMode: 'user' } },
        { video: { facingMode: { ideal: 'user' } } },
        { video: true }
      ];

      for (const constraint of constraints) {
        try {
          console.log("Attempting camera with constraint:", constraint);
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
          setStream(mediaStream);
          setIsCameraActive(true);
          setError(null);
          console.log("Camera successfully started!");
          return;
        } catch (err) {
          console.warn(`Constraint ${JSON.stringify(constraint)} failed:`, err);
          continue;
        }
      }

      setError("Kamera ditemukan tapi gagal diakses. Pastikan izin diberikan atau kamera tidak dipakai aplikasi lain.");
    } catch (diagErr: any) {
      console.error("Diagnostic error:", diagErr);
      setError(`Gagal memproses kamera: ${diagErr.message}`);
    }
  };

  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {

        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 300;
        canvas.height = 300;

        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;

        context.drawImage(video, startX, startY, size, size, 0, 0, 300, 300);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setPreview(dataUrl);
        onCapture(dataUrl);
        stopCamera();
      }
    }
  };

  const clearPhoto = () => {
    setPreview(null);
    onCapture('');
    startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  return (
    <div className="space-y-3 w-full">
      <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-950 aspect-square max-w-[240px] mx-auto shadow-inner ring-1 ring-white/5">
        {!isCameraActive && !preview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
             <div className="p-4 bg-blue-500/10 rounded-full text-blue-500 animate-pulse">
                <User className="w-8 h-8" />
             </div>
             <Button
                type="button"
                variant="outline"
                onClick={startCamera}
                className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
             >
                Aktifkan Kamera
             </Button>
             {error && <p className="text-[10px] text-red-400 px-4 text-center font-medium">{error}</p>}
          </div>
        )}

        {isCameraActive && !preview && (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute inset-0 border-[30px] border-black/20 pointer-events-none rounded-full scale-90 opacity-50" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
               <button
                  type="button"
                  onClick={capturePhoto}
                  className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-xl shadow-blue-900/40 transition-all active:scale-95 group/cap"
               >
                  <Camera className="w-6 h-6 group-hover/cap:scale-110 transition-transform" />
               </button>
            </div>
          </div>
        )}

        {preview && (
          <div className="relative w-full h-full">
            <img src={preview} alt="Evidence" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={clearPhoto}
                className="p-2 bg-slate-900/80 hover:bg-red-500/80 text-white rounded-lg backdrop-blur-md border border-white/10 transition-colors"
                title="Ulangi"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute bottom-2 left-2 right-2 text-center pointer-events-none">
               <span className="bg-emerald-500/90 text-[10px] font-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg flex items-center justify-center gap-1 mx-auto w-fit">
                 <Check className="w-3 h-3" /> Foto Tersimpan
               </span>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] text-center">{placeholder}</p>


      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

