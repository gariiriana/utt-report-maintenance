import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar, FileText, FileSpreadsheet,
  Plus, Trash2, Search, RefreshCw,
  Folder, ChevronLeft, Pencil,
  Camera, X, Save, Users, Building2, MessageSquare
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

// ─── Interfaces ───
interface InductionRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  perusahaan: string;
  foto: string; // base64 compressed photo
  remark: string;
}

// ─── Helper Functions ───
const getIndonesianMonthYear = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return dateStr;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${monthNames[monthIdx]} ${parts[0]}`;
};

const formatIndonesianDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${parts[2]} ${monthNames[monthIdx]} ${parts[0]}`;
};

const compressImage = (file: File | Blob, maxSize = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve('');
    };
    reader.onerror = () => resolve('');
  });
};

// ─── Main Component ───
export function AbsenInduction() {
  // Data state
  const [allRecords, setAllRecords] = useState<InductionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Folder navigation
  const [viewLevel, setViewLevel] = useState<'month' | 'date' | 'records'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Checklist (input rows) — no foto per person
  const [checklist, setChecklist] = useState<Array<{
    nama: string;
    perusahaan: string;
    remark: string;
  }>>([{ nama: '', perusahaan: '', remark: '' }]);

  // Single activity photo for the induction event
  const [activityPhoto, setActivityPhoto] = useState<string>('');

  // Inline edit state for existing records
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editedNama, setEditedNama] = useState('');
  const [editedPerusahaan, setEditedPerusahaan] = useState('');
  const [editedRemark, setEditedRemark] = useState('');

  // Photo preview modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // File input ref for activity photo
  const activityPhotoRef = useRef<HTMLInputElement | null>(null);

  // ─── Firestore Realtime Listener ───
  useEffect(() => {
    const q = query(collection(db, 'absen_induction'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: InductionRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Skip legacy personnel definitions or documentation records
        if (data.isPersonnel || data.isDocumentation) return;
        records.push({
          id: docSnap.id,
          tanggal: data.tanggal || '',
          nama: data.nama || '',
          perusahaan: data.perusahaan || data.jabatan || '',
          foto: data.foto || '',
          remark: data.remark || '',
        });
      });
      records.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      setAllRecords(records);
      setLoading(false);
    }, (error) => {
      console.error("Firestore listener failed:", error);
      toast.error("Gagal sinkronisasi data real-time");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ─── Filtered Records ───
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      const matchDate = (!startDate || rec.tanggal >= startDate) && (!endDate || rec.tanggal <= endDate);
      const term = searchTerm.toLowerCase();
      const matchText = rec.nama.toLowerCase().includes(term) ||
                        rec.perusahaan.toLowerCase().includes(term) ||
                        rec.remark.toLowerCase().includes(term);
      return matchDate && matchText;
    });
  }, [allRecords, startDate, endDate, searchTerm]);

  // ─── Statistics ───
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const uniqueDates = new Set(filteredRecords.map(r => r.tanggal)).size;
    const uniqueCompanies = new Set(filteredRecords.map(r => r.perusahaan).filter(Boolean)).size;

    // Group by date for chart
    const dateGroups: Record<string, number> = {};
    filteredRecords.forEach(r => {
      dateGroups[r.tanggal] = (dateGroups[r.tanggal] || 0) + 1;
    });
    const chartData = Object.entries(dateGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, count]) => ({ tanggal, count }));

    return { total, uniqueDates, uniqueCompanies, chartData };
  }, [filteredRecords]);

  // ─── Folder Navigation Data ───
  const monthFolders = useMemo(() => {
    const months: Record<string, { count: number; dates: Set<string> }> = {};
    filteredRecords.forEach(rec => {
      const monthKey = rec.tanggal.substring(0, 7); // YYYY-MM
      if (!months[monthKey]) months[monthKey] = { count: 0, dates: new Set() };
      months[monthKey].count++;
      months[monthKey].dates.add(rec.tanggal);
    });
    return Object.entries(months)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => ({ key, label: getIndonesianMonthYear(key + '-01'), count: val.count, dateCount: val.dates.size }));
  }, [filteredRecords]);

  const dateFolders = useMemo(() => {
    if (!selectedMonth) return [];
    const dates: Record<string, number> = {};
    filteredRecords.forEach(rec => {
      if (rec.tanggal.startsWith(selectedMonth)) {
        dates[rec.tanggal] = (dates[rec.tanggal] || 0) + 1;
      }
    });
    return Object.entries(dates)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, count]) => ({ date, label: formatIndonesianDate(date), count }));
  }, [filteredRecords, selectedMonth]);

  const dateRecords = useMemo(() => {
    if (!selectedDate) return [];
    return filteredRecords.filter(r => r.tanggal === selectedDate);
  }, [filteredRecords, selectedDate]);

  // ─── Checklist Actions ───
  const updateChecklistItem = (index: number, key: keyof typeof checklist[0], value: string) => {
    setChecklist(prev => prev.map((item, idx) => idx === index ? { ...item, [key]: value } : item));
  };

  const addRow = () => {
    setChecklist(prev => [...prev, { nama: '', perusahaan: '', remark: '' }]);
  };

  const removeRow = (index: number) => {
    setChecklist(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleActivityPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    const compressed = await compressImage(file);
    if (compressed) {
      setActivityPhoto(compressed);
    }
    setIsCompressing(false);
    e.target.value = '';
  };

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = checklist.filter(item => item.nama.trim());
    if (validRows.length === 0) {
      toast.error("Minimal satu baris harus memiliki Nama");
      return;
    }

    setIsSubmitting(true);
    try {
      const batchPromises = validRows.map(item =>
        addDoc(collection(db, 'absen_induction'), {
          tanggal: formDate,
          nama: item.nama.trim(),
          perusahaan: item.perusahaan.trim(),
          foto: activityPhoto,
          remark: item.remark.trim(),
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(batchPromises);
      toast.success(`Berhasil menyimpan ${validRows.length} data induction!`);

      // Auto-expand date filter range if the submitted date is outside the current range
      if (formDate > endDate) {
        setEndDate(formDate);
      }
      if (formDate < startDate) {
        setStartDate(formDate);
      }

      // Reset
      setChecklist([{ nama: '', perusahaan: '', remark: '' }]);
      setActivityPhoto('');
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Gagal menyimpan data: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Inline Edit ───
  const startEditing = (rec: InductionRecord) => {
    setEditingRecordId(rec.id);
    setEditedNama(rec.nama);
    setEditedPerusahaan(rec.perusahaan);
    setEditedRemark(rec.remark);
  };

  const handleUpdateRecord = async (id: string) => {
    if (!editedNama.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }
    try {
      await updateDoc(doc(db, 'absen_induction', id), {
        nama: editedNama.trim(),
        perusahaan: editedPerusahaan.trim(),
        remark: editedRemark.trim()
      });
      toast.success("Data berhasil diperbarui!");
      setEditingRecordId(null);
    } catch (err: any) {
      toast.error("Gagal memperbarui data: " + err.message);
    }
  };

  // ─── Delete ───
  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      await deleteDoc(doc(db, 'absen_induction', id));
      toast.success("Data berhasil dihapus");
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    }
  };

  const handleDeleteEntireDate = (dateStr: string) => {
    setDateToDelete(dateStr);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteDate = async (dateStr: string) => {
    try {
      const toDelete = allRecords.filter(r => r.tanggal === dateStr);
      await Promise.all(toDelete.map(r => deleteDoc(doc(db, 'absen_induction', r.id))));
      toast.success(`Berhasil menghapus seluruh data tanggal ${formatIndonesianDate(dateStr)}!`);
      if (selectedDate === dateStr) {
        setSelectedDate(null);
        setViewLevel('date');
      }
    } catch (err: any) {
      toast.error("Gagal menghapus data: " + err.message);
    }
  };

  // ─── Export Excel ───
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Absen Induction');

    // Header
    ws.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Tanggal', key: 'tanggal', width: 18 },
      { header: 'Nama', key: 'nama', width: 30 },
      { header: 'Perusahaan', key: 'perusahaan', width: 25 },
      { header: 'Remark', key: 'remark', width: 30 },
    ];

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00599C' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    // Data rows
    filteredRecords.forEach((rec, idx) => {
      ws.addRow({
        no: idx + 1,
        tanggal: formatIndonesianDate(rec.tanggal),
        nama: rec.nama,
        perusahaan: rec.perusahaan,
        remark: rec.remark,
      });
    });

    // Borders
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Kumpulkan foto unik per tanggal
    const datePhotos: { tanggal: string; foto: string }[] = [];
    const seenDates = new Set<string>();
    filteredRecords.forEach(rec => {      if (rec.foto && !seenDates.has(rec.tanggal)) {
        seenDates.add(rec.tanggal);
        datePhotos.push({ tanggal: rec.tanggal, foto: rec.foto });
      }
    });

    if (datePhotos.length > 0) {
      ws.addRow([]);
      ws.addRow([]);
      const titleRow = ws.addRow(['DOKUMENTASI FOTO KEGIATAN INDUCTION']);
      titleRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF00599C' } };
      ws.addRow([]);

      let startRow = filteredRecords.length + 5; // Baris setelah tabel + gap

      for (const item of datePhotos) {
        ws.getRow(startRow).getCell(1).value = `Foto Kegiatan - ${formatIndonesianDate(item.tanggal)}`;
        ws.getRow(startRow).getCell(1).font = { bold: true, size: 9 };
        
        try {
          const imgId = wb.addImage({
            base64: item.foto,
            extension: 'jpeg',
          });
          
          ws.addImage(imgId, {
            tl: { col: 0, row: startRow },
            ext: { width: 320, height: 180 }
          });
          startRow += 11; // beri jarak vertikal untuk gambar
        } catch (e) {
          console.error("Gagal export foto ke Excel:", e);
          startRow += 2;
        }
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Absen_Induction_${startDate}_${endDate}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File Excel berhasil diunduh!");
  };

  // ─── Export PDF ───
  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageWidth - 2 * margin;

    // Top stripe
    docPdf.setFillColor(0, 89, 156);
    docPdf.rect(0, 0, pageWidth, 2.5, 'F');

    // Header
    const headerH = 22;
    const headerY = 6;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.1);
    docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    const col1W = 35;
    const col3W = 35;
    docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) { console.error(e); }

    if (leftLogoBase64) {
      docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
    }
    if (rightLogoBase64) {
      docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
    docPdf.text('LAPORAN ABSENSI INDUCTION', centerX, headerY + 6.5, { align: 'center' });

    docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
    docPdf.text('PT DWIMITRA EKATAMA MANDIRI', centerX, headerY + 11.5, { align: 'center' });

    docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
    docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
    docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

    // Summary
    let y = headerY + headerH + 5;
    docPdf.setFillColor(248, 250, 252);
    docPdf.roundedRect(margin, y, contentW, 18, 1.5, 1.5, 'F');
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.15);
    docPdf.roundedRect(margin, y, contentW, 18, 1.5, 1.5, 'D');

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9.5).setFont('helvetica', 'bold');
    docPdf.text('RINGKASAN', margin + 6, y + 7);
    docPdf.setFontSize(8).setFont('helvetica', 'normal').setTextColor(71, 85, 105);
    docPdf.text(`Total Peserta: ${stats.total}  |  Perusahaan: ${stats.uniqueCompanies}`, margin + 6, y + 14);

    y += 23;

    // Table
    const tableData = filteredRecords.map((rec, idx) => [
      idx + 1,
      formatIndonesianDate(rec.tanggal),
      rec.nama,
      rec.perusahaan,
      rec.remark
    ]);

    autoTable(docPdf, {
      startY: y,
      head: [['No', 'Tanggal', 'Nama', 'Perusahaan', 'Remark']],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 89, 156], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    // Kumpulkan foto unik per tanggal
    const datePhotos: { tanggal: string; foto: string }[] = [];
    const seenDates = new Set<string>();
    filteredRecords.forEach(rec => {
      if (rec.foto && !seenDates.has(rec.tanggal)) {
        seenDates.add(rec.tanggal);
        datePhotos.push({ tanggal: rec.tanggal, foto: rec.foto });
      }
    });

    if (datePhotos.length > 0) {
      docPdf.addPage();
      
      // Header Halaman Dokumentasi
      docPdf.setFillColor(0, 89, 156);
      docPdf.rect(0, 0, pageWidth, 2.5, 'F');
      
      docPdf.setDrawColor(226, 232, 240);
      docPdf.setLineWidth(0.1);
      docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');
      docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
      docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

      if (leftLogoBase64) {
        docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
      }
      if (rightLogoBase64) {
        docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
      }

      docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
      docPdf.text('DOKUMENTASI FOTO KEGIATAN INDUCTION', centerX, headerY + 6.5, { align: 'center' });

      docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
      docPdf.text('PT DWIMITRA EKATAMA MANDIRI', centerX, headerY + 11.5, { align: 'center' });

      docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
      docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
      docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

      let imgY = headerY + headerH + 12;
      
      datePhotos.forEach((item, idx) => {
        const isLeft = idx % 2 === 0;
        const colW = (contentW - 6) / 2;
        const imgX = isLeft ? margin : margin + colW + 6;
        
        if (!isLeft && idx > 0) {
          // No shift on Y
        } else if (idx > 0) {
          imgY += 62; // Tinggi baris foto + label + gap
        }

        if (imgY + 55 > docPdf.internal.pageSize.getHeight() - margin) {
          docPdf.addPage();
          docPdf.setFillColor(0, 89, 156);
          docPdf.rect(0, 0, pageWidth, 2.5, 'F');
          imgY = 15;
        }

        docPdf.setFontSize(8).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
        docPdf.text(`Foto Kegiatan - ${formatIndonesianDate(item.tanggal)}`, imgX, imgY - 2);

        docPdf.setDrawColor(200, 200, 200);
        docPdf.setLineWidth(0.15);
        docPdf.roundedRect(imgX, imgY, colW, 45, 1, 1, 'D');

        try {
          docPdf.addImage(item.foto, 'JPEG', imgX + 1, imgY + 1, colW - 2, 43, undefined, 'FAST');
        } catch (e) {
          console.error("Gagal export foto ke PDF:", e);
        }
      });
    }

    docPdf.save(`Absen_Induction_${startDate}_${endDate}.pdf`);
    toast.success("File PDF berhasil diunduh!");
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-blue-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20">
              <Users className="w-6 h-6 text-white" />
            </div>
            Absen Induction
          </h2>
          <p className="text-slate-400 text-sm mt-1">Input dan kelola data absensi induction</p>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <FileText className="w-4 h-4" /> PDF
          </motion.button>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Peserta</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{stats.uniqueDates}</p>
              <p className="text-xs text-slate-400">Jumlah Hari</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{stats.uniqueCompanies}</p>
              <p className="text-xs text-slate-400">Perusahaan</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Grid: Input Form + Data Browser ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── LEFT: Input Form ─── */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-b border-slate-800/50">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Input Data Induction
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tanggal</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                title="Tanggal"
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Checklist Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Data Peserta</label>
                <button
                  type="button"
                  onClick={addRow}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tambah Baris
                </button>
              </div>

              {checklist.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-400">#{idx + 1}</span>
                    {checklist.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-400/60 hover:text-red-400 transition-colors"
                        title="Hapus baris"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Nama */}
                  <input
                    type="text"
                    value={item.nama}
                    onChange={e => updateChecklistItem(idx, 'nama', e.target.value)}
                    placeholder="Nama..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />

                  {/* Perusahaan */}
                  <input
                    type="text"
                    value={item.perusahaan}
                    onChange={e => updateChecklistItem(idx, 'perusahaan', e.target.value)}
                    placeholder="Perusahaan..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />

                  {/* Remark */}
                  <input
                    type="text"
                    value={item.remark}
                    onChange={e => updateChecklistItem(idx, 'remark', e.target.value)}
                    placeholder="Remark / Keterangan..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/40 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 transition-all"
                  />
                </motion.div>
              ))}
            </div>

            {/* ─── Foto Kegiatan Induction ─── */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Camera className="w-3 h-3" /> Foto Kegiatan Induction
              </label>
              <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
                <input
                  ref={activityPhotoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleActivityPhotoUpload}
                  title="Upload Foto Kegiatan"
                  className="hidden"
                />
                {activityPhoto ? (
                  <div className="space-y-2">
                    <div className="relative group inline-block">
                      <img
                        src={activityPhoto}
                        alt="Foto kegiatan induction"
                        className="w-full max-h-48 rounded-lg object-cover border border-slate-700/50 cursor-pointer"
                        onClick={() => setPreviewPhoto(activityPhoto)}
                      />
                      <button
                        type="button"
                        onClick={() => setActivityPhoto('')}
                        title="Hapus foto"
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => activityPhotoRef.current?.click()}
                      className="w-full px-3 py-1.5 bg-slate-900/50 border border-slate-700/40 rounded-lg text-[10px] text-slate-400 hover:text-blue-400 hover:border-blue-500/30 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Camera className="w-3 h-3" /> Ganti Foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => activityPhotoRef.current?.click()}
                    className="w-full px-3 py-2.5 bg-slate-900/50 border border-dashed border-slate-600/50 rounded-lg text-xs text-slate-400 hover:text-blue-400 hover:border-blue-500/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <Camera className="w-4 h-4" /> Ambil / Upload Foto Kegiatan
                  </button>
                )}
              </div>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : isCompressing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Kompresi foto...</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan Data Induction</>
              )}
            </motion.button>
          </form>
        </div>

        {/* ─── RIGHT: Data Browser ─── */}
        <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl overflow-hidden">
          {/* Browser Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-800/60 to-slate-800/30 border-b border-slate-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewLevel !== 'month' && (
                  <button
                    onClick={() => {
                      if (viewLevel === 'records') {
                        setSelectedDate(null);
                        setViewLevel('date');
                      } else {
                        setSelectedMonth(null);
                        setViewLevel('month');
                      }
                    }}
                    title="Kembali"
                    className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-400" />
                  {viewLevel === 'month' && 'Arsip Bulanan'}
                  {viewLevel === 'date' && (selectedMonth ? getIndonesianMonthYear(selectedMonth + '-01') : '')}
                  {viewLevel === 'records' && (selectedDate ? formatIndonesianDate(selectedDate) : '')}
                </h3>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Cari..."
                    className="pl-7 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white w-28 focus:outline-none focus:ring-1 focus:ring-teal-500/40 placeholder:text-slate-600 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-2 mt-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title="Tanggal Mulai"
                className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all"
              />
              <span className="text-[10px] text-slate-500">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title="Tanggal Selesai"
                className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all"
              />
            </div>
          </div>

          {/* Browser Content */}
          <div className="p-4 max-h-[600px] overflow-y-auto space-y-2 custom-scrollbar">
            {/* Month folders */}
            {viewLevel === 'month' && (
              monthFolders.length === 0 ? (
                <div className="text-center py-12">
                  <Folder className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Belum ada data induction</p>
                </div>
              ) : (
                monthFolders.map(folder => (
                  <motion.button
                    key={folder.key}
                    whileHover={{ x: 4 }}
                    onClick={() => {
                      setSelectedMonth(folder.key);
                      setViewLevel('date');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/20 hover:border-teal-500/20 rounded-xl transition-all group"
                  >
                    <Folder className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-white">{folder.label}</p>
                      <p className="text-[10px] text-slate-500">{folder.dateCount} hari · {folder.count} peserta</p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180" />
                  </motion.button>
                ))
              )
            )}

            {/* Date folders */}
            {viewLevel === 'date' && (
              dateFolders.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Tidak ada data di bulan ini</p>
                </div>
              ) : (
                dateFolders.map(folder => (
                  <div key={folder.date} className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ x: 4 }}
                      onClick={() => {
                        setSelectedDate(folder.date);
                        setViewLevel('records');
                      }}
                      className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/20 hover:border-teal-500/20 rounded-xl transition-all group"
                    >
                      <Calendar className="w-5 h-5 text-teal-400 group-hover:text-teal-300" />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-bold text-white">{folder.label}</p>
                        <p className="text-[10px] text-slate-500">{folder.count} peserta</p>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180" />
                    </motion.button>
                    <button
                      onClick={() => handleDeleteEntireDate(folder.date)}
                      className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Hapus semua data tanggal ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )
            )}

            {/* Individual records */}
            {viewLevel === 'records' && (
              dateRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Tidak ada data untuk tanggal ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dateRecords.map((rec, idx) => (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-3 group"
                    >
                      {editingRecordId === rec.id ? (
                        /* Edit mode */
                        <div className="space-y-2">
                          <input
                            value={editedNama}
                            onChange={e => setEditedNama(e.target.value)}
                            placeholder="Nama..."
                            className="w-full px-3 py-1.5 bg-slate-900/50 border border-teal-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                          />
                          <input
                            value={editedPerusahaan}
                            onChange={e => setEditedPerusahaan(e.target.value)}
                            placeholder="Perusahaan..."
                            className="w-full px-3 py-1.5 bg-slate-900/50 border border-teal-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                          />
                          <input
                            value={editedRemark}
                            onChange={e => setEditedRemark(e.target.value)}
                            placeholder="Remark..."
                            className="w-full px-3 py-1.5 bg-slate-900/50 border border-teal-500/30 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500/40"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateRecord(rec.id)}
                              className="flex-1 py-1.5 bg-teal-600/80 hover:bg-teal-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                            >
                              <Save className="w-3 h-3" /> Simpan
                            </button>
                            <button
                              onClick={() => setEditingRecordId(null)}
                              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition-all"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-start gap-3">
                          {/* Photo */}
                          {rec.foto ? (
                            <img
                              src={rec.foto}
                              alt={rec.nama}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-700/50 cursor-pointer hover:border-teal-500/50 flex-shrink-0 transition-all"
                              onClick={() => setPreviewPhoto(rec.foto)}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-slate-600" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{rec.nama || '-'}</p>
                            <p className="text-[10px] text-teal-400 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {rec.perusahaan || '-'}
                            </p>
                            {rec.remark && (
                              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {rec.remark}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => startEditing(rec)}
                              className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-teal-400 transition-all"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(rec.id)}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ─── Delete Date Confirmation Modal ─── */}
      <AnimatePresence>
        {deleteConfirmOpen && dateToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setDeleteConfirmOpen(false); setDateToDelete(null); }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-slate-900 border border-red-500/30 rounded-2xl p-6 z-[110] shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white mb-2">Hapus Data Tanggal</h3>
              <p className="text-sm text-slate-400 mb-4">
                Apakah Anda yakin ingin menghapus <span className="text-red-400 font-bold">seluruh data</span> pada tanggal{' '}
                <span className="text-white font-bold">{formatIndonesianDate(dateToDelete)}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteConfirmOpen(false); setDateToDelete(null); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    executeDeleteDate(dateToDelete);
                    setDeleteConfirmOpen(false);
                    setDateToDelete(null);
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  Hapus Semua
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Photo Preview Modal ─── */}
      <AnimatePresence>
        {previewPhoto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPhoto(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] max-w-[90vw] max-h-[90vh]"
            >
              <button
                onClick={() => setPreviewPhoto(null)}
                title="Tutup"
                className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full border border-slate-700 text-white hover:bg-slate-700 transition-all z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={previewPhoto}
                alt="Preview"
                className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain border border-slate-700/50 shadow-2xl"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
