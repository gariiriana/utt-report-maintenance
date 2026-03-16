import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/components/AuthContext';
import { Login } from '@/components/Login';
import { MainApp } from '@/components/MainApp';
import { HSEApp } from '@/components/HSEApp';
import { ServerLoadingIndicator } from '@/components/ServerLoadingIndicator';
import { HSEReportViewer } from '@/components/HSEReportViewer';
import { useEffect } from 'react';
import { logFirebaseEvent } from '@/api/firebase';


// Detect Public HSE Report ID from Hash OR Path
function getHSEReportIdFromUri(): string | null {
  try {
    let id: string | null = null;
    
    // 1. Try Path (e.g., /hse/ID or /f/hse/ID)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const hseIdx = pathParts.indexOf('hse');
    if (hseIdx !== -1 && pathParts[hseIdx + 1]) {
      id = pathParts[hseIdx + 1];
    }

    // 2. Try Hash (e.g., #/hse/ID)
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

// Check once at module level — avoids hook complexity
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
    return <MainApp />;
  }

  return <Login />;
}

export default function App() {
  // ✅ Log session start for Firebase Analytics
  useEffect(() => {
    logFirebaseEvent('session_start', {
      timestamp: new Date().toISOString(),
      platform: 'web'
    });
  }, []);

  // ✅ Public HSE viewer route: #/hse/{id}

  // Checked before AuthProvider — no login required
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