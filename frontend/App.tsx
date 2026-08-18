// ============================================================================
// FILE: frontend/App.tsx
// Deskripsi: Root Main Component Aplikasi React (DwimitraSystem Frontend).
//            Menangani routing per peran (Role-Based Access Control / RBAC),
//            pengecekan link publik Laporan HSE via URL hash/pathname,
//            animasi transisi antar-halaman (Framer Motion), & penyediaan AuthProvider.
// ============================================================================

import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { Login } from '@/pages/Login';
import { MainApp } from '@/pages/MainApp';
import { HSEApp } from '@/pages/HSEApp';
import { DivisionApp } from '@/pages/DivisionApp';
import { SiteManagerDashboard } from '@/pages/SiteManagerDashboard';
import { DMEDashboard } from './pages/DMEDashboard';
import { DataCenterBackground } from '@/components/DataCenterBackground';
import { ServerLoadingIndicator } from '@/components/ServerLoadingIndicator';
import { HSEReportViewer } from '@/components/HSEReportViewer';
import { useEffect } from 'react';
import { logFirebaseEvent } from '@/api/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { AIChatWidget } from '@/components/AIChatWidget';

/**
 * Helper internal: Memeriksa apakah URL browser mengakses dokumen publik Laporan HSE.
 * Contoh URL: `https://report-utt.web.app/hse/REP-2026-001` atau `/#/hse/REP-2026-001`
 */
function getHSEReportIdFromUri(): string | null {
  try {
    let id: string | null = null;

    // 1. Ekstrak dari pathname URL
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const hseIdx = pathParts.indexOf('hse');
    if (hseIdx !== -1 && pathParts[hseIdx + 1]) {
      id = pathParts[hseIdx + 1];
    }

    // 2. Ekstrak dari URL Hash jika dari pathname tidak ditemukan
    if (!id) {
      const hashParts = window.location.hash.replace('#', '').split('/').filter(Boolean);
      const hseHashIdx = hashParts.indexOf('hse');
      if (hseHashIdx !== -1 && hashParts[hseHashIdx + 1]) {
        id = hashParts[hseHashIdx + 1];
      }
    }

    // 3. Bersihkan tanda baca di akhir ID (titik, koma, dsb)
    if (id) {
      id = id.trim().replace(/[.,!?;:]+$/, '');
    }

    if (id) {
      console.log('[HSE DEBUG] Detected ID:', id, { path: window.location.pathname, hash: window.location.hash });
    }

    return id;
  } catch {
    return null;
  }
}

// Variabel konstanta global pendeteksi akses publik HSE Report
const PUBLIC_HSE_REPORT_ID = getHSEReportIdFromUri();

/**
 * Komponen Internal 1: `AppContent()`
 * Menampilkan halaman sesuai role user yang sedang terautentikasi.
 */
function AppContent() {
  const { user, userRole, loading } = useAuth();

  // 1. Tampilkan indikator loading server saat autentikasi diproses
  if (loading) {
    return <ServerLoadingIndicator />;
  }

  return (
    <div className="relative z-10 w-full flex-1 flex flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {user ? (
          <motion.div
            key={`private-${userRole}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col w-full"
          >
            {/* Routing Komponen Berdasarkan Role User */}
            <div className="flex-1 flex flex-col w-full">
              {(() => {
                if (userRole === 'hse') return <HSEApp />;
                const isoRoles = ['pmo', 'sales', 'presales', 'purchasing', 'dirut', 'direksiSDM', 'DireksiKeuangan'];
                if (isoRoles.includes(userRole || '')) return <DivisionApp />;
                if (userRole === 'site_manager_dme') return <DMEDashboard />;
                if (userRole === 'site_manager' || userRole === 'manager') return <SiteManagerDashboard />;
                return <MainApp />;
              })()}
            </div>
            
            {/* Widget Asisten Chatbot AI (Tampil untuk semua user login) */}
            <AIChatWidget />
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col w-full"
          >
            <Login />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Komponen Internal 2: `AppWithBackground()`
 * Menyuplai latar belakang tema Data Center & Toaster Notification terpusat.
 */
function AppWithBackground() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-blue-100 text-slate-800 overflow-x-hidden">
      {/* Visual Animasi Data Center Canvas Background */}
      <DataCenterBackground />

      {/* Tampilkan Viewer Publik jika URL mengarah ke Laporan HSE */}
      {PUBLIC_HSE_REPORT_ID ? (
        <div className="relative z-10">
          <HSEReportViewer reportId={PUBLIC_HSE_REPORT_ID} />
        </div>
      ) : (
        <AppContent />
      )}

      {/* Notifikasi Toast Terpusat Aplikasi */}
      <Toaster position="top-center" theme="light" richColors />
    </div>
  );
}

/** Root Export Entry Component `App` */
export default function App() {
  useEffect(() => {
    // Analytics Log Firebase Analytics session start
    logFirebaseEvent('session_start', {
      timestamp: new Date().toISOString(),
      platform: 'web'
    });
  }, []);

  return (
    <AuthProvider>
      <AppWithBackground />
    </AuthProvider>
  );
}
