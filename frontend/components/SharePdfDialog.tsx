// ============================================================================
// FILE: SharePdfDialog.tsx
// Deskripsi: Popup "Kirim ke Grup WhatsApp" setelah PDF selesai dibuat. Tombol utama
//            membuka menu Bagikan bawaan HP (Web Share API) yang sudah berisi file PDF,
//            jadi user tinggal pilih WhatsApp lalu grupnya tanpa mencari file di HP.
//            Dirender di root React sendiri supaya tetap tampil walau form asal sudah
//            ditutup (mis. export dari Arsip yang langsung kembali ke daftar).
// ============================================================================

import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'motion/react';
import { X, Send, Download, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

const canSharePdf = (file: File) => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
};

interface SharePdfDialogProps {
  blob: Blob;
  fileName: string;
  onClose: () => void;
}

function SharePdfDialog({ blob, fileName, onClose }: SharePdfDialogProps) {
  const [file] = useState(() => new File([blob], fileName, { type: 'application/pdf' }));
  const [shareSupported] = useState(() => canSharePdf(file));
  const [sharing, setSharing] = useState(false);

  const saveToPhone = () => {
    saveAs(blob, fileName);
    toast.success('PDF disimpan ke folder Download di HP');
  };

  const shareToWhatsApp = async () => {
    setSharing(true);
    try {
      await navigator.share({ files: [file], title: fileName });
      onClose();
    } catch (err) {
      // Batal memilih aplikasi: popup tetap terbuka supaya bisa dicoba lagi
      if ((err as DOMException)?.name === 'AbortError') return;
      console.error('Share PDF failed:', err);
      toast.error('Menu Bagikan gagal dibuka, PDF disimpan ke HP');
      saveToPhone();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900">PDF Siap Dikirim</h3>
              <p className="text-xs text-slate-500 font-medium break-all">{fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer" title="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {shareSupported ? (
            <>
              <ol className="space-y-2 text-sm font-semibold text-slate-700">
                <li>1. Tekan tombol hijau di bawah</li>
                <li>2. Pilih <span className="font-black text-emerald-700">WhatsApp</span></li>
                <li>3. Pilih grup tujuan, lalu tekan Kirim</li>
              </ol>
              <button
                onClick={shareToWhatsApp}
                disabled={sharing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-2xl font-black text-base uppercase tracking-wide shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-3 cursor-pointer"
              >
                {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Kirim ke Grup WhatsApp
              </button>
              <button
                onClick={saveToPhone}
                className="w-full py-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Simpan ke HP Saja
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700">
                HP/browser ini belum bisa kirim langsung ke WhatsApp. Simpan PDF ke HP dulu, lalu kirim lewat WhatsApp &rarr; lampiran &rarr; Dokumen.
              </p>
              <button
                onClick={saveToPhone}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base uppercase tracking-wide shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-3 cursor-pointer"
              >
                <Download className="w-5 h-5" />
                Simpan ke HP
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function openSharePdfDialog(blob: Blob, fileName: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const close = () => {
    root.unmount();
    host.remove();
  };
  root.render(<SharePdfDialog blob={blob} fileName={fileName} onClose={close} />);
}
