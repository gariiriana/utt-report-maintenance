import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { HSEApp } from './components/HSEApp';
import { ServerLoadingIndicator } from './components/ServerLoadingIndicator';
import { HSEReportViewer } from './components/HSEReportViewer';

// Detect Public HSE Report ID from Hash OR Path
function getHSEReportIdFromUri(): string | null {
  try {
    // 1. Try Hash (original format: #/hse/ID)
    const hashMatch = window.location.hash.match(/^#\/hse\/([a-zA-Z0-9_-]+)$/);
    if (hashMatch) return hashMatch[1];

    // 2. Try Path (alternative format: /f/hse/ID or /hse/ID)
    const pathMatch = window.location.pathname.match(/\/(?:f\/)?hse\/([a-zA-Z0-9_-]+)$/);
    if (pathMatch) return pathMatch[1];

    return null;
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