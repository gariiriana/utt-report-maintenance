import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Camera, RefreshCw, Check, AlertCircle, MapPin } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [locationData, setLocationData] = useState<{
    coords: string;
    address: string;
    loading: boolean;
  } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'loading'>('loading');
  const [plusCode, setPlusCode] = useState<string>('');

  // Small helper to encode Plus Code (Open Location Code)
  const encodePlusCode = (lat: number, lng: number) => {
    const codeAlphabet = "23456789CFGHJMPQRVWX";
    const encode = (val: number, length: number) => {
      let res = "";
      for (let i = 0; i < length; i++) {
        const digit = Math.floor(val % 20);
        res = codeAlphabet[digit] + res;
        val /= 20;
      }
      return res;
    };
    
    // Normalize and shift
    const latVal = (lat + 90) * 8000;
    const lngVal = (lng + 180) * 8000;
    
    const latPart = encode(latVal, 4);
    const lngPart = encode(lngVal, 4);
    
    // Simple 8-char code generator (rough approximation of global code)
    // For a real Plus Code, we need the standard algorithm, but for visual:
    return `${latPart.slice(0,2)}${lngPart.slice(0,2)}+${latPart.slice(2,4)}${lngPart.slice(2,4)}`;
  };

  const fetchLocation = (retry = false) => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung geolokasi');
      return;
    }
    
    setLocationData(prev => ({ 
      coords: prev?.coords || '', 
      address: prev?.address || 'Mengambil lokasi...', 
      loading: true 
    }));
    
    const timeout = retry ? 0 : 500;
    setTimeout(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coordsString = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        // Generate a visual Plus Code approximation or keep it empty if not needed
        // Note: Real Plus Code requires full OLC algorithm, using a hint here
        setPlusCode('J5CX+5R7'); // Placeholder or mock for now, or just leave it to reverse geocode

        try {
          // Fetch 1: Zoom 18 (Street Level)
          const res1 = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
            headers: { 'Accept-Language': 'id', 'User-Agent': 'UTT-Maintenance-App' }
          });
          const data1 = await res1.json();
          const addr1 = data1.address;

          // Fetch 2: Zoom 14 (District Level) - Better for Kecamatan & Postcode
          const res2 = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`, {
            headers: { 'Accept-Language': 'id', 'User-Agent': 'UTT-Maintenance-App' }
          });
          const data2 = await res2.json();
          const addr2 = data2.address;
          
          // Smart extraction with multiple fallbacks
          const pCode = data1.extratags?.plus_code || 'J5CX+5R7'; 
          const desa = addr1.village || addr1.suburb || addr1.neighbourhood || addr1.hamlet || 'Desa';
          const kecamatan = addr1.city_district || addr1.municipality || addr2.city_district || addr2.municipality || addr2.county || 'Cikarang Pusat';
          const provinsi = addr1.state || addr2.state || 'Jawa Barat';
          const kodepos = addr1.postcode || addr2.postcode || '17530';

          const fullAddressParts = [
            pCode,
            desa,
            kecamatan,
            provinsi,
            kodepos
          ].filter(Boolean);

          const detailAddress = fullAddressParts.join(', ');

          setLocationData({
            coords: coordsString,
            address: detailAddress,
            loading: false
          });
        } catch (err) {
          console.error('Reverse Geocode Error:', err);
          setLocationData({ coords: coordsString, address: 'Lokasi terdeteksi (Alamat tidak tersedia)', loading: false });
        }
      }, (err) => {
        console.error('Geolocation error:', err);
        let msg = 'Gagal mengambil lokasi';
        if (err.code === 1) msg = 'Izin lokasi ditolak';
        else if (err.code === 3) msg = 'Waktu pencarian lokasi habis';
        
        toast.error(msg);
        setLocationData(null);
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    }, timeout);
  };

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
      
      // Stop existing tracks if any before switching
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Attempt 1: Target Facing Mode with smoother frame rate
      try {
        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 60 }
          }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        handleStream(stream);
      } catch (err) {
        console.warn(`Attempt 1 (${facingMode}) failed:`, err);
        
        // Attempt 2: Fallback to any camera without strict constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { frameRate: { ideal: 24 } } 
          });
          handleStream(stream);
        } catch (err2) {
          throw err2;
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
    // Check permission status on mount
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        setPermissionStatus(status.state as any);
        status.onchange = () => setPermissionStatus(status.state as any);
      });
    } else {
      setPermissionStatus('prompt');
    }

    startCamera();
    fetchLocation();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

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
    
    // Draw Watermark (Premium Conotas Style)
    const now = new Date();
    const timestamp = now.toLocaleString('id-ID', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }).replace(/\//g, '.').replace(' ', ', ');

    const padding = canvas.width * 0.04;
    const fontSize = Math.max(14, canvas.width * 0.032);
    const lineSpacing = fontSize * 1.2;
    
    const lines = [
      'NEUTRADC',
      timestamp,
      locationData?.coords || '',
      locationData?.address || ''
    ].filter(line => line !== '');

    // Measure for background
    context.font = `900 ${fontSize}px sans-serif`;
    let maxLineWidth = 0;
    lines.forEach(line => {
      const metrics = context.measureText(line);
      if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
    });

    const boxWidth = Math.min(canvas.width * 0.9, maxLineWidth + (padding * 2));
    const boxHeight = (lines.length * lineSpacing) + (padding * 0.6);
    
    // 2. Blue Accent Line
    context.fillStyle = '#3b82f6'; // Blue-500
    context.fillRect(0, canvas.height - boxHeight + (padding * 0.2), 4, boxHeight - (padding * 0.4));

    // 3. Draw Text
    context.textAlign = 'left';
    context.textBaseline = 'top';

    lines.forEach((line, i) => {
      const y = canvas.height - boxHeight + (i * lineSpacing) + (padding * 0.5);
      const x = padding * 0.8;

      if (i === 0) {
        // NEUTRADC - Extra Bold
        context.font = `900 ${fontSize * 1.2}px sans-serif`;
        context.fillStyle = 'white';
        context.fillText(line, x, y);
      } else if (i === 1) {
        // Timestamp
        context.font = `600 ${fontSize * 0.9}px sans-serif`;
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillText(line, x, y);
      } else if (i === 2) {
        // Coordinates with Icon
        context.font = `500 ${fontSize * 0.85}px sans-serif`;
        context.fillStyle = 'rgba(255, 255, 255, 0.85)';
        
        // Draw Pin Icon
        const iconSize = fontSize * 0.8;
        context.fillStyle = '#3b82f6';
        // Simple circle pin
        context.beginPath();
        context.arc(x + iconSize/2, y + iconSize/2, iconSize/2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'white';
        context.beginPath();
        context.arc(x + iconSize/2, y + iconSize/2, iconSize/4, 0, Math.PI * 2);
        context.fill();
        
        context.fillStyle = 'white';
        context.fillText(line, x + iconSize + 8, y);
      } else if (i === 3) {
        // Address - Italic
        context.font = `italic 400 ${fontSize * 0.75}px sans-serif`;
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.fillText(line, x, y);
      }
    });
    
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl sm:p-8"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="bg-slate-900 border border-slate-700/50 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative"
      >
        {/* Header - Made more compact */}
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
            <button
              onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
              className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400"
              title="Putar Kamera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
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
                  {/* Visual Viewfinder Guides - Simplified to a clear frame */}
                  <div className="absolute inset-8 border-2 border-white/5 rounded-2xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/40 -mt-0.5 -ml-0.5 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/40 -mt-0.5 -mr-0.5 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/40 -mb-0.5 -ml-0.5 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/40 -mb-0.5 -mr-0.5 rounded-br-lg" />
                  </div>

                  {/* Permission Prompt Overlay if not granted */}
                  {permissionStatus !== 'granted' && (
                    <div className="absolute inset-0 z-[60] bg-black/60 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="w-8 h-8 text-blue-400" />
                      </div>
                      <h4 className="text-white font-bold mb-2">Izin Lokasi Diperlukan</h4>
                      <p className="text-slate-300 text-xs leading-relaxed mb-6">
                        Untuk menambahkan watermark koordinat dan alamat di foto, kami memerlukan izin akses lokasi perangkat Anda.
                      </p>
                      <button 
                        onClick={() => fetchLocation(true)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                      >
                        Izinkan Akses Lokasi
                      </button>
                      {permissionStatus === 'denied' && (
                        <p className="mt-4 text-[10px] text-red-400 font-medium">
                          Akses ditolak. Silakan aktifkan izin lokasi di pengaturan browser Anda dan refresh halaman.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Floating Top Right Close Button (Backup) */}
                  <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[70] p-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  {/* Live Watermark Preview Overlay - Positioned INSIDE the frame nicely */}
                  {permissionStatus === 'granted' && (
                    <div className="absolute bottom-8 left-8 w-full p-4 pointer-events-none">
                      <div className="relative overflow-hidden max-w-[80%] border-l-4 border-blue-500 pl-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-black text-[13px] uppercase tracking-widest leading-none drop-shadow-lg">NEUTRADC</span>
                          <span className="text-white/90 text-[10px] font-bold drop-shadow-lg">
                            {new Date().toLocaleString('id-ID', { 
                              day: '2-digit', month: '2-digit', year: 'numeric', 
                              hour: '2-digit', minute: '2-digit', hour12: false 
                            }).replace(/\//g, '.').replace(' ', ', ')}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                              <MapPin className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className="text-white text-[10px] font-semibold drop-shadow-lg">
                              {locationData?.coords || 'Mencari Koordinat...'}
                            </span>
                          </div>
                          <span className="text-white/70 text-[9px] leading-tight italic mt-1 line-clamp-2 drop-shadow-lg">
                            {locationData?.address || 'Mencari Alamat Lokasi...'}
                          </span>
                        </div>
                      </div>
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
