import { Suspense, lazy, useEffect, useState } from 'react';
import { ClipboardList, FolderOpen, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/components/AuthContext';
import { AppSidebar, NavItemDef } from '@/components/AppSidebar';
import { LogoutConfirmModal } from '@/components/LogoutConfirmModal';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import { startBOQOutbox, stopBOQOutbox, useBOQOutbox } from '@/utils/boqOutbox';

const BOQUpdate = lazy(() => import('@/components/BOQUpdate').then(module => ({ default: module.BOQUpdate })));
const FileManagement = lazy(() => import('@/components/FileManagement').then(module => ({ default: module.FileManagement })));

const DRAFTER_NAV_ITEMS: readonly NavItemDef[] = [
  { id: 'files', label: 'Management File', icon: FolderOpen, color: 'from-sky-500 to-blue-600', show: true },
  { id: 'boq', label: 'Update BOQ', icon: ClipboardList, color: 'from-blue-600 to-indigo-600', show: true },
];

export function DrafterApp() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'boq' | 'files'>('boq');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const currentNavItem = DRAFTER_NAV_ITEMS.find(item => item.id === tab);
  const outbox = useBOQOutbox();
  const waiting = outbox.pendingTexts + outbox.pendingPhotos + outbox.pendingDeletes + outbox.conflicts;

  // The BOQ outbox keeps sending queued edits and photos while the drafter is anywhere in the app.
  useEffect(() => {
    if (!user?.uid) return;
    void startBOQOutbox({ uid: user.uid, name: user.displayName || user.email || '' });
    return () => stopBOQOutbox();
  }, [user?.uid]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (waiting > 0) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [waiting]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50">
      <AppSidebar
        user={user}
        activeTab={tab}
        setActiveTab={setTab}
        navItems={DRAFTER_NAV_ITEMS}
        pendingDeleteCount={0}
        totalAbnormalCount={0}
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onLogoutClick={() => setLogoutModalOpen(true)}
      />

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-80'}`}>
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-sky-100/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <img src={logoDwimitra} alt="PT Dwimitra Ekatama Mandiri" className="h-7 w-7 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-bold leading-tight text-slate-900">PT Dwimitra Ekatama Mandiri</p>
                <p className="mt-0.5 truncate text-[9.5px] font-medium text-slate-500">Sistem Pemeliharaan Data Center</p>
              </div>
            </div>
            <h1 className="hidden truncate text-base font-bold text-slate-900 md:block">{currentNavItem?.label || 'Drafter'}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Masuk sebagai</p>
              <p className="max-w-[260px] truncate text-sm font-semibold text-slate-700">{user?.email}</p>
            </div>
            <button onClick={() => setLogoutModalOpen(true)} className="hidden cursor-pointer rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 md:flex" title="Keluar Sesi" aria-label="Keluar Sesi">
              <LogOut className="h-5 w-5" />
            </button>
            <button onClick={() => setMobileMenuOpen(true)} className="cursor-pointer rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-700 shadow-sm hover:bg-slate-200 md:hidden" title="Buka Menu" aria-label="Buka Menu">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 md:px-6 md:py-6">
          <Suspense fallback={<p role="status" className="p-6 text-center text-slate-500">Memuat modul…</p>}>
            {tab === 'boq' ? <BOQUpdate /> : <FileManagement allowUpload fileOnly />}
          </Suspense>
        </main>
      </div>

      <LogoutConfirmModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={logout}
        userEmail={user?.email || ''}
        warning={waiting > 0 ? `${waiting} data/foto BOQ belum terkirim ke server. Datanya tetap tersimpan di HP ini dan akan dikirim saat Anda login lagi di HP ini — jangan hapus data browser.` : undefined}
      />
    </div>
  );
}
