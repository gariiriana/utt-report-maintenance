import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './components/AuthContext';
import { Login } from './components/Login';
import { MainApp } from './components/MainApp';
import { ServerLoadingIndicator } from './components/ServerLoadingIndicator';

function AppContent() {
  const { user, loading } = useAuth();

  // ✅ Show loading indicator while checking auth state
  if (loading) {
    return <ServerLoadingIndicator />;
  }

  if (user) {
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