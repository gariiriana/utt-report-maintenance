// ============================================================================
// FILE: frontend/components/UploadSRModal.tsx
// Deskripsi: Modal Unggah & Sinkronisasi Service Report (SR) di Arsip Dokumen.
//            Mendukung pengunggahan berkas Excel (.xlsx/.xls) dengan parsing otomatis
//            ke format ServiceReportPayload resmi, serta berkas PDF Service Report.
// ============================================================================

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileUp,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Clock,
  Box,
  Sparkles,
  Loader2,
  Trash2
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import { ExcelDocument } from '@/components/DocumentList';
import { useAuth } from '@/components/AuthContext';
import { parseExcelServiceReport, ParseExcelSRResult } from '@/utils/excelSrParser';
import { getServiceReportConfigByEmail } from '@/config/serviceReportRegistry';
import { offlineReportStorage } from '@/utils/offlineReportStorage';

interface UploadSRModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ExcelDocument | null;
  onSuccess: (updatedFields: Partial<ExcelDocument>) => void;
}

export function UploadSRModal({
  isOpen,
  onClose,
  document: docItem,
  onSuccess
}: UploadSRModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseExcelSRResult | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen || !docItem) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setFileBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = async (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isPDF = file.name.endsWith('.pdf');

    if (!isExcel && !isPDF) {
      toast.error('Format berkas tidak didukung. Harap upload file Excel (.xlsx) atau PDF (.pdf).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Ukuran berkas melebihi batas maksimal 25 MB.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);

    try {
      // 1. Konversi ke Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const b64 = await base64Promise;
      setFileBase64(b64);

      // 2. Jika Excel, parse data spreadsheet
      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const accountEmail = docItem.createdBy || user?.email || 'pump@gmail.com';
        const parsed = await parseExcelServiceReport(arrayBuffer, file.name, accountEmail);
        setParseResult(parsed);
        toast.success(`Spreadsheet Excel berhasil dibaca: ${parsed.parsedSummary.totalChecklist} item checklist terdeteksi!`);
      } else {
        toast.success(`Berkas PDF Service Report "${file.name}" siap dilampirkan.`);
      }
    } catch (err: any) {
      console.error('Error processing SR file:', err);
      toast.error(`Gagal memproses berkas: ${err.message || 'Format tidak valid'}`);
      handleReset();
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error('Pilih berkas Service Report terlebih dahulu.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Menyimpan & menyinkronkan Service Report ke arsip...');

    try {
      const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      const accountEmail = docItem.createdBy || user?.email || 'pump@gmail.com';
      const defaultConfig = getServiceReportConfigByEmail(accountEmail);

      // Payload yang akan disimpan
      let payloadToSave: any = null;
      if (isExcel && parseResult?.payload) {
        payloadToSave = parseResult.payload;
      } else {
        // Fallback default jika PDF atau data minimal
        payloadToSave = {
          equipmentKey: defaultConfig?.key || 'sr',
          equipmentName: docItem.maintenanceName || defaultConfig?.name || 'Service Report',
          accountEmail: accountEmail,
          customerInfo: {
            ...(defaultConfig?.defaultCustomerInfo || {}),
            equipmentName: docItem.maintenanceName || '',
            date: docItem.maintenanceTime || new Date().toISOString().split('T')[0],
            ciDescription: docItem.specificDetail || ''
          },
          timeSpent: defaultConfig?.defaultTimeSpent || {
            date: docItem.maintenanceTime || new Date().toISOString().split('T')[0],
            departure: '08:00',
            arrival: '08:30',
            start: '09:00',
            finish: '17:00'
          },
          operationStatus: defaultConfig?.defaultOperationStatus || {
            isNormal: true,
            remark: 'Unit beroperasi normal.'
          },
          visualChecklist: defaultConfig?.checklistTemplate || [],
          measurements: {}
        };
      }

      // Metadata file yang diupload
      const attachedSrFileMeta = {
        name: selectedFile.name,
        type: selectedFile.type || (isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'),
        size: selectedFile.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.email || 'engineer',
      };

      // Sanitize payload & metadata to ensure ZERO undefined values for Firestore
      const cleanPayload = JSON.parse(JSON.stringify(payloadToSave));
      const cleanMeta = JSON.parse(JSON.stringify(attachedSrFileMeta));
      const colName = docItem.documentType === 'excel' ? 'excel_documents' : (docItem.documentType === 'hse' ? 'hse' : 'pdf_documents');

      const updateData: Record<string, any> = {
        hasServiceReport: true,
        serviceReportPayload: cleanPayload,
        attachedSrFile: cleanMeta,
        updatedAt: serverTimestamp()
      };

      // Simpan base64 jika ukuran di bawah 400KB (aman di batas dokumen Firestore 1MB)
      if (selectedFile.size < 400 * 1024 && fileBase64) {
        updateData.attachedSrBase64 = fileBase64;
      }

      // Update dokumen Firestore
      await updateDoc(doc(db, colName, docItem.id), updateData);

      // Simpan juga ke IndexedDB lokal agar selalu tersedia bahkan saat offline
      try {
        await offlineReportStorage.saveReport({
          id: docItem.id,
          fileName: docItem.fileName,
          maintenanceName: docItem.maintenanceName,
          maintenanceTime: docItem.maintenanceTime,
          specificDetail: docItem.specificDetail || '',
          companyType: docItem.companyType || 'neutra',
          createdBy: docItem.createdBy || user?.email || '',
          fileSize: docItem.fileSize || 0,
          documentType: docItem.documentType || 'pdf',
          hasServiceReport: true,
          serviceReportPayload: cleanPayload,
          attachedSrFile: cleanMeta,
          attachedSrBase64: fileBase64 || undefined,
          isSynced: true
        });
      } catch (storageErr) {
        console.warn('Could not save uploaded SR to offlineReportStorage:', storageErr);
      }

      // Beritahu parent component untuk update state lokal real-time
      onSuccess({
        hasServiceReport: true,
        serviceReportPayload: cleanPayload,
        attachedSrFile: cleanMeta,
        attachedSrBase64: fileBase64 || undefined,
      });

      toast.success('Service Report berhasil di-upload & disinkronkan ke dokumen!', { id: toastId });
      onClose();
    } catch (err: any) {
      console.error('Error saving uploaded SR:', err);
      toast.error(`Gagal menyimpan SR: ${err.message || 'Terjadi kesalahan sistem'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
        >
          {/* HEADER MODAL */}
          <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-md">
                <FileUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                  <span>Upload Service Report (SR)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30">
                    Fitur Engineer
                  </span>
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Lampirkan berkas Excel (.xlsx) atau PDF Service Report pada dokumen arsip
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ISI KONTEN MODAL */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-800 custom-scrollbar">
            {/* KARTU DOKUMEN TARGET */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dokumen Target:</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                    (docItem.attachedSrFile || docItem.attachedSrBase64)
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {(docItem.attachedSrFile || docItem.attachedSrBase64) ? 'Foto + SR Lengkap' : 'Dokumentasi Foto Saja'}
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900 leading-snug">
                  {docItem.maintenanceName}
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-0.5">
                  {docItem.specificDetail && (
                    <span className="flex items-center gap-1 text-blue-600 font-semibold">
                      <Box className="w-3.5 h-3.5" />
                      {docItem.specificDetail}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {docItem.maintenanceTime}
                  </span>
                </div>
              </div>

              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4 shrink-0">
                <div className="text-[11px] text-slate-500 font-medium">Akun Pembuat</div>
                <div className="text-xs font-bold text-slate-800">{docItem.createdBy}</div>
              </div>
            </div>

            {/* DROPZONE AREA */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/70 scale-[0.99]'
                  : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.pdf"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />

              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition ${
                selectedFile
                  ? selectedFile.name.endsWith('.pdf')
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-emerald-100 text-emerald-600'
                  : 'bg-indigo-50 text-indigo-600'
              }`}>
                {isParsing ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : selectedFile ? (
                  selectedFile.name.endsWith('.pdf') ? <FileText className="w-7 h-7" /> : <FileSpreadsheet className="w-7 h-7" />
                ) : (
                  <FileUp className="w-7 h-7" />
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Pilih Berkas Service Report'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {selectedFile
                    ? `Ukuran: ${(selectedFile.size / 1024).toFixed(1)} KB • Klik untuk mengganti berkas`
                    : 'Tarik & lepas file Excel (.xlsx) atau PDF di sini, atau klik untuk mencari berkas di perangkat Anda.'}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                <span className="text-emerald-600 font-black">EXCEL (.xlsx, .xls)</span>
                <span>•</span>
                <span className="text-rose-600 font-black">PDF (.pdf)</span>
              </div>
            </div>

            {/* LIVE PARSE PREVIEW RESULTS JIKA EXCEL */}
            {parseResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Hasil Ekstraksi Otomatis Spreadsheet Excel:</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 font-bold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Equipment</span>
                    <span className="font-black text-slate-900 truncate block">
                      {parseResult.parsedSummary.equipmentName}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">No MOP</span>
                    <span className="font-black text-slate-900 truncate block">
                      {parseResult.parsedSummary.mopNo}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Checklist</span>
                    <span className="font-black text-indigo-700 block">
                      {parseResult.parsedSummary.totalChecklist} Item Terbaca
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-indigo-100">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Status Operasi</span>
                    <span className={`font-black block ${
                      parseResult.parsedSummary.isNormal ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {parseResult.parsedSummary.isNormal ? '✓ Normal' : '⚠ Abnormal'}
                    </span>
                  </div>
                </div>

                {parseResult.parsedSummary.extractedFields.length > 0 && (
                  <div className="text-[11px] text-slate-600 font-medium pt-1">
                    <span className="font-bold text-slate-700">Field Terdeteksi: </span>
                    <span>{parseResult.parsedSummary.extractedFields.join(', ')}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* PREVIEW JIKA BERKAS PDF */}
            {selectedFile && selectedFile.name.endsWith('.pdf') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{selectedFile.name}</div>
                    <div className="text-[11px] text-slate-500">Berkas PDF Service Report siap dilampirkan langsung ke dokumen arsip</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Batal</span>
                </button>
              </motion.div>
            )}

            {/* CALLOUT PENJELASAN */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-xs text-blue-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Setelah disimpan, dokumen ini akan otomatis berubah status menjadi <strong>Foto + SR Lengkap</strong>. Saat di-download, hasil ekspor PDF akan menggabungkan Service Report resmi dengan seluruh foto dokumentasi yang telah ada.
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedFile || isSaving || isParsing}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  <span>Simpan & Terapkan SR</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
