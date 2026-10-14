import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { getAppUpdateSnapshot, performAppUpdate, subscribeAppUpdate } from '@/utils/appUpdate';

export function AppUpdateDialog() {
  const update = useSyncExternalStore(subscribeAppUpdate, getAppUpdateSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = ['waiting', 'saving', 'updating'].includes(update.phase);
  useEffect(() => {
    if (update.required && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [update.required]);
  if (!update.required) return null;

  const label = update.phase === 'waiting' ? 'Menunggu proses selesai…'
    : update.phase === 'saving' ? 'Menyimpan draft…'
    : update.phase === 'updating' ? 'Memperbarui aplikasi…'
    : update.phase === 'error' ? 'Coba Perbarui Lagi' : 'Perbarui Sekarang';

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      aria-describedby="app-update-description"
      data-app-update-required="true"
      onCancel={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); } }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-sky-100 bg-white p-6 text-center text-slate-800 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:p-8"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
        <Download className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-700">Pembaruan diperlukan</p>
      <h2 id="app-update-title" className="text-xl font-extrabold sm:text-2xl">Versi baru aplikasi tersedia</h2>
      <p id="app-update-description" className="mt-3 text-sm leading-6 text-slate-600">
        Perbarui aplikasi untuk melanjutkan. Draft akan disimpan terlebih dahulu dan proses unggah yang sedang berjalan akan ditunggu sampai selesai.
      </p>
      {update.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{update.error}</p>}
      <button
        type="button"
        autoFocus
        disabled={busy}
        onClick={() => { void performAppUpdate(); }}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        <span aria-live="polite">{label}</span>
      </button>
    </dialog>
  );
}
