// ============================================================================
// FILE: frontend/components/FaceGate.tsx
// Deskripsi: Gerbang scan wajah setelah login password (2FA akun bersama).
//            Akses aplikasi hanya diberikan bila sesi perangkat ini membawa
//            klaim faceUntil yang masih berlaku. Wajah didaftarkan sekali per
//            orang dan berlaku untuk login ke akun mana pun. Alur:
//              scan → cocok → masuk
//              scan → tidak cocok → daftar wajah → menunggu approval QC DME
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanFace, LogOut, Loader2, ShieldAlert, Clock, CheckCircle2, XCircle, KeyRound, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { callFace } from '@/api/faceApi';
import { useAuth } from '@/components/AuthContext';
import { FaceScanner, FaceScanResult, type ScanIssue } from '@/components/FaceScanner';
import { describeDevice } from '@/utils/faceRecognitionService';
import { FACE_EXEMPT_EMAILS, type FaceEnrollResult, type FaceGateState, type FaceVerifyResult } from '@/types/faceAuthTypes';

type View = 'loading' | 'intro' | 'scan' | 'verifying' | 'nomatch' | 'enroll-form' | 'enroll-scan' | 'submitting' | 'pending' | 'breakglass' | 'error';

// Pengajuan wajah berlaku lintas akun, jadi disimpan per perangkat (bukan per akun).
const ENROLLMENTS_KEY = 'dwimitra_face_enrollments';
// Cek berkala hanya untuk menutup layar; akses data orang yang wajahnya dihapus sudah
// ditolak seketika oleh rules. 5 menit menghemat kuota baca Firestore (paket Spark).
const SESSION_CHECK_MS = 5 * 60_000;
// WhatsApp QC DME untuk follow up approval wajah (0857-2337-5324, format internasional).
const QC_WHATSAPP = '6285723375324';

/**
 * Link WhatsApp berisi pesan siap kirim: minta approval atas nama dan perusahaan.
 * Tanpa data pengajuan (dibuat di perangkat lain), user mengisi sendiri nama/perusahaannya.
 */
function approvalWhatsAppLink(name: string, company: string, accountEmail: string) {
  const text = [
    'Halo QC DME, saya sudah mengajukan pendaftaran wajah di Dwimitra System dan mohon di-approve.',
    '',
    `Nama: ${name || '(isi nama lengkap)'}`,
    `Perusahaan: ${company || '(isi perusahaan)'}`,
    `Akun login: ${accountEmail}`,
    '',
    'Terima kasih.'
  ].join('\n');
  return `https://wa.me/${QC_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value); } catch { /* storage diblokir */ }
}

function callableMessage(err: any): string {
  return err?.message || 'Terjadi kesalahan. Coba lagi.';
}

/** Laporkan kendala teknis scan ke log audit QC. Gagal kirim diabaikan. */
function reportScanIssue(issue: ScanIssue, detail: string) {
  callFace('scan-issue', { issue, detail, device: describeDevice() }).catch(() => undefined);
}

export function FaceGate({ children }: { children: React.ReactNode }) {
  const { user, userRole, faceSession, faceChecked, completeFaceVerification, endFaceSession, logout } = useAuth();
  const uid = user?.uid || '';
  const [view, setView] = useState<View>('loading');
  const [state, setState] = useState<FaceGateState | null>(null);
  const [errorText, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');

  const isReviewer = (user?.email || '').toLowerCase() === 'qcdme@dme.com' || userRole === 'admin' || userRole === 'qc_dme';
  const isExempt = FACE_EXEMPT_EMAILS.includes((user?.email || '').toLowerCase());

  const refreshState = useCallback(async () => {
    const ids = readJson<string[]>(localStorage, ENROLLMENTS_KEY, []);
    const res = await callFace<FaceGateState>('state', { enrollmentIds: ids });
    setState(res);
    return res;
  }, []);

  useEffect(() => {
    if (!uid || !faceChecked || faceSession || isExempt) return;
    let cancelled = false;
    setView('loading');
    refreshState()
      .then((s) => {
        if (cancelled) return;
        const hasPending = s.enrollments.some((e) => e.status === 'pending');
        const hasApproved = s.enrollments.some((e) => e.status === 'approved');
        setView(hasPending && !hasApproved ? 'pending' : 'intro');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorText(callableMessage(err));
        setView('error');
      });
    return () => { cancelled = true; };
  }, [uid, faceChecked, faceSession, isExempt, refreshState]);

  // Wajah yang dihapus QC (misal resign) harus langsung kehilangan akses: cek saat
  // aplikasi dibuka, berkala, dan saat kembali ke aplikasi. Server memakai jamnya sendiri,
  // jadi sesi yang sudah habis tetap terdeteksi walau jam perangkat salah.
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const endFaceSessionRef = useRef(endFaceSession);
  endFaceSessionRef.current = endFaceSession;
  useEffect(() => {
    if (!faceSession || isExempt) return;
    let stopped = false;
    const check = async () => {
      try {
        const res = await callFace<{ valid: boolean; reason?: string }>('check-session');
        if (stopped || res.valid) return;
        stopped = true;
        if (res.reason === 'expired') {
          toast.info('Sesi wajah 12 jam sudah habis. Silakan scan wajah lagi.');
          endFaceSessionRef.current();
        } else {
          toast.error('Akses wajah Anda sudah dicabut oleh QC DME.');
          await logoutRef.current();
        }
      } catch {
        // Offline / gangguan jaringan: coba lagi di putaran berikutnya.
      }
    };
    check();
    const interval = setInterval(check, SESSION_CHECK_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [faceSession, isExempt]);

  // Akses diberikan: akun dikecualikan atau sudah lolos scan wajah.
  if (!user || isExempt) return <>{children}</>;
  if (faceSession) return <>{children}</>;
  if (!faceChecked) return <CenteredLoader />;

  const handleVerify = async (scan: FaceScanResult) => {
    setView('verifying');
    try {
      const res = await callFace<FaceVerifyResult>('verify', { descriptors: scan.descriptors, device: describeDevice() });
      if (res.matched && res.token) {
        await completeFaceVerification(res.token);
        toast.success(`Selamat datang, ${res.person}`);
        return;
      }
      setView('nomatch');
    } catch (err) {
      setErrorText(callableMessage(err));
      setView('error');
    }
  };

  const handleEnroll = async (scan: FaceScanResult) => {
    setView('submitting');
    try {
      const res = await callFace<FaceEnrollResult>('enroll', {
        name, company, consent, descriptors: scan.descriptors, photos: scan.photos, device: describeDevice()
      });
      if (res.alreadyRegistered || !res.id) {
        setNotice('Wajah Anda sudah terdaftar dan disetujui QC DME, jadi tidak perlu daftar lagi. Tekan "Mulai Scan Wajah" untuk masuk.');
        setView('intro');
        return;
      }
      const newId = res.id;
      const ids = readJson<string[]>(localStorage, ENROLLMENTS_KEY, []).filter((id) => id !== newId);
      writeStorage(localStorage, ENROLLMENTS_KEY, JSON.stringify([newId, ...ids].slice(0, 10)));
      // Langsung tampilkan status + tombol WhatsApp dari data yang baru dikirim; tidak
      // menunggu (atau gagal karena) pemanggilan status berikutnya.
      const mine = { id: newId, name: name.trim(), company: company.trim(), status: 'pending' as const, rejectReason: '' };
      setState((s) => ({ enrollments: [mine, ...(s?.enrollments || []).filter((e) => e.id !== newId)] }));
      setView('pending');
      refreshState().catch(() => undefined);
    } catch (err) {
      setErrorText(callableMessage(err));
      setView('error');
    }
  };

  const handleBreakGlass = async () => {
    setView('verifying');
    try {
      const res = await callFace<{ token: string }>('break-glass', { code: code.trim() });
      await completeFaceVerification(res.token);
      toast.warning('Akses darurat aktif selama 2 jam. Segera daftarkan wajah Anda.');
    } catch (err) {
      setCode('');
      setErrorText(callableMessage(err));
      setView('error');
    }
  };

  const pendingList = state?.enrollments || [];
  // Pengajuan terbaru yang masih menunggu (ID disimpan terbaru di depan).
  const waitingEnrollment = pendingList.find((e) => e.status === 'pending');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col gap-5">
        <header className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
            <ScanFace className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">Verifikasi Wajah</h1>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </header>


        {view === 'loading' && <CenteredLoader inline />}

        {view === 'intro' && (
          <div className="flex flex-col gap-3">
            {notice && (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {notice}
              </div>
            )}
            <p className="text-sm text-slate-600">
              Scan wajah untuk memastikan Anda personel yang terdaftar. Wajah yang sudah disetujui berlaku untuk login ke akun mana pun.
            </p>
            <button type="button" onClick={() => setView('scan')} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Mulai Scan Wajah
            </button>
            <button type="button" onClick={() => setView('enroll-form')} className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium">
              Wajah saya belum terdaftar
            </button>
            <button type="button" onClick={() => setView('pending')} className="text-sm text-blue-600 underline self-center">
              {waitingEnrollment ? 'Pengajuan Anda sedang menunggu QC, lihat status' : 'Lihat status pengajuan / hubungi QC'}
            </button>
          </div>
        )}

        {view === 'scan' && <FaceScanner mode="verify" onComplete={handleVerify} onCancel={() => setView('intro')} onIssue={reportScanIssue} />}

        {(view === 'verifying' || view === 'submitting') && (
          <CenteredLoader inline text={view === 'verifying' ? 'Mencocokkan wajah...' : 'Mengirim pengajuan...'} />
        )}

        {view === 'nomatch' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <XCircle className="w-5 h-5 shrink-0" />
              Wajah tidak cocok dengan personel yang terdaftar dan disetujui QC DME.
            </div>
            <p className="text-xs text-slate-500">
              Sudah terdaftar tapi tetap gagal di perangkat ini (misalnya kamera laptop)? Coba di tempat yang lebih terang. Kalau masih gagal, ajukan pendaftaran dari perangkat ini dengan nama yang sama. QC akan menggabungkannya ke wajah Anda.
            </p>
            <button type="button" onClick={() => setView('scan')} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Coba Lagi
            </button>
            <button type="button" onClick={() => setView('enroll-form')} className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium">
              Ajukan Pendaftaran Wajah
            </button>
          </div>
        )}

        {view === 'enroll-form' && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); setView('enroll-scan'); }}
          >
            <p className="text-sm text-slate-600">Cukup daftar sekali. Setelah disetujui QC DME, wajah Anda berlaku untuk login ke akun mana pun.</p>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nama lengkap
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required minLength={3} maxLength={80}
                placeholder="Contoh: Riyan Bayu Nugroho"
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Perusahaan
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required minLength={2} maxLength={80}
                placeholder="Contoh: PT Dwimitra Ekatama Mandiri"
                className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5" />
              Saya setuju foto dan data wajah saya disimpan untuk keperluan verifikasi login DwimitraSystem, dan dihapus saat saya tidak lagi bertugas.
            </label>
            <button type="submit" disabled={!consent || name.trim().length < 3 || company.trim().length < 2} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold">
              Lanjut ke Kamera
            </button>
            <button type="button" onClick={() => setView('intro')} className="text-sm text-slate-500 underline">Kembali</button>
          </form>
        )}

        {view === 'enroll-scan' && <FaceScanner mode="enroll" onComplete={handleEnroll} onCancel={() => setView('enroll-form')} onIssue={reportScanIssue} />}

        {view === 'pending' && (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {pendingList.length === 0 && (
                <li className="text-sm text-slate-500">
                  Belum ada pengajuan dari browser ini. Pengajuan yang dibuat di HP atau browser lain hanya terlihat di perangkat itu. Kalau sudah mendaftar di perangkat lain, hubungi QC lewat tombol di bawah.
                </li>
              )}
              {pendingList.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-700 truncate">{e.name}</span>
                    {e.company && <span className="block text-xs text-slate-500 truncate">{e.company}</span>}
                  </span>
                  {e.status === 'pending' && <span className="flex items-center gap-1 text-amber-600 text-xs"><Clock className="w-4 h-4" />Menunggu QC</span>}
                  {e.status === 'approved' && <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-4 h-4" />Disetujui</span>}
                  {e.status === 'rejected' && <span className="flex items-center gap-1 text-red-600 text-xs" title={e.rejectReason}><XCircle className="w-4 h-4" />Ditolak</span>}
                </li>
              ))}
            </ul>
            {(waitingEnrollment || pendingList.length === 0) && !pendingList.some((e) => e.status === 'approved') && (
              <div className="flex flex-col gap-1.5">
                <a
                  href={approvalWhatsAppLink(waitingEnrollment?.name || '', waitingEnrollment?.company || '', user.email || '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <MessageCircle className="w-5 h-5" /> Minta Approval via WhatsApp
                </a>
                <p className="text-xs text-slate-500 text-center">
                  Pesan berisi nama dan perusahaan Anda ke QC DME (0857-2337-5324). Setelah disetujui, tekan Periksa Status Lagi.
                </p>
              </div>
            )}
            {pendingList.some((e) => e.status === 'approved') ? (
              <button type="button" onClick={() => setView('scan')} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Scan Wajah Sekarang
              </button>
            ) : (
              <button
                type="button"
                onClick={() => refreshState()
                  .then((s) => {
                    if (s.enrollments.some((e) => e.status === 'pending')) toast.info('Pengajuan masih menunggu persetujuan QC DME.');
                  })
                  .catch((err) => toast.error(callableMessage(err)))}
                className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
              >
                Periksa Status Lagi
              </button>
            )}
            <button type="button" onClick={() => setView('intro')} className="text-sm text-slate-500 underline">Kembali</button>
          </div>
        )}

        {view === 'breakglass' && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); handleBreakGlass(); }}>
            <p className="text-sm text-slate-600">Masukkan kode akses darurat. Penggunaan kode ini dicatat di log audit.</p>
            <input
              type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required
              className="rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold">Masuk dengan Kode Darurat</button>
            <button type="button" onClick={() => setView('intro')} className="text-sm text-slate-500 underline">Kembali</button>
          </form>
        )}

        {view === 'error' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              {errorText}
            </div>
            <button type="button" onClick={() => setView('intro')} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Kembali
            </button>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
          {isReviewer && view !== 'breakglass' && (
            <button type="button" onClick={() => setView('breakglass')} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <KeyRound className="w-3.5 h-3.5" /> Akses darurat
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function CenteredLoader({ inline, text }: { inline?: boolean; text?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-slate-500 ${inline ? 'py-10' : 'min-h-screen'}`}>
      <Loader2 className="w-7 h-7 animate-spin" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
