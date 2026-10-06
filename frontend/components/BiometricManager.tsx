// ============================================================================
// FILE: frontend/components/BiometricManager.tsx
// Deskripsi: Pusat Biometrik untuk QC DME / admin:
//            - Antrean pengajuan wajah (setujui / tolak) dengan foto & perangkat
//            - Daftar wajah aktif per akun bersama + hapus (personel resign)
//            - Log audit login wajah, pengajuan, approval, akses darurat
//            Semua data wajah diambil lewat Cloud Functions (koleksi tertutup).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScanFace, Check, X, Trash2, RefreshCw, Loader2, History, Merge } from 'lucide-react';
import { toast } from 'sonner';
import { callFace } from '@/api/faceApi';
import type { FaceAdminProfile, FaceAuditEntry } from '@/types/faceAuthTypes';

type Tab = 'pending' | 'approved' | 'rejected' | 'audit';

const AUDIT_LABELS: Record<string, string> = {
  verify_success: 'Login wajah berhasil',
  verify_failed: 'Login wajah gagal',
  enroll_requested: 'Pengajuan wajah',
  enroll_already_registered: 'Daftar ulang (wajah sudah aktif)',
  enroll_approved: 'Pengajuan disetujui',
  enroll_rejected: 'Pengajuan ditolak',
  enroll_merged: 'Digabung ke wajah aktif',
  face_deleted: 'Wajah dihapus',
  scan_issue: 'Scan gagal (teknis)',
  break_glass_used: 'Akses darurat dipakai',
  break_glass_failed: 'Kode darurat salah',
  mode_changed: 'Mode diubah (fitur lama)'
};

const ISSUE_LABELS: Record<string, string> = {
  camera_denied: 'izin kamera ditolak',
  camera_missing: 'kamera tidak ditemukan',
  camera_busy: 'kamera tidak bisa dibuka',
  camera_unsupported: 'browser tidak mendukung kamera',
  model_load: 'model gagal diunduh',
  detect_error: 'GPU bermasalah, pindah ke CPU',
  timeout: 'waktu scan habis'
};

function formatTime(ms: number | null) {
  return ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function callableMessage(err: any): string {
  return err?.message || 'Terjadi kesalahan.';
}

export function BiometricManager() {
  const [tab, setTab] = useState<Tab>('pending');
  const [profiles, setProfiles] = useState<FaceAdminProfile[]>([]);
  const [audit, setAudit] = useState<FaceAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, log] = await Promise.all([
        callFace<{ profiles: FaceAdminProfile[] }>('admin/list'),
        callFace<{ entries: FaceAuditEntry[] }>('admin/audit')
      ]);
      setProfiles(list.profiles);
      setAudit(log.entries);
    } catch (err) {
      toast.error(callableMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byStatus = useMemo(() => ({
    pending: profiles.filter((p) => p.status === 'pending'),
    approved: profiles.filter((p) => p.status === 'approved'),
    rejected: profiles.filter((p) => p.status === 'rejected')
  }), [profiles]);

  const review = async (p: FaceAdminProfile, approve: boolean) => {
    let reason = '';
    if (!approve) {
      const input = window.prompt(`Alasan menolak pengajuan "${p.name}" (opsional):`);
      if (input === null) return;
      reason = input;
    }
    setBusyId(p.id);
    try {
      await callFace('admin/review', { id: p.id, approve, reason });
      toast.success(approve ? `Wajah ${p.name} disetujui, berlaku untuk semua akun` : `Pengajuan ${p.name} ditolak`);
      await load();
    } catch (err) {
      toast.error(callableMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const merge = async (p: FaceAdminProfile, target: FaceAdminProfile) => {
    if (!window.confirm(`Gabungkan pengajuan "${p.name}" ke wajah aktif "${target.name}"?\n\nLakukan hanya jika dari fotonya ini orang yang SAMA, misalnya mendaftar lagi dari laptop atau HP lain. Setelah digabung, ${target.name} bisa login dari perangkat itu juga.`)) return;
    setBusyId(p.id);
    try {
      await callFace('admin/merge', { id: p.id, intoId: target.id });
      toast.success(`Pengajuan digabung ke wajah ${target.name}`);
      await load();
    } catch (err) {
      toast.error(callableMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: FaceAdminProfile) => {
    if (!window.confirm(`Hapus wajah "${p.name}"?\n\nAksesnya langsung dicabut di semua akun. Foto dan data wajahnya dihapus permanen.`)) return;
    setBusyId(p.id);
    try {
      await callFace('admin/delete', { id: p.id });
      toast.success(`Wajah ${p.name} dihapus, aksesnya sudah dicabut`);
      await load();
    } catch (err) {
      toast.error(callableMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Menunggu', count: byStatus.pending.length },
    { id: 'approved', label: 'Wajah Aktif', count: byStatus.approved.length },
    { id: 'rejected', label: 'Ditolak', count: byStatus.rejected.length },
    { id: 'audit', label: 'Log Audit' }
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Pusat Biometrik</h2>
            <p className="text-sm text-slate-500">Wajah personel didaftarkan sekali dan berlaku untuk semua akun</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50" title="Muat ulang">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs rounded-full bg-slate-100 px-2 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading && profiles.length === 0 ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="w-7 h-7 animate-spin" /></div>
      ) : tab === 'audit' ? (
        <AuditTable entries={audit} />
      ) : (
        <ProfileGrid
          items={byStatus[tab]}
          approved={byStatus.approved}
          tab={tab}
          busyId={busyId}
          onApprove={(p) => review(p, true)}
          onReject={(p) => review(p, false)}
          onMerge={merge}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function ProfileGrid({ items, approved, tab, busyId, onApprove, onReject, onMerge, onDelete }: {
  items: FaceAdminProfile[];
  approved: FaceAdminProfile[];
  tab: Exclude<Tab, 'audit'>;
  busyId: string | null;
  onApprove: (p: FaceAdminProfile) => void;
  onReject: (p: FaceAdminProfile) => void;
  onMerge: (p: FaceAdminProfile, target: FaceAdminProfile) => void;
  onDelete: (p: FaceAdminProfile) => void;
}) {
  if (items.length === 0) {
    const empty = { pending: 'Tidak ada pengajuan yang menunggu.', approved: 'Belum ada wajah yang disetujui.', rejected: 'Tidak ada pengajuan yang ditolak.' }[tab];
    return <p className="text-sm text-slate-500 py-10 text-center">{empty}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => {
        // Pengajuan yang mirip wajah AKTIF bisa digabung ke wajah itu (orang sama, perangkat lain).
        const mergeTarget = tab === 'pending' && p.possibleDuplicateId ? approved.find((a) => a.id === p.possibleDuplicateId) : undefined;
        return (
        <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {p.photos.length > 0 ? p.photos.slice(0, 4).map((src, i) => (
              <img key={i} src={src} alt={`Foto ${p.name} ${i + 1}`} className="w-16 h-16 rounded-lg object-cover bg-slate-100" />
            )) : <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><ScanFace className="w-6 h-6" /></div>}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{p.name}</p>
            <p className="text-sm text-slate-700 truncate">{p.company || 'Perusahaan tidak diisi'}</p>
            <p className="text-sm text-slate-600 truncate">Diajukan dari akun <span className="text-blue-700">{p.accountEmail}</span></p>
            <p className="text-xs text-slate-500 mt-1">Diajukan {formatTime(p.requestedAt)} · {p.device || 'perangkat tidak diketahui'}</p>
            {p.reviewedBy && <p className="text-xs text-slate-500">Ditinjau {p.reviewedBy} · {formatTime(p.reviewedAt)}</p>}
            {p.rejectReason && <p className="text-xs text-red-600">Alasan: {p.rejectReason}</p>}
            {tab === 'pending' && p.possibleDuplicateOf && (
              <p className="mt-1 text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1">
                ⚠ Wajahnya mirip <b>{p.possibleDuplicateOf}</b>{mergeTarget ? ' (wajah aktif)' : ''}. Bandingkan fotonya.
                {mergeTarget
                  ? ' Kalau orangnya sama (daftar lagi dari perangkat lain), pilih Gabungkan. Kalau orang lain, Setujui atau Tolak.'
                  : ' Pastikan ini bukan orang yang sama yang mendaftar dua kali atau dengan nama lain.'}
              </p>
            )}
          </div>
          {mergeTarget && (
            <button type="button" disabled={busyId === p.id} onClick={() => onMerge(p, mergeTarget)} className="flex items-center justify-center gap-1 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-sm font-medium">
              <Merge className="w-4 h-4" /> Gabungkan ke {mergeTarget.name}
            </button>
          )}
          <div className="flex gap-2 mt-auto">
            {tab === 'pending' && (
              <>
                <button type="button" disabled={busyId === p.id} onClick={() => onApprove(p)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium">
                  <Check className="w-4 h-4" /> Setujui
                </button>
                <button type="button" disabled={busyId === p.id} onClick={() => onReject(p)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium">
                  <X className="w-4 h-4" /> Tolak
                </button>
              </>
            )}
            {tab !== 'pending' && (
              <button type="button" disabled={busyId === p.id} onClick={() => onDelete(p)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Hapus{tab === 'approved' ? ' (resign)' : ''}
              </button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function AuditTable({ entries }: { entries: FaceAuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 py-10 text-center">Belum ada aktivitas.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-left">
          <tr>
            <th className="px-3 py-2 font-medium"><History className="w-4 h-4 inline mr-1" />Waktu</th>
            <th className="px-3 py-2 font-medium">Aktivitas</th>
            <th className="px-3 py-2 font-medium">Akun</th>
            <th className="px-3 py-2 font-medium">Personel</th>
            <th className="px-3 py-2 font-medium">Oleh</th>
            <th className="px-3 py-2 font-medium">IP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-slate-100">
              <td className="px-3 py-2 whitespace-nowrap text-slate-500">{formatTime(e.at)}</td>
              <td
                className={`px-3 py-2 whitespace-nowrap ${e.type.includes('failed') || e.type.startsWith('break_glass') || e.type === 'scan_issue' ? 'text-red-600' : 'text-slate-700'}`}
                title={e.detail || undefined}
              >
                {AUDIT_LABELS[e.type] || e.type}
                {e.issue && <span className="block text-xs">{ISSUE_LABELS[e.issue] || e.issue}</span>}
              </td>
              <td className="px-3 py-2">
                {e.accountEmail || '-'}
                {e.device && <span className="block text-xs text-slate-400">{e.device}</span>}
              </td>
              <td className="px-3 py-2">
                {e.person || '-'}
                {e.distance !== null && (
                  <span className="block text-xs text-slate-400">
                    {e.nearestPerson ? `terdekat: ${e.nearestPerson}, ` : ''}jarak {e.distance.toFixed(2)}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{e.by || '-'}</td>
              <td className="px-3 py-2 text-slate-400">{e.ip || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
