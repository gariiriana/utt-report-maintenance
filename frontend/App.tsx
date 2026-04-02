import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { Login } from '@/pages/Login';
import { MainApp } from '@/pages/MainApp';
import { HSEApp } from '@/pages/HSEApp';
import { DivisionApp } from '@/pages/DivisionApp';
import { SiteManagerDashboard } from '@/pages/SiteManagerDashboard';
import { InventoryApp } from '@/pages/InventoryApp';
import { DataCenterBackground } from '@/components/DataCenterBackground';
import { ServerLoadingIndicator } from '@/components/ServerLoadingIndicator';
import { HSEReportViewer } from '@/components/HSEReportViewer';
import { useEffect } from 'react';
import { logFirebaseEvent } from '@/api/firebase';
import { motion, AnimatePresence } from 'motion/react';


function getHSEReportIdFromUri(): string | null {
  try {
    let id: string | null = null;
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const hseIdx = pathParts.indexOf('hse');
    if (hseIdx !== -1 && pathParts[hseIdx + 1]) {
      id = pathParts[hseIdx + 1];
    }

    if (!id) {
      const hashParts = window.location.hash.replace('#', '').split('/').filter(Boolean); 
      const hseHashIdx = hashParts.indexOf('hse');
      if (hseHashIdx !== -1 && hashParts[hseHashIdx + 1]) {
        id = hashParts[hseHashIdx + 1];
      }
    }

    if (id) {
      id = id.trim().replace(/[.,!?;:]+$/, '');
    }

    console.log('[HSE DEBUG] Detected ID:', id, { path: window.location.pathname, hash: window.location.hash });

    return id;
  } catch {
    return null;
  }
}

const PUBLIC_HSE_REPORT_ID = getHSEReportIdFromUri();

function AppContent() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return <ServerLoadingIndicator />;
  }

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-x-hidden">
      {/* 
        Stabilize the background at the App level. 
        This prevents the 'removeChild' error and flickering when switching pages.
      */}
      <DataCenterBackground />
      
      <div className="relative z-10 w-full min-h-screen">
        <AnimatePresence mode="wait">
          {user ? (
            <motion.div
              key={`private-${userRole}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {(() => {
                if (userRole === 'hse') return <HSEApp />;
                const isoRoles = ['pmo', 'sales', 'presales', 'purchasing', 'dirut', 'direksiSDM', 'DireksiKeuangan'];
                if (isoRoles.includes(userRole || '')) return <DivisionApp />;
                if (userRole === 'site_manager' || userRole === 'manager') return <SiteManagerDashboard />;
                if (userRole === 'inventory') return <InventoryApp />;
                return <MainApp />;
              })()}
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <Login />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    logFirebaseEvent('session_start', {
      timestamp: new Date().toISOString(),
      platform: 'web'
    });
  }, []);


  if (PUBLIC_HSE_REPORT_ID) {
    return (
      <div className="relative min-h-screen bg-slate-950">
        <DataCenterBackground />
        <div className="relative z-10">
          <HSEReportViewer reportId={PUBLIC_HSE_REPORT_ID} />
          <Toaster position="top-center" richColors />
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster position="top-center" richColors />
    </>
  );
}