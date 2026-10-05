import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ArrowLeft, Camera, Check, Download, Eye, Loader2, Plus, RefreshCw, Save, Scissors, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { getBOQPhotoURL, getBOQThumbURL, readBOQItem, readBOQPage, readBOQPhotos, readCustomBOQItems, readDeletedBOQIds } from '@/api/boq';
import type { BOQEditableField, BOQFields, BOQItem, BOQOverride, BOQPhoto, NewBOQItemInput } from '@/types/boq';
import { BOQ_EDITABLE_FIELDS, BOQ_FIELD_LABELS, BOQ_SOURCE, CUSTOM_CATEGORY, NO_ROOM, boqItems, boqTables, editableFieldsOf, fieldsOf, roomKeyOf, roomLabel, tableOrder } from '@/utils/boqCatalog';
import { boqErrorMessage } from '@/utils/boqValidation';
import { cancelBOQPhotoUpload, onBOQOutboxEvent, queueBOQCreate, queueBOQPhotoDelete, queueBOQPhotos, queueBOQText, resolveBOQConflict, useBOQOutbox, type BOQTextOp } from '@/utils/boqOutbox';
import { useAuth } from './AuthContext';
import { ImageEditor } from './ImageEditor';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50';
const fieldInputClass = (field: BOQEditableField) => inputClass + ' mt-1' + (field === 'serialNumber' || field === 'assetId' || field === 'tag' ? ' font-mono text-xs sm:text-sm' : '');
const fieldMaxLength = (field: BOQEditableField) => field === 'ciDescription' ? 2000 : field === 'productionYear' ? 20 : 500;

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

  const [thumbURL, setThumbURL] = useState('');
  const fullURL = useRef('');
  const fullLoad = useRef<Promise<string> | null>(null);
  // The full image (up to 10 MB) is only downloaded when it is opened, downloaded or cropped;
  // the grid shows the small thumbnail stored in the photo document.
  const ensureFull = () => {
    fullLoad.current ||= getBOQPhotoURL(photo).then(value => { fullURL.current = value; setURL(value); return value; })
      .catch(loadError => { fullLoad.current = null; setError(boqErrorMessage(loadError)); throw loadError; });
    return fullLoad.current;
  };
  useEffect(() => {
    const thumb = getBOQThumbURL(photo);
    setThumbURL(thumb);
    if (!thumb) void ensureFull().catch(() => undefined); // photos uploaded before thumbnails existed
    return () => { if (thumb) URL.revokeObjectURL(thumb); if (fullURL.current) URL.revokeObjectURL(fullURL.current); };
  }, [photo.path]);
  const preview = thumbURL || url;
  const openView = () => { setViewOpen(true); void ensureFull().catch(() => undefined); };
  const openCrop = () => { void ensureFull().then(() => setCropOpen(true), () => toast.error('Foto asli belum bisa diunduh; coba lagi saat sinyal lebih baik.')); };
  const download = () => {
    void ensureFull().then(value => { const link = document.createElement('a'); link.href = value; link.download = photo.name; link.click(); }, () => toast.error('Foto asli belum bisa diunduh; coba lagi saat sinyal lebih baik.'));
  };

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
        {preview ? <>
          <button type="button" onClick={openView} aria-label={'Lihat foto ' + photo.name} className="block w-full cursor-zoom-in">
            <img src={preview} alt={photo.name} loading="lazy" className="h-32 w-full object-cover sm:h-28" />
          </button>
          {operating && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 text-white backdrop-blur-[2px]">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 opacity-100 transition-opacity md:bg-slate-950/0 md:opacity-0 md:group-hover:bg-slate-950/20 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <div className="flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/75 p-1 shadow-lg backdrop-blur-sm">
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Lihat foto" aria-label={'Lihat foto ' + photo.name} onClick={openView} disabled={operating || disabled}><Eye size={13} /></button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Download foto" aria-label={'Download foto ' + photo.name} onClick={download}><Download size={13} /></button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none" title="Crop foto" aria-label={'Crop foto ' + photo.name} onClick={openCrop} disabled={operating || disabled}><Scissors size={13} /></button>
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
    {viewOpen && preview && typeof document !== 'undefined' && createPortal(
      <div role="dialog" aria-modal="true" aria-label={'Lihat foto ' + photo.name} className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150" onClick={() => setViewOpen(false)} onKeyDown={event => { if (event.key === 'Escape') setViewOpen(false); }}>
        <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-150" onClick={event => event.stopPropagation()}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <p className="min-w-0 max-w-[240px] truncate text-sm font-semibold sm:max-w-md" title={photo.name}>{photo.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={download} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"><Download size={15} /><span className="hidden sm:inline">Download</span></button>
              <button type="button" onClick={() => replaceInputRef.current?.click()} disabled={operating || disabled} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"><RefreshCw size={15} className={operating ? 'animate-spin' : ''} /><span>Ganti Foto</span></button>
              <button type="button" onClick={() => setConfirmDeleteOpen(true)} disabled={operating || disabled} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"><Trash2 size={15} /><span>Hapus Foto</span></button>
              <button type="button" onClick={() => setViewOpen(false)} aria-label="Tutup foto" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50"><X size={18} /></button>
            </div>
          </header>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-950 p-2 sm:p-4"><img src={url || preview} alt={photo.name} className="max-h-[78dvh] max-w-full object-contain" />{!url && <p className="absolute bottom-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white">{error ? 'Foto asli belum bisa diunduh; menampilkan pratinjau.' : 'Memuat foto resolusi asli…'}</p>}</div>
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

          {preview && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <img src={preview} alt={photo.name} className="h-36 w-full object-cover" />
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
              {preview && <img src={preview} alt={photo.name} className="h-28 w-full rounded-lg object-cover" />}
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

const sameFields = (a: BOQFields, b: BOQFields) => BOQ_EDITABLE_FIELDS.every(field => (a[field] || '').trim() === (b[field] || '').trim());
const formatTime = (millis?: number) => millis ? new Date(millis).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// Shown when the same field was changed differently by this drafter and someone else.
function ConflictPanel({ op, onResolve }: { op: BOQTextOp; onResolve: (choice: Partial<Record<BOQEditableField, 'mine' | 'server'>>) => Promise<void> }) {
  const conflict = op.conflict!;
  const [choice, setChoice] = useState<Partial<Record<BOQEditableField, 'mine' | 'server'>>>(() => Object.fromEntries(conflict.fields.map(field => [field, 'mine'])));
  const [busy, setBusy] = useState(false);
  return <div role="alert" className="mb-5 rounded-xl border-2 border-red-300 bg-red-50 p-4">
    <p className="font-semibold text-red-800">⚠️ Bentrok data dengan drafter lain</p>
    <p className="mt-1 text-xs text-red-900">
      {conflict.updatedByName || 'Drafter lain'} sudah mengubah kolom yang sama{conflict.updatedAt ? ` (${formatTime(conflict.updatedAt)})` : ''}. Pilih nilai yang benar untuk tiap kolom, lalu kirim.
    </p>
    <div className="mt-3 space-y-3">
      {conflict.fields.map(field => <fieldset key={field} className="rounded-lg bg-white p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">{BOQ_FIELD_LABELS[field]}</legend>
        {(['mine', 'server'] as const).map(side => <label key={side} className="mt-1 flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" className="mt-1" name={'conflict-' + field} checked={choice[field] === side} onChange={() => setChoice(previous => ({ ...previous, [field]: side }))} />
          <span className="min-w-0"><span className="block text-xs text-slate-500">{side === 'mine' ? 'Punya saya' : 'Di server'}</span><span className="whitespace-pre-wrap break-words">{(side === 'mine' ? op.fields[field] : conflict.server[field]) || '(kosong)'}</span></span>
        </label>)}
      </fieldset>)}
    </div>
    <button type="button" disabled={busy} onClick={() => { setBusy(true); void onResolve(choice).finally(() => setBusy(false)); }} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Pakai pilihan ini & kirim
    </button>
  </div>;
}

function BOQEditor({ item, uid, override, onClose }: { item: BOQItem; uid: string; override?: BOQOverride; onClose: () => void }) {
  const editable = editableFieldsOf(item);
  const outbox = useBOQOutbox();
  const pending = outbox.texts[item.id];
  const initial = fieldsOf(override ? { ...item, ...override } : item);
  // `base` is the server version this drafter is editing; the outbox uses it to merge per field.
  const [base, setBase] = useState<BOQFields>(pending?.base ?? initial);
  const [savedFields, setSavedFields] = useState<BOQFields>(pending?.fields ?? initial);
  const [fields, setFields] = useState<BOQFields>(pending?.fields ?? initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photos, setPhotos] = useState<BOQPhoto[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot>();
  const [hasMore, setHasMore] = useState(false);
  const [photosLoading, setPhotosLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = 'dwimitra-boq-draft-v3:' + uid + ':' + item.id;
  const dirty = !sameFields(fields, savedFields);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const jobs = outbox.photoJobs.filter(job => job.itemId === item.id);
  const visiblePhotos = photos.filter(photo => !outbox.deletingPhotoIds.has(photo.id));
  const waitingToSend = !!pending || jobs.length > 0 || photos.some(photo => outbox.deletingPhotoIds.has(photo.id));

  // Server (or last cached) version. Editing never waits for it: with no signal the drafter keeps
  // working on the version stored on the phone.
  const loadItem = async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const value = await readBOQItem(item.id);
      const server = fieldsOf(value ? { ...item, ...value } : item);
      if (!outbox.texts[item.id]) {
        setBase(server);
        if (!dirtyRef.current) { setFields(server); setSavedFields(server); }
      }
    } catch {
      setNotice('Sinyal lemah atau offline: menampilkan data terakhir yang ada di HP. Perubahan tetap bisa disimpan dan dikirim otomatis.');
    } finally { setLoading(false); }
  };
  const loadPhotos = async (more = false) => {
    setPhotosLoading(true); setPhotoError('');
    try {
      const page = await readBOQPhotos(item.id, more ? cursor : undefined);
      setPhotos(previous => more ? [...previous, ...page.photos].filter((photo, index, all) => all.findIndex(p => p.id === photo.id) === index) : page.photos);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch { setPhotoError('Foto di server belum bisa dimuat (sinyal lemah). Foto baru tetap bisa diambil dan dikirim otomatis.'); }
    finally { setPhotosLoading(false); }
  };

  useEffect(() => {
    // Unsaved text from a previous visit (e.g. the app was closed) is restored first.
    try {
      const stored = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (stored?.fields && BOQ_EDITABLE_FIELDS.every(key => typeof stored.fields[key] === 'string')) {
        setFields(fieldsOf(stored.fields));
        toast.info('Draf yang belum disimpan dipulihkan.');
      }
    } catch { /* A corrupt draft is ignored. */ }
    void loadItem(); void loadPhotos();
  }, [item.id, uid]);

  // Keep the form in step with the outbox: sent edits and resolved conflicts.
  useEffect(() => onBOQOutboxEvent(event => {
    if (event.itemId !== item.id) return;
    if (event.type === 'photo') setPhotos(previous => [...previous.filter(photo => photo.id !== event.photo.id && photo.id !== event.replacedId), event.photo]);
    else if (event.type === 'photo-deleted') setPhotos(previous => previous.filter(photo => photo.id !== event.photoId));
  }), [item.id]);
  useEffect(() => {
    if (pending) { setBase(pending.base); if (!dirtyRef.current) { setFields(pending.fields); setSavedFields(pending.fields); } }
  }, [pending?.fields, pending?.base]);

  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify({ fields }));
      else localStorage.removeItem(draftKey);
    } catch { /* Storage unavailable: the save button still queues the edit. */ }
  }, [fields, dirty, draftKey]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      await queueBOQText(item, base, fields);
      setSavedFields(fields);
      toast.success(navigator.onLine ? 'Tersimpan. Dikirim ke server di latar belakang.' : 'Tersimpan di HP. Dikirim otomatis begitu ada sinyal.');
    } catch (saveError) { setError(boqErrorMessage(saveError)); }
    finally { setSaving(false); }
  };
  const selectFiles = async (selected: File[]) => {
    if (!selected.length) return;
    setPreparing(true);
    try {
      const { queued, errors } = await queueBOQPhotos(item.id, selected);
      errors.forEach(message => toast.error(message));
      if (queued) toast.success(`${queued} foto masuk antrean dan dikirim otomatis.`);
    } finally { setPreparing(false); }
  };
  const handleDeletePhoto = async (photo: BOQPhoto) => {
    await queueBOQPhotoDelete(item.id, photo);
    toast.success(navigator.onLine ? `Foto "${photo.name}" dihapus.` : `Foto "${photo.name}" dihapus; server diperbarui saat ada sinyal.`);
  };
  const handleReplacePhoto = async (oldPhoto: BOQPhoto, newFile: File) => {
    setPreparing(true);
    try {
      const { queued, errors } = await queueBOQPhotos(item.id, [newFile], oldPhoto);
      errors.forEach(message => toast.error(message));
      if (queued) toast.success('Foto pengganti masuk antrean; foto lama diganti setelah terkirim.');
      else if (!errors.length) toast.info('Foto baru identik dengan foto yang sudah ada.');
    } finally { setPreparing(false); }
  };

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);
  const close = () => {
    if (saving) return;
    if (dirty) { setConfirmCloseOpen(true); return; }
    onClose();
  };
  const busy = saving || preparing;

  return <div className="flex h-[100dvh] w-full flex-col bg-white sm:h-auto sm:min-h-[80dvh]">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3"><button className={buttonClass} aria-label="Kembali ke daftar" disabled={saving} onClick={close}><ArrowLeft size={20} /></button><div className="min-w-0"><h2 className="break-words text-lg font-bold">{item.ciName}</h2><p className="break-words text-sm text-slate-500">{item.sheet}{item.section ? ' — ' + item.section : ''} · {item.room ? roomLabel(item.room) : NO_ROOM}</p></div></div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="mb-4 text-xs text-slate-500">{item.custom ? 'Item tambahan dari aplikasi' : `Sumber: sheet "${item.sheet}", baris ${item.sourceRows ? item.sourceRows.join(', ') : item.sourceRow}`} · Lantai {item.floor || '—'} · Class Id {item.classId || '—'}</p>
        {pending?.status === 'conflict' && <ConflictPanel key={pending.conflict?.serverRevision} op={pending} onResolve={choice => resolveBOQConflict(item.id, choice)} />}
        {loading && <p className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="animate-spin" size={14} /> Mengecek versi terbaru di server…</p>}
        {notice && <p className="mb-4 rounded-xl bg-sky-50 p-3 text-xs text-sky-900">{notice}</p>}
        {error && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
        <div className="mb-6 border-b pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Foto item{visiblePhotos.length + jobs.length > 0 && <span className="ml-1.5 text-sm font-normal text-slate-500">({visiblePhotos.length + jobs.length})</span>}</h3><button className={buttonClass} disabled={preparing || !outbox.ready} onClick={() => fileInput.current?.click()}>{preparing ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} {preparing ? 'Memproses…' : 'Upload foto'}</button></div>
          <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP · resolusi asli, dikompres otomatis sebelum dikirim. Foto disimpan di HP dulu, jadi aman walau sinyal putus.</p>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void selectFiles(files); }} />
          {photoError && <div role="status" className="mt-3 text-xs text-amber-800">{photoError}<button className="ml-2 font-semibold underline" disabled={photosLoading} onClick={() => void loadPhotos()}>Coba muat lagi</button></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {jobs.map(job => <div key={job.key} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40 p-2">
              <div className="relative overflow-hidden rounded-lg bg-slate-100">
                {job.previewUrl && <img src={job.previewUrl} alt={job.name} className="h-32 w-full object-cover opacity-80 sm:h-28" />}
                <button type="button" onClick={() => void cancelBOQPhotoUpload(job.key)} className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-white" title="Batalkan foto ini" aria-label={'Batalkan ' + job.name}><X size={14} /></button>
              </div>
              <p className="mt-2 line-clamp-1 break-all text-xs text-slate-700" title={job.name}>{job.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: job.progress + '%' }} /></div>
              <p className={'mt-1 text-[11px] ' + (job.error ? 'text-amber-700' : 'text-slate-500')}>{job.error ? 'Tertunda: dicoba lagi otomatis' : job.waiting ? 'Menunggu sinyal…' : `Mengirim ${job.progress}%`}</p>
            </div>)}
            {visiblePhotos.map(photo => (
              <PhotoThumbnail key={photo.id} photo={photo} onCrop={file => selectFiles([file])} onDelete={handleDeletePhoto} onReplace={handleReplacePhoto} disabled={preparing} />
            ))}
          </div>
          {photosLoading && <p className="mt-3 text-sm text-slate-500">Memuat foto…</p>}
          {!photosLoading && !visiblePhotos.length && !jobs.length && <button type="button" disabled={preparing || !outbox.ready} onClick={() => fileInput.current?.click()} className="mt-3 flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"><Camera size={26} className="text-slate-400" /><span className="font-semibold text-slate-700">Belum ada foto. Ketuk untuk ambil / upload foto</span></button>}
          {hasMore && <button className={buttonClass + ' mt-3 w-full'} disabled={photosLoading} onClick={() => void loadPhotos(true)}>Muat 20 foto berikutnya</button>}
        </div>
        <h3 className="mb-3 font-semibold">Data aset</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {editable.map(field => (
            <label key={field} className={'block text-sm font-medium' + (field === 'ciName' || field === 'ciDescription' ? ' sm:col-span-2' : '')}>
              {BOQ_FIELD_LABELS[field]}
              {/* Merged BOQ rows (e.g. UPS modules) hold one value per line; a single-line input would drop the line breaks. */}
              {field === 'ciDescription' || fields[field].includes('\n') || item[field].includes('\n')
                ? <textarea className={fieldInputClass(field) + (field === 'ciDescription' ? ' min-h-28' : ' min-h-24')} value={fields[field]} maxLength={fieldMaxLength(field)} disabled={saving} onChange={event => setFields(previous => ({ ...previous, [field]: event.target.value }))} />
                : <input className={fieldInputClass(field)} value={fields[field]} maxLength={fieldMaxLength(field)} disabled={saving} onChange={event => setFields(previous => ({ ...previous, [field]: event.target.value }))} />}
            </label>
          ))}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        {/* Everything is stored on the phone first; the button saves text, or closes when there is none. */}
        <p className="text-xs text-slate-500">{saving ? 'Menyimpan…' : preparing ? 'Memproses foto…' : dirty ? 'Perubahan data aset belum disimpan' : pending?.status === 'conflict' ? 'Ada bentrok data, pilih nilai di atas' : waitingToSend ? 'Tersimpan di HP · menunggu dikirim' : 'Semua sudah terkirim ke server'}</p>
        {dirty || saving
          ? <button className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Simpan item</button>
          : <button className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={preparing} onClick={onClose}><Check size={17} /> Selesai</button>}
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

const emptyNewItem = (room: string, floor: string, category: string): NewBOQItemInput => ({ ...fieldsOf({}), room, floor, category, classId: '' });

function AddItemModal({ rooms, categories, classIds, floorByRoom, initialRoom, initialCategory, saving, error, onCancel, onSubmit }: {
  rooms: string[]; categories: string[]; classIds: string[]; floorByRoom: Map<string, string>; initialRoom: string; initialCategory: string;
  saving: boolean; error: string; onCancel: () => void; onSubmit: (input: NewBOQItemInput) => void;
}) {
  const [form, setForm] = useState<NewBOQItemInput>(() => emptyNewItem(initialRoom, floorByRoom.get(roomKeyOf(initialRoom)) || '', initialCategory));
  const set = (patch: Partial<NewBOQItemInput>) => setForm(previous => ({ ...previous, ...patch }));
  const canSubmit = !saving && form.room.trim() !== '' && form.classId.trim() !== '' && form.ciName.trim() !== '';
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tambah item BOQ" className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onKeyDown={event => { if (event.key === 'Escape' && !saving) onCancel(); }}>
      <form className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onSubmit={event => { event.preventDefault(); if (canSubmit) onSubmit(form); }}>
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="min-w-0"><h3 className="text-base font-bold">Tambah item BOQ</h3><p className="text-xs text-slate-500">Item baru masuk ke ruangan yang dipilih. Foto bisa ditambahkan setelah disimpan.</p></div>
          <button type="button" aria-label="Tutup" disabled={saving} onClick={onCancel} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"><X size={18} /></button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Ruangan *<input className={inputClass + ' mt-1'} list="boq-add-rooms" value={form.room} maxLength={200} autoFocus disabled={saving} placeholder="Pilih / ketik ruangan"
              onChange={event => { const room = event.target.value; set({ room, floor: floorByRoom.get(roomKeyOf(room)) ?? form.floor }); }} /></label>
            <label className="block text-sm font-medium">Kategori<input className={inputClass + ' mt-1'} list="boq-add-categories" value={form.category} maxLength={100} disabled={saving} placeholder="Contoh: LV Panel" onChange={event => set({ category: event.target.value })} /></label>
            <label className="block text-sm font-medium">Class Id *<input className={inputClass + ' mt-1'} list="boq-add-classes" value={form.classId} maxLength={200} disabled={saving} placeholder="Contoh: LV" onChange={event => set({ classId: event.target.value })} /></label>
            <label className="block text-sm font-medium">Lantai<input className={inputClass + ' mt-1'} value={form.floor} maxLength={50} disabled={saving} placeholder="Contoh: 1F" onChange={event => set({ floor: event.target.value })} /></label>
          </div>
          <datalist id="boq-add-rooms">{rooms.map(value => <option key={value} value={value} />)}</datalist>
          <datalist id="boq-add-categories">{categories.map(value => <option key={value} value={value} />)}</datalist>
          <datalist id="boq-add-classes">{classIds.map(value => <option key={value} value={value} />)}</datalist>
          <div className="grid gap-4 sm:grid-cols-2">
            {BOQ_EDITABLE_FIELDS.map(field => (
              <label key={field} className={'block text-sm font-medium' + (field === 'ciName' || field === 'ciDescription' ? ' sm:col-span-2' : '')}>
                {BOQ_FIELD_LABELS[field]}{field === 'ciName' && ' *'}
                {field === 'ciDescription'
                  ? <textarea className={inputClass + ' mt-1 min-h-24'} value={form[field]} maxLength={fieldMaxLength(field)} disabled={saving} onChange={event => set({ [field]: event.target.value })} />
                  : <input className={fieldInputClass(field)} value={form[field]} maxLength={fieldMaxLength(field)} disabled={saving} onChange={event => set({ [field]: event.target.value })} />}
              </label>
            ))}
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

function DeleteItemModal({ item, deleting, onCancel, onConfirm }: { item: BOQItem; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Konfirmasi hapus item" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={() => !deleting && onCancel()} onKeyDown={event => { if (event.key === 'Escape' && !deleting) onCancel(); }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={22} /></div>
          <div className="min-w-0"><h3 className="text-base font-bold text-slate-900">Hapus item dari ruangan?</h3><p className="text-xs text-slate-500">Item tidak akan tampil lagi di daftar dan export Excel</p></div>
        </div>
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="break-words font-semibold text-slate-800">{item.ciName}</p>
          <p className="mt-1 break-words text-xs text-slate-500">{item.sheet} · {item.classId || 'Tanpa Class Id'} · {item.room || NO_ROOM}</p>
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

// Reading the latest server values can fail on a weak signal; that never blocks work on the phone.
const listLoadError = (error: unknown) => (error as { code?: string })?.code?.includes('permission-denied')
  ? boqErrorMessage(error)
  : 'Perubahan terbaru dari server belum termuat karena sinyal lemah. Data di HP tetap bisa dipakai dan diedit.';
interface RoomGroup { key: string; label: string; count: number; categories: string[] }
const STEP = 40;
const blank = (value: string) => !value || /^(n\/?a|-+)$/i.test(value.trim());

function matchesSearch(item: BOQItem, override: BOQOverride | undefined, term: string) {
  return [item.room, item.sheet, item.section, item.classId, ...item.values, ...BOQ_EDITABLE_FIELDS.map(field => item[field]), ...BOQ_EDITABLE_FIELDS.map(field => override?.[field])]
    .some(value => value?.toLowerCase().includes(term));
}

// The few facts a drafter uses to recognise an asset on site.
function itemFacts(item: BOQItem, override?: BOQOverride): [string, string][] {
  const value = (field: BOQEditableField) => (override?.[field] ?? item[field] ?? '').split('\n')[0].trim();
  const facts: [string, string][] = [];
  if (!blank(item.classId) && item.classId !== item.ciName) facts.push(['Class', item.classId]);
  if (!blank(value('serialNumber'))) facts.push(['S/N', value('serialNumber')]);
  if (!blank(value('tag'))) facts.push(['TAG', value('tag')]);
  else if (!blank(value('assetId'))) facts.push(['Asset ID', value('assetId')]);
  if (!blank(value('capacity'))) facts.push(['Kapasitas', value('capacity')]);
  return facts;
}

interface ItemSync { text?: 'pending' | 'conflict'; photos: number }
function ItemRow({ item, override, sync, showRoom, onOpen, onDelete }: { item: BOQItem; override?: BOQOverride; sync?: ItemSync; showRoom: boolean; onOpen: () => void; onDelete: () => void }) {
  const name = override?.ciName || item.ciName;
  const description = (override?.ciDescription ?? item.ciDescription).split('\n')[0].trim();
  const context = [showRoom ? (item.room ? roomLabel(item.room) : NO_ROOM) : '', showRoom || item.custom ? item.sheet : '', !blank(description) && description !== name ? description : ''].filter(Boolean);
  return <li className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-slate-50 sm:gap-3 sm:px-4">
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none" aria-label={'Buka ' + name}>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-words font-semibold text-slate-900">{name}</span>
        {override && !item.custom && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Diedit</span>}
        {item.custom && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Tambahan</span>}
        {sync?.text === 'conflict' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">⚠️ Bentrok</span>}
        {sync && sync.text !== 'conflict' && (sync.text || sync.photos > 0) && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">⏳ Belum terkirim{sync.photos ? ` · ${sync.photos} foto` : ''}</span>}
      </span>
      {context.length > 0 && <span className="mt-0.5 block break-words text-xs text-slate-500">{context.join(' · ')}</span>}
      {itemFacts(item, override).length > 0 && <span className="mt-1.5 flex flex-wrap gap-1.5">
        {itemFacts(item, override).map(([label, value]) => <span key={label} className="max-w-full break-all rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700"><span className="text-slate-400">{label}</span> {value}</span>)}
      </span>}
    </button>
    <button type="button" onClick={onOpen} className={buttonClass + ' shrink-0 !min-h-10'} title="Foto & edit item" aria-label={'Foto dan edit ' + name}><Camera size={16} /><span className="hidden sm:inline">Foto & edit</span></button>
    <button type="button" onClick={onDelete} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600" title="Hapus item dari ruangan ini" aria-label={'Hapus ' + name}><Trash2 size={17} /></button>
  </li>;
}

function RoomCard({ group, onOpen }: { group: RoomGroup; onOpen: () => void }) {
  const noRoom = !group.key;
  return <button type="button" onClick={onOpen}
    className={'group flex cursor-pointer flex-col rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (noRoom ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-200 bg-white shadow-sm')}>
    <span className="flex w-full items-start justify-between gap-2">
      <span className={'break-words font-semibold ' + (noRoom ? 'text-slate-600' : 'text-slate-900')}>{group.label}</span>
      <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">{group.count.toLocaleString('id-ID')}</span>
    </span>
    <span className="mt-1.5 line-clamp-2 text-xs text-slate-500">
      {noRoom ? 'Aset yang di BOQ tidak tercantum ruangannya' : group.categories.slice(0, 3).join(' · ') + (group.categories.length > 3 ? ` · +${group.categories.length - 3} lainnya` : '')}
    </span>
  </button>;
}

export function BOQUpdate() {
  const { user } = useAuth();
  // null = room overview; '' = the "no room" group.
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(STEP);
  const [overrides, setOverrides] = useState<Record<string, BOQOverride>>({});
  const loadedIds = useRef(new Set<string>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<BOQItem | null>(null);
  const [customItems, setCustomItems] = useState<BOQItem[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [toDelete, setToDelete] = useState<BOQItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const exporting = exportStatus !== '';
  const outbox = useBOQOutbox();
  // Workbook rows plus drafter-added items (including ones still waiting on the phone), minus deleted ones.
  const allItems = useMemo(() => {
    const known = new Set(customItems.map(item => item.id));
    const queuedCreates = Object.values(outbox.texts).filter(op => op.create && !known.has(op.itemId)).map(op => op.item);
    return [...boqItems, ...customItems, ...queuedCreates].filter(item => !deletedIds.has(item.id) && !outbox.texts[item.id]?.deleted);
  }, [customItems, deletedIds, outbox.texts]);
  // Queued edits are shown immediately, on top of the last known server version.
  const effectiveOverride = (item: BOQItem): BOQOverride | undefined => {
    const queued = outbox.texts[item.id];
    return queued ? { ...overrides[item.id], ...queued.fields, revision: overrides[item.id]?.revision ?? 0 } : overrides[item.id];
  };
  const syncOf = (item: BOQItem): ItemSync | undefined => {
    const text = outbox.texts[item.id]?.status;
    const photos = outbox.photoJobs.filter(job => job.itemId === item.id).length;
    return text || photos ? { text, photos } : undefined;
  };
  useEffect(() => onBOQOutboxEvent(event => {
    if (event.type !== 'text') return;
    setOverrides(previous => ({ ...previous, [event.itemId]: event.value }));
    if (event.value.deleted) setDeletedIds(previous => new Set(previous).add(event.itemId));
  }), []);
  useEffect(() => {
    let active = true;
    Promise.all([readCustomBOQItems(), readDeletedBOQIds()]).then(([custom, deleted]) => {
      if (active) { setCustomItems(custom); setDeletedIds(deleted); }
    }).catch(loadError => { if (active) setError(listLoadError(loadError)); });
    return () => { active = false; };
  }, [refresh]);

  const openRoom = (key: string | null) => { setRoomKey(key); setCategory(''); setSearch(''); setLimit(STEP); window.scrollTo({ top: 0 }); };
  const reload = () => { loadedIds.current.clear(); setOverrides({}); setRefresh(value => value + 1); };
  const addItem = async (input: NewBOQItemInput) => {
    if (!user || adding) return;
    setAdding(true); setAddError('');
    try {
      const created = await queueBOQCreate(input);
      setCustomItems(previous => [...previous, created]);
      setAddOpen(false);
      openRoom(roomKeyOf(created.room));
      toast.success(`"${created.ciName}" ditambahkan ke ${created.room}.`);
      setSelected(created);
    } catch (addFailure) { setAddError(boqErrorMessage(addFailure)); }
    finally { setAdding(false); }
  };
  const confirmDelete = async () => {
    if (!user || !toDelete || deleting) return;
    setDeleting(true);
    try {
      const current = fieldsOf({ ...toDelete, ...effectiveOverride(toDelete) });
      await queueBOQText(toDelete, current, current, true);
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
      const result = await exportDrafterBOQExcel(boqItems, setExportStatus);
      toast.success(`${result.fileName}: ${result.itemCount} item, ${result.roomCount} ruangan, ${result.photoCount - result.failedPhotos} foto.`);
      if (result.failedPhotos) toast.warning(`${result.failedPhotos} foto gagal dimuat dan ditandai di Excel.`);
      result.warnings.forEach(warning => toast.warning(warning));
    } catch (exportError) {
      toast.error('Export BOQ gagal: ' + boqErrorMessage(exportError));
    } finally { setExportStatus(''); }
  };

  const roomGroups = useMemo(() => {
    const groups = new Map<string, RoomGroup & { categorySet: Set<string> }>();
    for (const item of allItems) {
      const key = roomKeyOf(item.room);
      const group = groups.get(key) || { key, label: key ? roomLabel(item.room) : NO_ROOM, count: 0, categories: [], categorySet: new Set<string>() };
      group.count++;
      group.categorySet.add(item.sheet);
      groups.set(key, group);
    }
    return [...groups.values()]
      .map(({ categorySet, ...group }) => ({ ...group, categories: [...categorySet] }))
      .sort((a, b) => !a.key ? 1 : !b.key ? -1 : a.label.localeCompare(b.label, 'id', { numeric: true, sensitivity: 'base' }));
  }, [allItems]);
  const term = search.trim().toLowerCase();
  const inRoom = roomKey !== null;
  const currentRoom = inRoom ? roomGroups.find(group => group.key === roomKey) || { key: roomKey, label: roomKey || NO_ROOM, count: 0, categories: [] } : null;
  const matchedRooms = useMemo(() => term ? roomGroups.filter(group => group.label.toLowerCase().includes(term)) : roomGroups, [roomGroups, term]);
  const roomItems = useMemo(() => inRoom ? allItems.filter(item => roomKeyOf(item.room) === roomKey) : allItems, [allItems, inRoom, roomKey]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of roomItems) counts.set(item.sheet, (counts.get(item.sheet) || 0) + 1);
    return [...counts].sort((a, b) => tableOrder(roomItems.find(item => item.sheet === a[0])!.tableId) - tableOrder(roomItems.find(item => item.sheet === b[0])!.tableId));
  }, [roomItems]);
  // In the overview the list only appears while searching; inside a room it lists the room's items.
  const listItems = useMemo(() => {
    if (!inRoom && !term) return [];
    return roomItems
      .filter(item => (!category || item.sheet === category) && (!term || matchesSearch(item, effectiveOverride(item), term)))
      .sort((a, b) => tableOrder(a.tableId) - tableOrder(b.tableId) || a.sourceRow - b.sourceRow || a.ciName.localeCompare(b.ciName));
  }, [inRoom, term, roomItems, category, overrides, outbox.texts]);
  const shown = listItems.slice(0, limit);
  const groups = useMemo(() => {
    const bySheet = new Map<string, BOQItem[]>();
    for (const item of shown) bySheet.set(item.sheet, [...(bySheet.get(item.sheet) || []), item]);
    return [...bySheet];
  }, [shown]);
  const countBySheet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of listItems) counts.set(item.sheet, (counts.get(item.sheet) || 0) + 1);
    return counts;
  }, [listItems]);

  // Saved edits are fetched once per listed item; "Muat ulang" clears them.
  const idsKey = shown.map(item => item.id).filter(id => !loadedIds.current.has(id)).join('|');
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split('|');
    setLoading(true); setError('');
    // Not cancelled when the list changes: the response is still valid for these IDs.
    readBOQPage(ids).then(values => {
      ids.forEach(id => loadedIds.current.add(id));
      setOverrides(previous => ({ ...previous, ...values }));
    }).catch(loadError => setError(listLoadError(loadError))).finally(() => setLoading(false));
  }, [idsKey, refresh]);

  if (selected && user) {
    return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <BOQEditor key={selected.id} item={selected} uid={user.uid} override={overrides[selected.id]} onClose={() => setSelected(null)} />
    </section>;
  }

  const itemList = (items: BOQItem[], showRoom: boolean) => <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
    {items.map(item => <ItemRow key={item.id} item={item} override={effectiveOverride(item)} sync={syncOf(item)} showRoom={showRoom} onOpen={() => setSelected(item)} onDelete={() => setToDelete(item)} />)}
  </ul>;
  const moreButton = listItems.length > shown.length && <button type="button" className={buttonClass + ' mt-4 w-full'} onClick={() => setLimit(value => value + STEP)}>
    Tampilkan lebih banyak ({(listItems.length - shown.length).toLocaleString('id-ID')} item lagi)
  </button>;

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold sm:text-2xl">Update BOQ</h1>
        <p className="mt-1 text-sm text-slate-500">{inRoom ? 'Klik item untuk update data dan foto.' : 'Pilih ruangan, lalu klik item untuk update data dan foto.'}</p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button className={buttonClass + ' flex-1 !border-blue-600 !bg-blue-600 text-white sm:flex-none'} disabled={exporting} onClick={() => { setAddError(''); setAddOpen(true); }}><Plus size={16} /> <span className="whitespace-nowrap">Tambah<span className="hidden sm:inline"> item</span></span></button>
        <button className={buttonClass + ' flex-1 sm:flex-none'} disabled={exporting} onClick={() => void exportExcel()}>{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} <span className="whitespace-nowrap">{exporting ? exportStatus : 'Export Excel'}</span></button>
        <button className={buttonClass + ' !px-3'} disabled={loading || exporting} onClick={reload} title="Muat ulang data dari server" aria-label="Muat ulang data dari server"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>
    </div>
    {error && <p role="status" className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{error}</p>}

    {!inRoom ? <>
      <div className="relative mt-5">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={inputClass + ' !rounded-2xl !py-3.5 pl-12 text-base'} placeholder="Cari ruangan, nama aset, S/N atau TAG…" value={search} onChange={event => { setSearch(event.target.value); setLimit(STEP); }} aria-label="Cari ruangan atau aset" />
      </div>
      {(!term || matchedRooms.length > 0) && <>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-700">{term ? `Ruangan yang cocok (${matchedRooms.length})` : `Pilih ruangan (${roomGroups.filter(group => group.key).length} ruangan · ${allItems.length.toLocaleString('id-ID')} aset)`}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matchedRooms.map(group => <RoomCard key={group.key || 'no-room'} group={group} onOpen={() => openRoom(group.key)} />)}
        </div>
      </>}
      {term && <>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-700">Aset yang cocok ({listItems.length.toLocaleString('id-ID')})</h2>
        {listItems.length ? itemList(shown, true) : <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Tidak ada aset yang cocok dengan "{search.trim()}".</p>}
        {moreButton}
      </>}
    </> : <>
      <button type="button" onClick={() => openRoom(null)} className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg py-1 text-sm font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft size={16} /> Semua ruangan</button>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-bold text-slate-900">{currentRoom!.label}</h2>
          <p className="text-sm text-slate-500">{roomItems.length.toLocaleString('id-ID')} aset · {categories.length} kategori{!roomKey && ' · ruangan tidak tercantum di BOQ'}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className={inputClass + ' pl-9'} placeholder={'Cari di ' + currentRoom!.label + '…'} value={search} onChange={event => { setSearch(event.target.value); setLimit(STEP); }} aria-label="Cari aset di ruangan ini" /></div>
        {categories.length > 1 && <select className={inputClass + ' sm:w-64'} value={category} onChange={event => { setCategory(event.target.value); setLimit(STEP); }} aria-label="Filter kategori">
          <option value="">Semua kategori ({roomItems.length})</option>
          {categories.map(([sheet, count]) => <option key={sheet} value={sheet}>{sheet} ({count})</option>)}
        </select>}
      </div>
      {groups.map(([sheet, items]) => <section key={sheet} className="mt-5">
        <h3 className="mb-2 flex items-baseline justify-between gap-2 text-sm font-bold text-slate-800">{sheet}<span className="text-xs font-normal text-slate-500">{countBySheet.get(sheet)} aset</span></h3>
        {itemList(items, false)}
      </section>)}
      {!listItems.length && <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Tidak ada aset yang cocok.</p>}
      {moreButton}
    </>}

    <p className="mt-6 border-t pt-3 text-xs text-slate-400">Sumber: {BOQ_SOURCE.file} (impor {BOQ_SOURCE.importedAt}).</p>
    {addOpen && <AddItemModal
      rooms={roomGroups.filter(group => group.key).map(group => group.label)}
      categories={[...new Set([...boqTables.map(table => table.sheet), CUSTOM_CATEGORY])]}
      classIds={[...new Set(allItems.map(item => item.classId).filter(Boolean))].sort()}
      floorByRoom={new Map(allItems.filter(item => item.floor).map(item => [roomKeyOf(item.room), item.floor]))}
      initialRoom={currentRoom?.key ? currentRoom.label : ''}
      initialCategory={category}
      saving={adding} error={addError} onCancel={() => setAddOpen(false)} onSubmit={input => void addItem(input)} />}
    {toDelete && <DeleteItemModal item={toDelete} deleting={deleting} onCancel={() => setToDelete(null)} onConfirm={() => void confirmDelete()} />}
  </section>;
}
