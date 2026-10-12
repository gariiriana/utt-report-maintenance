// ============================================================================
// FILE: frontend/components/OfflineBanner.tsx
// Deskripsi: Penanda kecil saat HP tidak punya koneksi internet, atau masih ada data
//            tersimpan di HP yang belum terkirim (sinyal lemah).
//            Aplikasi terpasang (PWA) tetap bisa dibuka tanpa sinyal karena tersimpan
//            di HP, jadi user perlu tahu kenapa data tidak muncul / belum terkirim.
// ============================================================================

import { useEffect, useState } from 'react';
import { Loader2, WifiOff } from 'lucide-react';
import { hasQueuedWrites, subscribeQueuedWrites } from '@/utils/offlineWrite';

export function OfflineBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [hasQueued, setHasQueued] = useState(hasQueuedWrites);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const unsubscribe = subscribeQueuedWrites(setHasQueued);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      unsubscribe();
    };
  }, []);

  if (online && !hasQueued) return null;

  return (
    <div role="status" data-offline-banner className="pointer-events-none fixed inset-x-0 top-0 z-[10002] flex justify-center px-3 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="flex max-w-full items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm sm:text-xs">
        {online ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-300" />
            <span>Sinyal lemah — mengirim data yang tersimpan di HP…</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              {hasQueued
                ? 'Tidak ada internet — data tersimpan di HP, terkirim otomatis saat sinyal kembali'
                : 'Tidak ada internet — data baru muncul / terkirim saat sinyal kembali'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
