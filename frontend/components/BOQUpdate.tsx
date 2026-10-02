import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, Download, Eye, Loader2, Pencil, Plus, RefreshCw, Save, Scissors, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import baseline from '@/data/boqRoomItems.json';
import { createBOQItem, deleteBOQItem, deleteBOQPhoto, getBOQPhotoURL, photoDigest, readBOQItem, readBOQPage, readBOQPhotos, readCustomBOQItems, readDeletedBOQIds, saveBOQItem, uploadBOQPhoto } from '@/api/boq';
import type { BOQFields, BOQOverride, BOQPhoto, NewBOQItemInput, RoomBOQItem } from '@/types/boq';
import { boqErrorMessage } from '@/utils/boqValidation';
import { enqueueBOQPhoto, readBOQPhotoQueue, getQueuedBOQPhoto, removeBOQPhotoFromQueue, type QueuedBOQPhoto } from '@/utils/boqPhotoQueue';
import { useAuth } from './AuthContext';
import { ImageEditor } from './ImageEditor';

const items: RoomBOQItem[] = baseline;
const PAGE_SIZE = 20;
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50';
const fieldsOf = (item: BOQFields): BOQFields => ({
  ciName: item.ciName, ciDescription: item.ciDescription, capacity: item.capacity,
  serialNumber: item.serialNumber || '', productionYear: item.productionYear || '', manufacturer: item.manufacturer || '',
});

function PhotoThumbnail({
  photo,
  onCrop,
  onDelete,
  onReplace,
  disabled,
}: {
  photo: BOQPhoto;
  onCrop: (file: File) => Promise<void>;
  onDelete: (photo: BOQPhoto) => Promise<void>;
  onReplace: (photo: BOQPhoto, file: File) => Promise<void>;
  disabled?: boolean;
}) {
  const [url, setURL] = useState('');
  const [error, setError] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [operating, setOperating] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);
  const [replacePreviewUrl, setReplacePreviewUrl] = useState('');
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    let objectURL = '';
    getBOQPhotoURL(photo).then(value => { objectURL = value; if (active) setURL(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value); }).catch(error => { if (active) setError(boqErrorMessage(error)); });
    return () => { active = false; if (objectURL.startsWith('blob:')) URL.revokeObjectURL(objectURL); };
  }, [photo.path]);

  const saveCrop = async (dataURL: string) => {
    try {
      const blob = await (await fetch(dataURL)).blob();
      const baseName = photo.name.replace(/\.[^.]+$/, '') || 'foto';
      const cropped = new File([blob], `${baseName}-crop-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      setCropOpen(false);
      await onCrop(cropped);
      toast.success('Hasil crop masuk antrean upload sebagai foto baru.');
    } catch (cropError) {
      toast.error('Hasil crop gagal disiapkan: ' + boqErrorMessage(cropError));
    }
  };

  const handleConfirmDelete = async () => {
    setOperating(true);
    try {
      await onDelete(photo);
      setConfirmDeleteOpen(false);
      setViewOpen(false);
    } catch {
      // Handled in parent onDelete
    } finally {
      setOperating(false);
    }
  };

  const handleReplaceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPendingReplaceFile(file);
    const objectUrl = URL.createObjectURL(file);
    setReplacePreviewUrl(objectUrl);
  };

  const handleCancelReplace = () => {
    if (replacePreviewUrl) URL.revokeObjectURL(replacePreviewUrl);
    setReplacePreviewUrl('');
    setPendingReplaceFile(null);
  };

  const handleConfirmReplace = async () => {
    if (!pendingReplaceFile) return;
    setOperating(true);
    try {
      await onReplace(photo, pendingReplaceFile);
      handleCancelReplace();
      setViewOpen(false);
    } catch {
      // Handled in parent onReplace
    } finally {
      setOperating(false);
    }
  };

  return <>
    <input
      ref={replaceInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={handleReplaceFileSelect}
    />
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-all hover:border-slate-300">
      <div className="group relative overflow-hidden rounded-lg bg-slate-100">
        {url ? <>
          <button type="button" onClick={() => setViewOpen(true)} aria-label={'Lihat foto ' + photo.name} className="block w-full cursor-zoom-in">
            <img src={url} alt={photo.name} loading="lazy" className="h-32 w-full object-cover sm:h-28" />
          </button>
          {operating && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 opacity-100 transition-opacity md:bg-slate-950/0 md:opacity-0 md:group-hover:bg-slate-950/20 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <div className="flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/75 p-1 shadow-lg backdrop-blur-sm">
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Lihat foto" aria-label={'Lihat foto ' + photo.name} onClick={() => setViewOpen(true)} disabled={operating || disabled}><Eye size={13} /></button>
              <a className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Download foto" aria-label={'Download foto ' + photo.name} href={url} download={photo.name}><Download size={13} /></a>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Crop foto" aria-label={'Crop foto ' + photo.name} onClick={() => setCropOpen(true)} disabled={operating || disabled}><Scissors size={13} /></button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-amber-300 transition-colors hover:bg-amber-400/30 focus-visible:outline-none" title="Ganti foto ini" aria-label={'Ganti foto ' + photo.name} onClick={() => replaceInputRef.current?.click()} disabled={operating || disabled}><RefreshCw size={13} /></button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-200 focus-visible:outline-none" title="Hapus foto ini" aria-label={'Hapus foto ' + photo.name} onClick={() => setConfirmDeleteOpen(true)} disabled={operating || disabled}><Trash2 size={13} /></button>
            </div>
          </div>
        </> : <div className="flex h-32 items-center justify-center px-2 text-center text-xs text-slate-500 sm:h-28">{error || 'Memuat foto…'}</div>}
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 break-words text-xs leading-4 text-slate-700" title={photo.name}>{photo.name}</p>
      
      {/* Tombol Aksi Cepat Bawah: Ganti & Hapus */}
      <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-slate-100 pt-1.5">
        <button
          type="button"
          onClick={() => replaceInputRef.current?.click()}
          disabled={operating || disabled}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
          title="Ganti foto ini dengan file baru"
        >
          <RefreshCw size={11} className={operating ? 'animate-spin' : ''} />
          <span>Ganti</span>
        </button>
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={operating || disabled}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="Hapus foto ini"
        >
          <Trash2 size={11} />
          <span>Hapus</span>
        </button>
      </div>
    </div>

    {/* Full Screen View Modal */}
    {viewOpen && url && typeof document !== 'undefined' && createPortal(
      <div role="dialog" aria-modal="true" aria-label={'Lihat foto ' + photo.name} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setViewOpen(false)} onKeyDown={event => { if (event.key === 'Escape') setViewOpen(false); }}>
        <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-150" onClick={event => event.stopPropagation()}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p className="min-w-0 max-w-[240px] truncate text-sm font-semibold sm:max-w-md" title={photo.name}>{photo.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <a href={url} download={photo.name} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"><Download size={15} /><span className="hidden sm:inline">Download</span></a>
              <button type="button" onClick={() => replaceInputRef.current?.click()} disabled={operating || disabled} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"><RefreshCw size={15} className={operating ? 'animate-spin' : ''} /><span>Ganti Foto</span></button>
              <button type="button" onClick={() => setConfirmDeleteOpen(true)} disabled={operating || disabled} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 size={15} /><span>Hapus Foto</span></button>
              <button type="button" onClick={() => setViewOpen(false)} aria-label="Tutup foto" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50"><X size={18} /></button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-950 p-2 sm:p-4"><img src={url} alt={photo.name} className="max-h-[78dvh] max-w-full object-contain" /></div>
        </div>
      </div>,
      document.body
    )}

    {/* In-App Delete Confirmation Modal */}
    {confirmDeleteOpen && typeof document !== 'undefined' && createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Hapus Foto"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => !operating && setConfirmDeleteOpen(false)}
        onKeyDown={event => { if (event.key === 'Escape' && !operating) setConfirmDeleteOpen(false); }}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Hapus Foto Item?</h3>
              <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
            </div>
          </div>

          {url && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={url} alt={photo.name} className="h-36 w-full object-cover" />
            </div>
          )}

          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
            <p className="line-clamp-2 font-semibold text-slate-800 break-words">{photo.name}</p>
            <p className="mt-1 text-slate-500">Ukuran: {(photo.size / (1024 * 1024)).toFixed(2)} MB · Firestore</p>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Foto ini beserta seluruh potongannya akan dihapus secara permanen dari server.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={operating}
              onClick={() => setConfirmDeleteOpen(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={operating}
              onClick={() => void handleConfirmDelete()}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {operating ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              <span>{operating ? 'Menghapus…' : 'Ya, Hapus Foto'}</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* In-App Replace Confirmation Modal */}
    {pendingReplaceFile && typeof document !== 'undefined' && createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Konfirmasi Ganti Foto"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => !operating && handleCancelReplace()}
        onKeyDown={event => { if (event.key === 'Escape' && !operating) handleCancelReplace(); }}
      >
        <div
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <RefreshCw size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Ganti Foto Item?</h3>
              <p className="text-xs text-slate-500">Foto lama akan dihapus dan digantikan file baru</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Foto Saat Ini</p>
              {url && <img src={url} alt={photo.name} className="h-28 w-full rounded-lg object-cover" />}
              <p className="mt-1.5 truncate text-[11px] font-medium text-slate-700" title={photo.name}>{photo.name}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">Foto Pengganti</p>
              {replacePreviewUrl && <img src={replacePreviewUrl} alt={pendingReplaceFile.name} className="h-28 w-full rounded-lg object-cover" />}
              <p className="mt-1.5 truncate text-[11px] font-semibold text-blue-900" title={pendingReplaceFile.name}>{pendingReplaceFile.name}</p>
              <p className="text-[10px] text-slate-500">{(pendingReplaceFile.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            File foto lama akan dihapus dari server Firestore dan digantikan dengan file foto yang baru kamu pilih.
          </p>

          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={operating}
              onClick={handleCancelReplace}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={operating}
              onClick={() => void handleConfirmReplace()}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {operating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>{operating ? 'Mengunggah…' : 'Ganti Foto Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {cropOpen && url && <ImageEditor image={url} description={photo.name} onCancel={() => setCropOpen(false)} onSave={dataURL => { void saveCrop(dataURL); }} />}
  </>;
}

interface UploadJob extends QueuedBOQPhoto { progress: number; error?: string }

function BOQEditor({ item, uid, onClose, onSaved }: {
  item: RoomBOQItem; uid: string; onClose: () => void; onSaved: (id: string, value: BOQOverride) => void;
}) {
  const [fields, setFields] = useState<BOQFields>(fieldsOf(item));
  const [savedFields, setSavedFields] = useState<BOQFields>(fieldsOf(item));
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photos, setPhotos] = useState<BOQPhoto[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot>();
  const [hasMore, setHasMore] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const uploadLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = 'dwimitra-boq-draft-v1:' + uid + ':' + item.id;
  const dirty = JSON.stringify(fields) !== JSON.stringify(savedFields);

  const loadItem = async (restoreDraft = false) => {
    setLoading(true); setReady(false); setError('');
    try {
      const override = await readBOQItem(item.id);
      const current = fieldsOf(override || item);
      setSavedFields(current); setFields(current); setRevision(override?.revision || 0);
      if (restoreDraft) {
        try {
          const stored = JSON.parse(localStorage.getItem(draftKey) || 'null');
          if (stored?.fields && ['ciName', 'ciDescription', 'capacity'].every(key => typeof stored.fields[key] === 'string') && Number.isInteger(stored.revision)) {
            setFields(stored.fields); setRevision(stored.revision);
            if (stored.revision !== (override?.revision || 0)) setError('Draf lokal menggunakan versi lama. Salin perubahan yang diperlukan, lalu muat versi terbaru.');
          }
        } catch { /* A corrupt draft does not replace confirmed server data. */ }
      }
      setReady(true);
    } catch (error) { setError(boqErrorMessage(error)); }
    finally { setLoading(false); }
  };

  const loadPhotos = async (more = false) => {
    setPhotosLoading(true); setPhotoError('');
    try {
      const page = await readBOQPhotos(item.id, more ? cursor : undefined);
      setPhotos(previous => more ? [...previous, ...page.photos].filter((photo, index, all) => all.findIndex(p => p.id === photo.id) === index) : page.photos);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (error) { setPhotoError(boqErrorMessage(error)); }
    finally { setPhotosLoading(false); }
  };

  useEffect(() => {
    void loadItem(true); void loadPhotos();
    readBOQPhotoQueue(uid, item.id).then(pending => setJobs(pending.map(job => ({ ...job, progress: 0 })))).catch(error => setPhotoError('Antrean lokal tidak tersedia: ' + boqErrorMessage(error))).finally(() => setQueueReady(true));
  }, [item.id, uid]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify({ fields, revision }));
      else localStorage.removeItem(draftKey);
    } catch { toast.error('Draf lokal tidak dapat disimpan. Jangan tutup halaman sebelum berhasil menyimpan ke server.'); }
  }, [fields, revision, ready, dirty, draftKey]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty || uploading) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, uploading]);

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true); setError('');
    try {
      const value = await saveBOQItem(item, fields, revision, uid);
      setFields(fieldsOf(value)); setSavedFields(fieldsOf(value)); setRevision(value.revision);
      onSaved(item.id, value); toast.success('Item BOQ tersimpan di server.');
    } catch (error) { setError(boqErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const uploadJobs = async (pending: UploadJob[]) => {
    let index = 0;
    const workers = Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (index < pending.length) {
        const job = pending[index++];
        setJobs(previous => previous.map(p => p.key === job.key ? { ...p, error: undefined, progress: 0 } : p));
        try {
          const queued = await getQueuedBOQPhoto(job.key);
          if (!queued) throw new Error('Antrean foto tidak ditemukan di browser ini. Pilih ulang foto.');
          const photo = await uploadBOQPhoto(item.id, job.id, queued.file, uid, progress => setJobs(previous => previous.map(p => p.key === job.key ? { ...p, progress } : p)));
          await removeBOQPhotoFromQueue(job.key);
          setJobs(previous => previous.filter(p => p.key !== job.key));
          setPhotos(previous => previous.some(p => p.id === photo.id) ? previous : [...previous, photo]);
        } catch (error) {
          setJobs(previous => previous.map(p => p.key === job.key ? { ...p, error: boqErrorMessage(error) } : p));
        }
      }
    });
    await Promise.all(workers);
  };

  const selectFiles = async (selected: File[]) => {
    if (uploadLock.current) return;
    uploadLock.current = true; setUploading(true); setPhotoError('');
    try {
      const pending: UploadJob[] = [];
      for (const file of selected) {
        try {
          const id = await photoDigest(file);
          const key = uid + ':' + item.id + ':' + id;
          if (pending.some(job => job.key === key) || jobs.some(job => job.key === key)) continue;
          await enqueueBOQPhoto({ key, uid, itemId: item.id, id, file });
          const job = { key, uid, itemId: item.id, id, name: file.name, size: file.size, progress: 0 };
          pending.push(job);
          setJobs(previous => [...previous, job]);
        } catch (error) { toast.error(boqErrorMessage(error)); }
      }
      await uploadJobs(pending);
    } finally { uploadLock.current = false; setUploading(false); }
  };

  const retry = async () => {
    if (uploadLock.current) return;
    uploadLock.current = true; setUploading(true);
    try { await uploadJobs(jobs); }
    finally { uploadLock.current = false; setUploading(false); }
  };

  const handleDeletePhoto = async (photo: BOQPhoto) => {
    try {
      await deleteBOQPhoto(item.id, photo);
      await removeBOQPhotoFromQueue(uid + ':' + item.id + ':' + photo.id).catch(() => {});
      setJobs(previous => previous.filter(job => job.id !== photo.id));
      setPhotos(previous => previous.filter(p => p.id !== photo.id));
      toast.success(`Foto "${photo.name}" berhasil dihapus.`);
    } catch (error) {
      toast.error('Gagal menghapus foto: ' + boqErrorMessage(error));
      throw error;
    }
  };

  const handleReplacePhoto = async (oldPhoto: BOQPhoto, newFile: File) => {
    const toastId = toast.loading(`Mengunggah foto pengganti...`);
    try {
      const digest = await photoDigest(newFile);
      if (digest === oldPhoto.id) {
        toast.info('Foto baru identik dengan foto yang sudah ada.', { id: toastId });
        return;
      }
      const newPhoto = await uploadBOQPhoto(item.id, digest, newFile, uid, () => {});
      await deleteBOQPhoto(item.id, oldPhoto);
      await removeBOQPhotoFromQueue(uid + ':' + item.id + ':' + oldPhoto.id).catch(() => {});
      setJobs(previous => previous.filter(job => job.id !== oldPhoto.id));
      setPhotos(previous => previous.map(p => p.id === oldPhoto.id ? newPhoto : p));
      toast.success(`Foto berhasil diganti dengan "${newFile.name}".`, { id: toastId });
    } catch (error) {
      toast.error('Gagal mengganti foto: ' + boqErrorMessage(error), { id: toastId });
      throw error;
    }
  };

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);

  const close = () => {
    if (saving || uploading) return;
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  };

  return <div className="flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:min-h-[80dvh]">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3"><button className={buttonClass} aria-label="Kembali ke daftar" disabled={saving || uploading} onClick={close}><ArrowLeft size={20} /></button><div className="min-w-0"><h2 className="text-lg font-bold">Update item BOQ</h2><p className="break-words text-sm text-slate-500">{item.room || 'Tanpa ruangan'} · {item.classId}</p></div></div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="mb-4 text-xs text-slate-500">Sumber: {item.sourceSheet}, baris {item.sourceRows ? item.sourceRows.join(', ') : item.sourceRow} · Lantai {item.floor || '—'} · Model {item.model || '—'}</p>
        {loading && <p className="mb-3 flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Memuat versi server…</p>}
        {error && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}<button className="mt-2 block font-semibold underline" disabled={saving || loading} onClick={() => { if (!dirty) void loadItem(); else setConfirmReloadOpen(true); }}>Muat versi terbaru</button></div>}
        <div className="space-y-4">
          <label className="block text-sm font-medium">CI Name<input className={inputClass + ' mt-1'} value={fields.ciName} maxLength={500} disabled={!ready || saving} onChange={event => setFields(previous => ({ ...previous, ciName: event.target.value }))} /></label>
          <label className="block text-sm font-medium">CI Description<textarea className={inputClass + ' mt-1 min-h-28'} value={fields.ciDescription} maxLength={2000} disabled={!ready || saving} onChange={event => setFields(previous => ({ ...previous, ciDescription: event.target.value }))} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Capacity<input className={inputClass + ' mt-1'} value={fields.capacity} maxLength={500} disabled={!ready || saving} onChange={event => setFields(previous => ({ ...previous, capacity: event.target.value }))} /></label>
            <label className="block text-sm font-medium">Serial Number<input className={inputClass + ' mt-1 font-mono text-xs sm:text-sm'} value={fields.serialNumber || ''} maxLength={500} disabled={!ready || saving} placeholder="S/N dari unit" onChange={event => setFields(previous => ({ ...previous, serialNumber: event.target.value }))} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Production Year<input className={inputClass + ' mt-1'} value={fields.productionYear || ''} maxLength={20} disabled={!ready || saving} placeholder="Contoh: 2019" onChange={event => setFields(previous => ({ ...previous, productionYear: event.target.value }))} /></label>
            <label className="block text-sm font-medium">Manufacturer / Principle<input className={inputClass + ' mt-1'} value={fields.manufacturer || ''} maxLength={500} disabled={!ready || saving} placeholder="Merk / Principle" onChange={event => setFields(previous => ({ ...previous, manufacturer: event.target.value }))} /></label>
          </div>
        </div>
        <div className="mt-7 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Foto item</h3><button className={buttonClass} disabled={!ready || !queueReady || uploading} onClick={() => fileInput.current?.click()}><Upload size={17} /> Upload foto</button></div>
          <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP · maksimal 10 MB per foto. Foto tersimpan terpisah dari perubahan teks.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void selectFiles(files); }} />
          {jobs.length > 0 && <div className="mt-3 space-y-2 rounded-xl bg-blue-50 p-3">
            <p className="text-sm font-medium">{jobs.length} foto menunggu selesai</p>
            {jobs.map(job => <div key={job.key} className="text-xs"><p className="break-words">{job.name} · {job.progress}%</p><progress className="h-2 w-full" value={job.progress} max={100} />{job.error && <p className="text-red-700">{job.error}</p>}</div>)}
            <p className="text-xs text-slate-600">Antrean tersimpan di browser ini. Buka item ini untuk melanjutkan jika halaman ditutup.</p>
            <button className={buttonClass} disabled={uploading} onClick={() => void retry()}><RefreshCw size={16} /> Coba lagi</button>
          </div>}
          {photoError && <div role="alert" className="mt-3 text-sm text-red-700">{photoError}<button className="ml-2 underline" disabled={photosLoading} onClick={() => void loadPhotos()}>Muat ulang foto</button></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map(photo => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                onCrop={file => selectFiles([file])}
                onDelete={handleDeletePhoto}
                onReplace={handleReplacePhoto}
                disabled={uploading}
              />
            ))}
          </div>
          {photosLoading && <p className="mt-3 text-sm text-slate-500">Memuat foto…</p>}
          {!photosLoading && !photoError && !photos.length && <p className="mt-3 text-sm text-slate-500">Belum ada foto.</p>}
          {hasMore && <button className={buttonClass + ' mt-3 w-full'} disabled={photosLoading} onClick={() => void loadPhotos(true)}>Muat 20 foto berikutnya</button>}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <p className="text-xs text-slate-500">{saving ? 'Menyimpan…' : dirty ? 'Perubahan belum tersimpan' : 'Tidak ada perubahan teks'}</p>
        <button className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!ready || saving || !dirty} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Simpan item</button>
      </footer>

      {/* In-App Close Confirmation Modal */}
      {confirmCloseOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Tutup Editor"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmCloseOpen(false)}
          onKeyDown={event => { if (event.key === 'Escape') setConfirmCloseOpen(false); }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ArrowLeft size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Tutup Editor Item?</h3>
                <p className="text-xs text-slate-500">Ada perubahan teks yang belum tersimpan ke server</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Perubahan Anda telah dicatat di draf lokal perangkat ini, tetapi belum terkirim ke Firestore server. Yakin ingin kembali ke daftar?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Lanjut Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmCloseOpen(false);
                  onClose();
                }}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                Tutup & Simpan Draf
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* In-App Reload Confirmation Modal */}
      {confirmReloadOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Muat Versi Server"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setConfirmReloadOpen(false)}
          onKeyDown={event => { if (event.key === 'Escape') setConfirmReloadOpen(false); }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150 sm:p-6"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <RefreshCw size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Muat Versi Server?</h3>
                <p className="text-xs text-slate-500">Draf lokal akan ditimpa dengan data terkini</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              Perubahan teks lokal yang belum tersimpan akan digantikan dengan data yang saat ini ada di database Firestore.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReloadOpen(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReloadOpen(false);
                  void loadItem();
                }}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Muat Versi Server
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>;
}

const emptyNewItem: NewBOQItemInput = { room: '', classId: '', floor: '', ciName: '', ciDescription: '', capacity: '', serialNumber: '', productionYear: '', manufacturer: '' };

function AddItemModal({ rooms, classIds, floorByRoom, initialRoom, saving, error, onCancel, onSubmit }: {
  rooms: string[]; classIds: string[]; floorByRoom: Map<string, string>; initialRoom: string; saving: boolean; error: string;
  onCancel: () => void; onSubmit: (input: NewBOQItemInput) => void;
}) {
  const [form, setForm] = useState<NewBOQItemInput>({ ...emptyNewItem, room: initialRoom, floor: floorByRoom.get(initialRoom) || '' });
  const set = (patch: Partial<NewBOQItemInput>) => setForm(previous => ({ ...previous, ...patch }));
  const canSubmit = !saving && form.room.trim() !== '' && form.classId.trim() !== '' && form.ciName.trim() !== '';
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tambah Class ID" className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onKeyDown={event => { if (event.key === 'Escape' && !saving) onCancel(); }}>
      <form className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onSubmit={event => { event.preventDefault(); if (canSubmit) onSubmit(form); }}>
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0"><h3 className="text-base font-bold">Tambah Class ID</h3><p className="text-xs text-slate-500">Item baru masuk ke ruangan yang dipilih. Foto bisa ditambahkan setelah disimpan.</p></div>
          <button type="button" aria-label="Tutup" disabled={saving} onClick={onCancel} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"><X size={18} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">Ruangan *<input className={inputClass + ' mt-1'} list="boq-add-rooms" value={form.room} maxLength={200} autoFocus disabled={saving} placeholder="Pilih / ketik ruangan"
              onChange={event => { const room = event.target.value; set({ room, floor: floorByRoom.get(room) ?? form.floor }); }} /></label>
            <label className="block text-sm font-medium sm:col-span-1">Class Id *<input className={inputClass + ' mt-1'} list="boq-add-classes" value={form.classId} maxLength={200} disabled={saving} placeholder="Contoh: MV (MV Panel)" onChange={event => set({ classId: event.target.value })} /></label>
            <label className="block text-sm font-medium">Lantai<input className={inputClass + ' mt-1'} value={form.floor} maxLength={50} disabled={saving} placeholder="Contoh: 1F" onChange={event => set({ floor: event.target.value })} /></label>
          </div>
          <datalist id="boq-add-rooms">{rooms.filter(Boolean).map(value => <option key={value} value={value} />)}</datalist>
          <datalist id="boq-add-classes">{classIds.filter(Boolean).map(value => <option key={value} value={value} />)}</datalist>
          <label className="block text-sm font-medium">CI Name *<input className={inputClass + ' mt-1'} value={form.ciName} maxLength={500} disabled={saving} onChange={event => set({ ciName: event.target.value })} /></label>
          <label className="block text-sm font-medium">CI Description<textarea className={inputClass + ' mt-1 min-h-24'} value={form.ciDescription} maxLength={2000} disabled={saving} onChange={event => set({ ciDescription: event.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Capacity<input className={inputClass + ' mt-1'} value={form.capacity} maxLength={500} disabled={saving} onChange={event => set({ capacity: event.target.value })} /></label>
            <label className="block text-sm font-medium">Serial Number<input className={inputClass + ' mt-1 font-mono text-xs sm:text-sm'} value={form.serialNumber} maxLength={500} disabled={saving} onChange={event => set({ serialNumber: event.target.value })} /></label>
            <label className="block text-sm font-medium">Production Year<input className={inputClass + ' mt-1'} value={form.productionYear} maxLength={20} disabled={saving} placeholder="Contoh: 2019" onChange={event => set({ productionYear: event.target.value })} /></label>
            <label className="block text-sm font-medium">Manufacturer / Principle<input className={inputClass + ' mt-1'} value={form.manufacturer} maxLength={500} disabled={saving} onChange={event => set({ manufacturer: event.target.value })} /></label>
          </div>
          {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2.5 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" className={buttonClass} disabled={saving} onClick={onCancel}>Batal</button>
          <button type="submit" disabled={!canSubmit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />} Simpan & lanjut ke foto</button>
        </footer>
      </form>
    </div>,
    document.body
  );
}

function DeleteItemModal({ item, deleting, onCancel, onConfirm }: { item: RoomBOQItem; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Konfirmasi Hapus Class ID" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={() => !deleting && onCancel()} onKeyDown={event => { if (event.key === 'Escape' && !deleting) onCancel(); }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={22} /></div>
          <div className="min-w-0"><h3 className="text-base font-bold text-slate-900">Hapus Class ID dari ruangan?</h3><p className="text-xs text-slate-500">Item tidak akan tampil lagi di daftar dan export Excel</p></div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="break-words font-semibold text-slate-800">{item.ciName}</p>
          <p className="mt-1 break-words text-xs text-slate-500">{item.classId || 'Tanpa Class Id'} · {item.room || 'Tanpa ruangan'}</p>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button type="button" disabled={deleting} autoFocus onClick={onCancel} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
          <button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}<span>{deleting ? 'Menghapus…' : 'Ya, Hapus'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function BOQUpdate() {
  const { user } = useAuth();
  const [room, setRoom] = useState('all');
  const [classId, setClassId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, BOQOverride>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<RoomBOQItem | null>(null);
  const [customItems, setCustomItems] = useState<RoomBOQItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [toDelete, setToDelete] = useState<RoomBOQItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const exporting = exportStatus !== '';
  // Baseline workbook rows plus drafter-added items, minus anything soft-deleted.
  const allItems = useMemo(() => [...items, ...customItems].filter(item => !deletedIds.has(item.id)), [customItems, deletedIds]);
  useEffect(() => {
    let active = true;
    Promise.all([readCustomBOQItems(), readDeletedBOQIds()]).then(([custom, deleted]) => {
      if (active) { setCustomItems(custom); setDeletedIds(deleted); }
    }).catch(loadError => { if (active) setError(boqErrorMessage(loadError)); });
    return () => { active = false; };
  }, [refresh]);
  const addItem = async (input: NewBOQItemInput) => {
    if (!user || adding) return;
    setAdding(true); setAddError('');
    try {
      const created = await createBOQItem(input, user.uid);
      setCustomItems(previous => [...previous, created]);
      setAddOpen(false);
      setRoom(created.room); setClassId('all'); setSearch(''); setPage(1);
      toast.success(`"${created.ciName}" ditambahkan ke ${created.room}.`);
      setSelected(created);
    } catch (addFailure) { setAddError(boqErrorMessage(addFailure)); }
    finally { setAdding(false); }
  };
  const confirmDelete = async () => {
    if (!user || !toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteBOQItem(toDelete, user.uid);
      setDeletedIds(previous => new Set(previous).add(toDelete.id));
      toast.success(`"${toDelete.ciName}" dihapus dari ${toDelete.room || 'daftar'}.`);
      setToDelete(null);
    } catch (deleteError) { toast.error('Gagal menghapus: ' + boqErrorMessage(deleteError)); }
    finally { setDeleting(false); }
  };
  const exportExcel = async () => {
    if (exporting) return;
    setExportStatus('Menyiapkan export…');
    try {
      const { exportDrafterBOQExcel } = await import('@/utils/boqDrafterExcelExport');
      const result = await exportDrafterBOQExcel(items, setExportStatus);
      toast.success(`${result.fileName}: ${result.itemCount} item, ${result.roomCount} ruangan, ${result.photoCount - result.failedPhotos} foto.`);
      if (result.failedPhotos) toast.warning(`${result.failedPhotos} foto gagal dimuat dan ditandai di Excel.`);
      result.warnings.forEach(warning => toast.warning(warning));
    } catch (exportError) {
      toast.error('Export BOQ gagal: ' + boqErrorMessage(exportError));
    } finally { setExportStatus(''); }
  };
  const rooms = useMemo(() => [...new Set(allItems.map(item => item.room))].sort(), [allItems]);
  const allClassIds = useMemo(() => [...new Set(allItems.map(item => item.classId))].sort(), [allItems]);
  const floorByRoom = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allItems) if (item.floor && !map.has(item.room)) map.set(item.room, item.floor);
    return map;
  }, [allItems]);
  const classes = useMemo(() => [...new Set(allItems.filter(item => room === 'all' || item.room === room).map(item => item.classId))].sort(), [room, allItems]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allItems.filter(item => (room === 'all' || item.room === room) && (classId === 'all' || item.classId === classId) &&
      (!term || [item.room, item.classId, item.ciName, item.ciDescription, item.capacity, item.serialNumber, item.productionYear, item.manufacturer, overrides[item.id]?.ciName, overrides[item.id]?.ciDescription, overrides[item.id]?.capacity, overrides[item.id]?.serialNumber, overrides[item.id]?.productionYear, overrides[item.id]?.manufacturer].some(value => value?.toLowerCase().includes(term))));
  }, [room, classId, search, overrides, allItems]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const idsKey = visible.map(item => item.id).join('|');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    readBOQPage(idsKey ? idsKey.split('|') : []).then(values => {
      if (active) setOverrides(previous => {
        const next = { ...previous };
        for (const id of idsKey.split('|')) delete next[id];
        return { ...next, ...values };
      });
    }).catch(error => { if (active) setError(boqErrorMessage(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idsKey, refresh]);
  if (selected && user) {
    return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <BOQEditor key={selected.id} item={selected} uid={user.uid} onClose={() => setSelected(null)} onSaved={(id, value) => setOverrides(previous => ({ ...previous, [id]: value }))} />
    </section>;
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold sm:text-2xl">Update BOQ</h1><p className="mt-1 text-sm text-slate-500">{allItems.length.toLocaleString('id-ID')} item dari BOQ PER RUANGAN · ROOM & NO ROOM{customItems.length > 0 && ` · ${customItems.length} ditambahkan`}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={buttonClass + ' !border-blue-600 !bg-blue-600 text-white'} disabled={exporting} onClick={() => { setAddError(''); setAddOpen(true); }}><Plus size={16} /> Tambah Class ID</button>
        <button className={buttonClass} disabled={loading || exporting} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /> Muat ulang</button>
        <button className={buttonClass} disabled={exporting} onClick={() => void exportExcel()}>{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exporting ? exportStatus : 'Export BOQ (Excel)'}</button>
      </div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      <label className="text-sm font-medium">Ruangan<select className={inputClass + ' mt-1'} value={room} onChange={event => { setRoom(event.target.value); setClassId('all'); setPage(1); }}><option value="all">Semua ruangan</option>{rooms.map(value => <option key={value} value={value}>{value || 'Tanpa ruangan'}</option>)}</select></label>
      <label className="text-sm font-medium">Class Id<select className={inputClass + ' mt-1'} value={classId} onChange={event => { setClassId(event.target.value); setPage(1); }}><option value="all">Semua Class Id</option>{classes.map(value => <option key={value} value={value}>{value || 'Tanpa Class Id'}</option>)}</select></label>
      <label className="text-sm font-medium">Cari item<div className="relative mt-1"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className={inputClass + ' pl-9'} placeholder="Nama, deskripsi, kapasitas…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div></label>
    </div>
    <p className="mt-3 text-xs text-slate-500">Pencarian mencakup data sumber dan perubahan yang sudah dimuat. Gunakan filter ruangan untuk mempersempit hasil.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error} Data sumber tetap ditampilkan; versi server belum terverifikasi.</p>}
    {loading && <p role="status" className="mt-4 text-sm text-slate-500">Memuat perubahan halaman ini…</p>}
    <div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Class Id / Ruangan', 'CI Name', 'CI Description', 'Capacity', 'Serial Number', 'Production Year', 'Manufacturer / Principle', 'Foto / Edit'].map(title => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead>
      <tbody>{visible.map(item => { const value = { ...item, ...overrides[item.id] }; return <tr key={item.id} className="border-b border-slate-100 align-top"><td className="px-3 py-4"><p className="font-medium">{item.classId || '—'}</p><p className="mt-1 text-xs text-slate-500">{item.room || 'Tanpa ruangan'}</p></td><td className="max-w-64 break-words px-3 py-4 font-medium">{value.ciName}</td><td className="max-w-80 whitespace-pre-wrap break-words px-3 py-4">{value.ciDescription || '—'}</td><td className="px-3 py-4">{value.capacity || '—'}</td><td className="max-w-48 break-all px-3 py-4 font-mono text-xs">{value.serialNumber || '—'}</td><td className="px-3 py-4">{value.productionYear || '—'}</td><td className="max-w-48 break-words px-3 py-4">{value.manufacturer || '—'}</td><td className="px-3 py-4"><div className="flex gap-2"><button className={buttonClass} aria-label={'Edit dan foto ' + value.ciName} onClick={() => setSelected(item)}><Camera size={16} /><Pencil size={15} /></button><button className={buttonClass + ' text-red-600 hover:bg-red-50'} title="Hapus Class ID dari ruangan ini" aria-label={'Hapus ' + value.ciName} onClick={() => setToDelete(item)}><Trash2 size={16} /></button></div></td></tr>; })}</tbody></table></div>
    <div className="mt-4 space-y-3 md:hidden">{visible.map(item => { const value = { ...item, ...overrides[item.id] }; return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-blue-700">{item.classId || 'Tanpa Class Id'}</p><h2 className="mt-1 break-words font-semibold">{value.ciName}</h2><p className="mt-1 text-xs text-slate-500">{item.room || 'Tanpa ruangan'} · {item.floor || '—'}</p><dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-slate-500">CI Description</dt><dd className="whitespace-pre-wrap break-words">{value.ciDescription || '—'}</dd></div><div><dt className="text-xs text-slate-500">Capacity</dt><dd>{value.capacity || '—'}</dd></div><div><dt className="text-xs text-slate-500">Serial Number</dt><dd className="break-all font-mono text-xs">{value.serialNumber || '—'}</dd></div><div><dt className="text-xs text-slate-500">Production Year</dt><dd>{value.productionYear || '—'}</dd></div><div><dt className="text-xs text-slate-500">Manufacturer / Principle</dt><dd className="break-words">{value.manufacturer || '—'}</dd></div></dl><div className="mt-4 flex gap-2"><button className={buttonClass + ' flex-1'} onClick={() => setSelected(item)}><Camera size={17} /> Foto & edit item</button><button className={buttonClass + ' text-red-600 hover:bg-red-50'} aria-label={'Hapus ' + value.ciName} onClick={() => setToDelete(item)}><Trash2 size={17} /></button></div></article>; })}</div>
    {!visible.length && <p className="py-8 text-center text-sm text-slate-500">Tidak ada item sesuai filter.</p>}
    <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4"><p className="text-xs text-slate-500">{filtered.length} item · {currentPage}/{totalPages}</p><div className="flex gap-2"><button className={buttonClass} aria-label="Halaman sebelumnya" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} /></button><button className={buttonClass} aria-label="Halaman berikutnya" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} /></button></div></div>
    {addOpen && <AddItemModal rooms={rooms} classIds={allClassIds} floorByRoom={floorByRoom} initialRoom={room === 'all' ? '' : room} saving={adding} error={addError} onCancel={() => setAddOpen(false)} onSubmit={input => void addItem(input)} />}
    {toDelete && <DeleteItemModal item={toDelete} deleting={deleting} onCancel={() => setToDelete(null)} onConfirm={() => void confirmDelete()} />}
  </section>;
}
