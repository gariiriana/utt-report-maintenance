import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Camera, SwitchCamera, RefreshCw, Check, AlertCircle, MapPin, Download, Zap, ZapOff, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { Slider } from './ui/slider';

interface CameraModalProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  maintenanceName?: string;
  specificDetail?: string;
}

export function CameraModal({ onCapture, onClose, title = 'Ambil Foto Dokumentasi', description, maintenanceName, specificDetail }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [locationData, setLocationData] = useState<{
    coords: string;
    address: string;
    loading: boolean;
  } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'loading'>('loading');
  // AbortController ref — cancels in-flight Nominatim requests if user re-triggers
  const abortControllerRef = useRef<AbortController | null>(null);

  // Flash & Zoom State
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoom, setZoom] = useState(1);

  // Core fetch logic — wrapped in useCallback so the debounce hook gets a stable reference
  const _doFetchLocation = useCallback(async (retry = false) => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolokasi');
      return;
    }
    
    // Cancel any previous in-flight request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLocationData(prev => ({ 
      coords: prev?.coords || '', 
      address: prev?.address || 'Mengambil lokasi...', 
      loading: true 
    }));
    
    const timeout = retry ? 0 : 500;
    setTimeout(() => {
    const tryFetch = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coordsString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        try {
          // If offline, don't even try Nominatim (prevents hangs)
          if (!navigator.onLine) {
            setLocationData({ coords: coordsString, address: 'Lokasi Offline (GPS)', loading: false });
            return;
          }

          // Fetch 1: Zoom 18 (Street Level)
          const res1 = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'id', 'User-Agent': 'UTT-Maintenance-App' },
            signal: controller.signal
          });
          const data1 = await res1.json();
          const addr1 = data1.address;

          // Fetch 2: Zoom 14 (District Level) - Better for Kecamatan & Postcode
          const res2 = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`, {
            headers: { 'Accept-Language': 'id', 'User-Agent': 'UTT-Maintenance-App' },
            signal: controller.signal
          });
          const data2 = await res2.json();
          const addr2 = data2.address;
          
          if (controller.signal.aborted) return;

          // Smart extraction with multiple fallbacks
          const pCode = data1.extratags?.plus_code || 'J5CX+5R7'; 
          const desa = addr1.village || addr1.suburb || addr1.neighbourhood || addr1.hamlet || 'Desa';
          const kecamatan = addr1.city_district || addr1.municipality || addr2.city_district || addr2.municipality || addr2.county || 'Cikarang Pusat';
          const provinsi = addr1.state || addr2.state || 'Jawa Barat';
          const kodepos = addr1.postcode || addr2.postcode || '17530';

          const fullAddressParts = [pCode, desa, kecamatan, provinsi, kodepos].filter(Boolean);
          const detailAddress = fullAddressParts.length >= 3 ? fullAddressParts.join(', ') : '';

          setLocationData({ coords: coordsString, address: detailAddress, loading: false });
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return; 
          console.error('Reverse Geocode Error:', err);
          setLocationData({ coords: coordsString, address: '', loading: false });
        }
      }, (err) => {
        console.warn(`Geolocation error (${highAccuracy ? 'High' : 'Low'} Accuracy):`, err);
        if (highAccuracy && err.code !== 1) {
          // Fallback to low accuracy if high fails (unless permission denied)
          tryFetch(false);
          return;
        }
        
        let msg = 'Gagal mengambil lokasi';
        if (err.code === 1) msg = 'Izin lokasi ditolak';
        else if (err.code === 3) msg = 'Waktu pencarian lokasi habis';
        
        toast.error(msg);
        setLocationData(null);
      }, { 
        enableHighAccuracy: highAccuracy, 
        timeout: highAccuracy ? 8000 : 15000, 
        maximumAge: highAccuracy ? 0 : 60000 
      });
    };

    const waitTimeout = retry ? 0 : 500;
    setTimeout(() => tryFetch(true), waitTimeout);
    }, timeout);
  }, []);

  // Debounced wrapper — prevents hitting the Nominatim API more than once per 800ms
  const { debouncedFn: fetchLocation } = useDebouncedCallback(
    _doFetchLocation as (...args: unknown[]) => unknown,
    800
  );

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser ini tidak mendukung akses kamera.');
      setIsInitializing(false);
      return;
    }

    const handleStream = async (newStream: MediaStream) => {
      streamRef.current = newStream;
      const videoTrack = newStream.getVideoTracks()[0];
      
      if (videoTrack) {
        try {
          // Check Capabilities
          const caps = videoTrack.getCapabilities() as any;
          console.log("Camera Capabilities:", caps);
          
          if (caps.torch) {
            setTorchSupported(true);
            setIsTorchOn(false); // Reset torch when switching camera
          } else {
            setTorchSupported(false);
          }
          
          if (caps.zoom) {
            setZoomSupported(true);
            setZoomRange({
              min: caps.zoom.min || 1,
              max: caps.zoom.max || 1,
              step: caps.zoom.step || 0.1
            });
            setZoom(caps.zoom.min || 1);
          } else {
            setZoomSupported(false);
          }
        } catch (e) {
          console.warn("Failed to get camera capabilities:", e);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setIsReady(true);
      setError(null);
    };

    try {
      setIsInitializing(true);
      setError(null);
      
      // Stop existing tracks if any before switching
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        streamRef.current = null;
        // Small delay to let the OS release the camera lock
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Attempt 1: Target Facing Mode
      try {
        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        handleStream(newStream);
      } catch (err) {
        console.warn(`Attempt 1 (${facingMode}) failed:`, err);
        
        // Attempt 2: Fallback
        const newStream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        handleStream(newStream);
      }
    } catch (err: any) {
      console.error('Camera Access Error:', err);
      let errorMsg = 'Gagal mengakses kamera.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Izin kamera ditolak. Silakan berikan izin akses kamera.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.';
      }

      setError(errorMsg);
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack && torchSupported) {
      try {
        const newState = !isTorchOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: newState }]
        } as any);
        setIsTorchOn(newState);
      } catch (err) {
        console.error("Failed to toggle torch:", err);
        toast.error("Gagal mengaktifkan senter");
      }
    }
  };

  const handleZoomChange = async (value: number[]) => {
    const zoomValue = value[0];
    setZoom(zoomValue);
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack && zoomSupported) {
      try {
        await videoTrack.applyConstraints({
          advanced: [{ zoom: zoomValue }]
        } as any);
      } catch (err) {
        console.error("Failed to apply zoom:", err);
      }
    }
  };

  useEffect(() => {
    // Scroll lock
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Check permission status
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' } as any).then((status) => {
        setPermissionStatus(status.state as any);
        status.onchange = () => setPermissionStatus(status.state as any);
      });
    }

    startCamera();
    fetchLocation();

    return () => {
      document.body.style.overflow = originalStyle;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [facingMode]);

  // ── Shared watermark overlay (used in both live & photo preview) ──────────
  const capturedTimestampRef = useRef<string>('');

  const WatermarkOverlay = ({ className = "bottom-12 left-12" }: { className?: string }) => {
    const displayTime = capturedTimestampRef.current ||
      new Date().toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).replace(/\//g, '.').replace(' ', ', ');

    return (
      <div className={`absolute ${className} pointer-events-none z-50`}>
        <div className="relative border-l-[3px] border-blue-500 pl-3">
          <div className="flex flex-col gap-[2px]">
            <span className="text-white font-black text-[13px] uppercase tracking-widest leading-none">
              NEUTRADC
            </span>
            <span className="text-white/90 text-[10px] font-bold">
              {displayTime}
            </span>
            {locationData && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                  <MapPin className="w-2 h-2 text-white" />
                </div>
                <span className="text-white text-[10px] font-semibold">
                  {locationData.coords}
                </span>
              </div>
            )}
            {locationData?.address &&
             !locationData.address.includes('Mengambil') &&
             !locationData.address.includes('terdeteksi') && (
              <span className="text-white/75 text-[9px] leading-tight italic mt-0.5 max-w-[280px]">
                {locationData.address}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Freeze timestamp
    capturedTimestampRef.current = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(/\//g, '.').replace(' ', ', ');

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(base64);
  };

  const getWatermarkedBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!capturedImage || !canvasRef.current) return resolve('');

      const canvas = canvasRef.current;
      const ctx    = canvas.getContext('2d');
      if (!ctx) return resolve('');

      const img = new Image();
      img.onload = () => {
        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Burn Watermark
        const pad   = Math.round(canvas.width * 0.06);
        const fBase = Math.max(16, canvas.width * 0.034);
        const lineH = fBase * 1.45;

        const hasAddress = locationData?.address &&
          !locationData.address.includes('Mengambil') &&
          !locationData.address.includes('terdeteksi');

        const textLines = [
          { text: 'NEUTRADC',                           size: fBase * 1.25, weight: '900', alpha: 1.0 },
          { text: capturedTimestampRef.current,         size: fBase * 0.90, weight: '600', alpha: 0.92 },
          ...(locationData?.coords ? [{ text: locationData.coords, size: fBase * 0.85, weight: '500', alpha: 0.85 }] : []),
          ...(hasAddress           ? [{ text: locationData!.address, size: fBase * 0.78, weight: '400', alpha: 0.75, italic: true }] : []),
        ];

        const blockH = textLines.length * lineH + pad * 0.6;
        const blockY = canvas.height - blockH - pad * 0.4;
        const textX  = pad + 12;

        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(pad, blockY + 4, 4, blockH - 8);

        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';

        textLines.forEach((line, i) => {
          const y = blockY + pad * 0.4 + i * lineH;
          if (i === 2 && locationData?.coords) {
            const r  = line.size * 0.45;
            const cx = textX - 4;
            const cy = y + line.size * 0.5;
            ctx.fillStyle  = '#3b82f6';
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle  = 'white';
            ctx.beginPath(); ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2); ctx.fill();
            ctx.font      = `${line.weight} ${line.size}px 'Inter', sans-serif`;
            ctx.fillStyle = `rgba(255,255,255,${line.alpha})`;
            ctx.fillText(line.text, textX + r * 2 + 2, y);
          } else {
            ctx.font      = `${line.italic ? 'italic ' : ''}${line.weight} ${line.size}px 'Inter', sans-serif`;
            ctx.fillStyle = `rgba(255,255,255,${line.alpha})`;
            ctx.fillText(line.text, textX, y);
          }
        });

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = capturedImage;
    });
  };

  const handleApply = async () => {
    const finalImage = await getWatermarkedBase64();
    if (finalImage) {
      onCapture(finalImage);
      onClose();
    }
  };

  const downloadCapturedImage = async () => {
    const finalImage = await getWatermarkedBase64();
    if (!finalImage) return;

    const link = document.body.appendChild(document.createElement('a'));
    link.href = finalImage;
    const ts = new Date().getTime();
    const cleanMain = (maintenanceName || 'report').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanUnit = (specificDetail || 'unit').substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cleanDesc = (description || 'capture').substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${cleanMain}_${cleanUnit}_${cleanDesc}_${ts}.jpg`;
    link.click();
    link.remove();
    toast.success('Gambar berhasil diunduh');
  };

  const retake = () => {
    setCapturedImage(null);
    capturedTimestampRef.current = '';
  };

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md sm:p-8"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative z-[10000]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/15 rounded-lg">
              <Camera className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-white text-xs tracking-tight">{title}</h3>
              {locationData ? (
                <button 
                  onClick={() => fetchLocation(true)}
                  className="flex items-center gap-1 group"
                >
                  <MapPin className={`w-2.5 h-2.5 ${locationData.loading ? 'text-blue-400 animate-pulse' : 'text-emerald-500'}`} />
                  <span className="text-[8px] text-slate-400 truncate max-w-[120px] group-hover:text-white transition-colors">
                    {locationData.loading ? 'Mencari Lokasi...' : locationData.coords}
                  </span>
                </button>
              ) : (
                <button 
                  onClick={() => fetchLocation(true)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 rounded-full border border-red-500/20"
                >
                  <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-[7px] text-red-400 font-bold uppercase">Aktifkan GPS</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!capturedImage && (
              <>
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl transition ${isTorchOn ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:bg-slate-800'}`}
                    title="Toggle Flash"
                  >
                    {isTorchOn ? <Zap className="w-5 h-5 fill-amber-400" /> : <ZapOff className="w-5 h-5" />}
                  </button>
                )}
                <button
                  onClick={startCamera}
                  className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400"
                  title="Refresh Kamera"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                  className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400"
                  title="Putar Kamera"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Viewfinder / Preview */}
        <div className={`relative bg-black overflow-hidden flex items-center justify-center ${capturedImage ? '' : 'aspect-square'}`}>
          {capturedImage ? (
            <div className="relative w-full overflow-hidden">
              <img
                src={capturedImage}
                className="w-full h-auto max-h-[65vh] object-contain block"
                alt="Captured"
              />
              <WatermarkOverlay className="bottom-4 left-6" />
            </div>
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
                  <div className="absolute inset-8 border-2 border-white/5 rounded-2xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/40 -mt-0.5 -ml-0.5 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/40 -mt-0.5 -mr-0.5 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/40 -mb-0.5 -ml-0.5 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/40 -mb-0.5 -mr-0.5 rounded-br-lg" />
                  </div>

                  {permissionStatus !== 'granted' && (
                    <div className="absolute inset-0 z-[60] bg-black/70 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                      <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="w-7 h-7 text-blue-400" />
                      </div>
                      <h4 className="text-white font-bold mb-2 text-sm">Izin Lokasi Diperlukan</h4>
                      <p className="text-slate-300 text-[10px] leading-relaxed mb-6 max-w-[240px]">
                        Untuk menambahkan watermark koordinat dan alamat di foto, kami memerlukan izin akses lokasi perangkat Anda.
                      </p>
                      <button 
                        onClick={() => fetchLocation(true)}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                      >
                        Izinkan Akses Lokasi
                      </button>
                    </div>
                  )}

                  {permissionStatus === 'granted' && <WatermarkOverlay />}

                  {/* Zoom Control Overlay */}
                  {zoomSupported && !capturedImage && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/10 z-[70]">
                      <button 
                        onClick={() => handleZoomChange([Math.min(zoomRange.max, zoom + 0.5)])}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <div className="h-32 flex items-center justify-center">
                        <Slider
                          defaultValue={[zoom]}
                          value={[zoom]}
                          min={zoomRange.min}
                          max={zoomRange.max}
                          step={zoomRange.step}
                          orientation="vertical"
                          onValueChange={handleZoomChange}
                          className="h-full"
                        />
                      </div>
                      <button 
                        onClick={() => handleZoomChange([Math.max(zoomRange.min, zoom - 0.5)])}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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
                  <RefreshCw className="w-4 h-4" />
                  Ulangi
                </button>
                <button
                  onClick={downloadCapturedImage}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold transition shadow-xl"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition shadow-xl shadow-blue-600/20"
                >
                  <Check className="w-4 h-4" />
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

  return createPortal(modalContent, document.body);
}
