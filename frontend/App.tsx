import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { Login } from '@/pages/Login';
import { MainApp } from '@/pages/MainApp';
import { HSEApp } from '@/pages/HSEApp';
import { DivisionApp } from '@/pages/DivisionApp';
import { SiteManagerDashboard } from '@/pages/SiteManagerDashboard';
import { ServerLoadingIndicator } from '@/components/ServerLoadingIndicator';
import { HSEReportViewer } from '@/components/HSEReportViewer';
import { useEffect } from 'react';
import { logFirebaseEvent } from '@/api/firebase';


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

  if (user) {
    if (userRole === 'hse') {
      return <HSEApp />;
    }
    const isoRoles = ['pmo', 'sales', 'presales', 'purchasing', 'dirut', 'direksiSDM', 'DireksiKeuangan'];
    if (isoRoles.includes(userRole || '')) {
      return <DivisionApp />;
    }
    if (userRole === 'site_manager' || userRole === 'manager') {
      return <SiteManagerDashboard />;
    }
    return <MainApp />;
  }

  return <Login />;
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
      <>
        <HSEReportViewer reportId={PUBLIC_HSE_REPORT_ID} />
        <Toaster position="top-center" richColors />
      </>
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