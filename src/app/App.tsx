import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { HSEApp } from './components/HSEApp';
import { ServerLoadingIndicator } from './components/ServerLoadingIndicator';
import { HSEReportViewer } from './components/HSEReportViewer';

// ── Hash-based router (no react-router needed) ─────────────────────────────
// Route: #/hse/{id}  →  public HSE report viewer (no auth needed)
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

function parseHSEViewerRoute(hash: string): string | null {
  // Matches: #/hse/SOME_FIRESTORE_ID
  const match = hash.match(/^#\/hse\/([a-zA-Z0-9]+)$/);
  return match ? match[1] : null;
}

function AppContent() {
  const { user, userRole, loading } = useAuth();
  const hash = useHashRoute();
  const hseReportId = parseHSEViewerRoute(hash);

  // ✅ Public HSE viewer - accessible without login
  if (hseReportId) {
    return <HSEReportViewer reportId={hseReportId} />;
  }

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
  return (
    <>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster position="top-center" richColors />
    </>
  );
}