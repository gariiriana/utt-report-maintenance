import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { HSEApp } from './components/HSEApp';
import { ServerLoadingIndicator } from './components/ServerLoadingIndicator';
import { HSEReportViewer } from './components/HSEReportViewer';

// Simple synchronous hash check — no hooks needed
// Users navigate to the URL directly, so hash is already set on load
function getHSEReportIdFromHash(): string | null {
  try {
    const match = window.location.hash.match(/^#\/hse\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Check once at module level — avoids hook complexity
const PUBLIC_HSE_REPORT_ID = getHSEReportIdFromHash();

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