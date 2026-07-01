import { useState, useEffect, useMemo, Fragment, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, FileText, FileSpreadsheet,
  Plus, Trash2, Search, RefreshCw,
  TrendingUp, CheckCircle, XCircle
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/api/firebase';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';
import { loadLogoBase64 } from '@/utils/ReportPdfExport';

interface AttendanceRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  nama: string;
  kehadiran: 'Hadir' | 'Tidak Hadir';
  jabatan: string;
  remark: string;
}

const TBM_LISTS: Record<'UTT Daily' | 'UTT Mobile' | 'DME', Array<{ nama: string; jabatan: string }>> = {
  'UTT Daily': [
    { nama: 'ACEP FAAIZANIE KARIM MULYADI', jabatan: 'Teknisi' },
    { nama: 'TONGGO SIJABAT', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD RAMADHAN', jabatan: 'Teknisi' },
    { nama: 'GARI IRIANA', jabatan: 'Teknisi' },
    { nama: 'ADI SETIAWAN', jabatan: 'Teknisi' },
    { nama: 'HESTI MUJI', jabatan: 'Admin' },
    { nama: 'AULIA GUSLIANA', jabatan: 'Admin' },
    { nama: 'MAMIEK SLAMET SUGIYANTO', jabatan: 'Teknisi' },
    { nama: 'TUGINO', jabatan: 'Teknisi' },
    { nama: 'ASEP MUHAMMAD FAUZI', jabatan: 'Shift Engineer' },
    { nama: 'FERY HALASSON S', jabatan: 'Teknisi' },
    { nama: 'PETRA N.B WARBANARAN', jabatan: 'Teknisi' },
    { nama: 'ARIF BUDIMAN', jabatan: 'Project Manager' },
    { nama: 'IFRIADI', jabatan: 'Teknisi' },
    { nama: 'IMRON', jabatan: 'Teknisi' },
    { nama: 'AGUNG SETYABUDI', jabatan: 'Teknisi' },
    { nama: 'AGIL ZAKIA RAHMAN', jabatan: 'Shift Engineer' },
    { nama: 'MUHAMMAD SALMAN ABDUROHMAN', jabatan: 'Shift Engineer' },
    { nama: 'BUDI PURWO DARSONO', jabatan: 'Teknisi' },
    { nama: 'DISON MINTUNO ANDARBENI', jabatan: 'Shift Engineer' },
    { nama: 'NUGROHO GILANG RAMADHAN', jabatan: 'Shift Engineer' },
    { nama: 'RIYAN BUDI NUGROHO', jabatan: 'Teknisi' },
    { nama: 'TOPIK HIDAYAT', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD NISKA LEGIANA', jabatan: 'Teknisi' },
    { nama: 'HENDRI KUSUMA WIJAYA', jabatan: 'Teknisi' },
  ],
  'UTT Mobile': [
    { nama: 'TAUFIK HIDAYATULLOH', jabatan: 'Project Koordinator' },
    { nama: 'EKO WAHYONO', jabatan: 'Teknisi' },
    { nama: 'EKO WALUYO', jabatan: 'Teknisi' },
    { nama: 'SULARDI', jabatan: 'Teknisi' },
    { nama: 'AGUS SAPUTRA', jabatan: 'Teknisi' },
    { nama: 'INDRA MULYADI', jabatan: 'Teknisi' },
    { nama: 'SURYADI', jabatan: 'Teknisi' },
    { nama: 'SUKANWAR', jabatan: 'Teknisi' },
    { nama: 'ROFIQ ROSYADI', jabatan: 'Teknisi' },
    { nama: 'MUHTAS', jabatan: 'Teknisi' },
    { nama: 'RAHMAT ARIEF', jabatan: 'Teknisi' },
  ],
  'DME': [
    { nama: 'WAHYUDI MURSAL', jabatan: 'Teknisi' },
    { nama: 'DWI TASMIYADI', jabatan: 'Project Manager' },
    { nama: 'JOHAN', jabatan: 'Co Pm' },
    { nama: 'RIZKI NOVRI YANDA', jabatan: 'Teknisi' },
    { nama: 'MUHAMMAD RIFALDI', jabatan: 'Teknisi' },
    { nama: 'SANDI RIANTORO KHOTIADI', jabatan: 'Teknisi' },
  ]
};

export function AbsenTBM() {
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to first day of current month
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<'Semua' | 'UTT Daily' | 'UTT Mobile' | 'DME' | 'Manual'>('Semua');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checklist state for the active team
  const [checklist, setChecklist] = useState<Array<{
    nama: string;
    jabatan: string;
    kehadiran: 'Hadir' | 'Tidak Hadir';
    remark: string;
    category?: string;
  }>>([]);

  // Auto-fill checklist when Category changes
  useEffect(() => {
    if (formCategory === 'Semua') {
      const combined = [
        ...TBM_LISTS['UTT Daily'].map(e => ({ ...e, category: 'UTT Daily' })),
        ...TBM_LISTS['UTT Mobile'].map(e => ({ ...e, category: 'UTT Mobile' })),
        ...TBM_LISTS['DME'].map(e => ({ ...e, category: 'DME' }))
      ];
      setChecklist(combined.map(e => ({
        nama: e.nama,
        jabatan: e.jabatan,
        category: e.category,
        kehadiran: 'Hadir',
        remark: ''
      })));
    } else if (formCategory !== 'Manual') {
      const list = TBM_LISTS[formCategory];
      setChecklist(list.map(e => ({
        nama: e.nama,
        jabatan: e.jabatan,
        category: formCategory,
        kehadiran: 'Hadir',
        remark: ''
      })));
    } else {
      setChecklist([{
        nama: '',
        jabatan: '',
        category: 'Manual',
        kehadiran: 'Hadir',
        remark: ''
      }]);
    }
  }, [formCategory]);


  const updateChecklistItem = (index: number, key: 'kehadiran' | 'remark' | 'nama' | 'jabatan', value: any) => {
    setChecklist(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [key]: value };
      }
      return item;
    }));
  };

  const addManualRow = () => {
    setChecklist(prev => [...prev, {
      nama: '',
      jabatan: '',
      kehadiran: 'Hadir',
      remark: ''
    }]);
  };

  const removeManualRow = (index: number) => {
    setChecklist(prev => prev.filter((_, idx) => idx !== index));
  };

  // Firestore Realtime Listener
  useEffect(() => {
    const q = query(collection(db, 'absen_tbm'), orderBy('tanggal', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          tanggal: data.tanggal || '',
          nama: data.nama || '',
          kehadiran: data.kehadiran || 'Hadir',
          jabatan: data.jabatan || '',
          remark: data.remark || '',
        });
      });
      setAllRecords(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore listener failed:", error);
      toast.error("Gagal sinkronisasi data real-time");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return allRecords.filter(rec => {
      const matchDate = (!startDate || rec.tanggal >= startDate) && (!endDate || rec.tanggal <= endDate);
      const matchText = rec.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.jabatan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        rec.remark.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchText;
    });
  }, [allRecords, startDate, endDate, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    let total = filteredRecords.length;
    let hadir = filteredRecords.filter(r => r.kehadiran === 'Hadir').length;
    let tidakHadir = total - hadir;
    let rate = total > 0 ? Math.round((hadir / total) * 100) : 0;
    
    // Group by Date for Bar Chart
    const dateGroups: Record<string, { tanggal: string; Hadir: number; 'Tidak Hadir': number }> = {};
    filteredRecords.forEach(r => {
      if (!dateGroups[r.tanggal]) {
        dateGroups[r.tanggal] = { tanggal: r.tanggal, Hadir: 0, 'Tidak Hadir': 0 };
      }
      if (r.kehadiran === 'Hadir') {
        dateGroups[r.tanggal].Hadir += 1;
      } else {
        dateGroups[r.tanggal]['Tidak Hadir'] += 1;
      }
    });

    const chartData = Object.values(dateGroups).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    // Ratio Data for Pie Chart
    const pieData = [
      { name: 'Hadir', value: hadir, color: '#10b981' },
      { name: 'Tidak Hadir', value: tidakHadir, color: '#f43f5e' }
    ];

    return { total, hadir, tidakHadir, rate, chartData, pieData };
  }, [filteredRecords]);

  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.style.width = `${stats.rate}%`;
    }
  }, [stats.rate]);

  // Handle Add Record
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = checklist.some(item => !item.nama.trim() || !item.jabatan.trim());
    if (invalid) {
      toast.error("Semua baris harus memiliki Nama dan Jabatan");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save all checklist items to Firestore
      const batchPromises = checklist.map(item => 
        addDoc(collection(db, 'absen_tbm'), {
          tanggal: formDate,
          nama: item.nama.trim(),
          kehadiran: item.kehadiran,
          jabatan: item.jabatan.trim(),
          remark: item.remark.trim(),
          category: item.category || formCategory,
          createdAt: serverTimestamp()
        })
      );
      await Promise.all(batchPromises);
      
      toast.success(`Berhasil menyimpan absensi ${checklist.length} karyawan!`);
      // Reset remarks
      setChecklist(prev => prev.map(item => ({ ...item, remark: '', kehadiran: 'Hadir' })));
    } catch (err: any) {
      console.error("Save checklist error:", err);
      toast.error("Gagal menyimpan absensi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Record
  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus catatan absen ini?")) return;
    try {
      await deleteDoc(doc(db, 'absen_tbm', id));
      toast.success("Absen berhasil dihapus");
    } catch (err: any) {
      console.error("Delete record error:", err);
      toast.error("Gagal menghapus absen: " + err.message);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const docPdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = docPdf.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageWidth - 2 * margin;

    // Draw blue stripe at the very top edge
    docPdf.setFillColor(0, 89, 156);
    docPdf.rect(0, 0, pageWidth, 2.5, 'F');

    // Header box (rounded border)
    const headerH = 22;
    const headerY = 6;
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.1);
    docPdf.roundedRect(margin, headerY, contentW, headerH, 1, 1, 'D');

    // Separators
    const col1W = 35;
    const col3W = 35;
    docPdf.line(margin + col1W, headerY, margin + col1W, headerY + headerH);
    docPdf.line(pageWidth - margin - col3W, headerY, pageWidth - margin - col3W, headerY + headerH);

    // Load Logos
    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) {
      console.error(e);
    }

    if (leftLogoBase64) {
      docPdf.addImage(leftLogoBase64, 'JPEG', margin + 3, headerY + 4, col1W - 6, 14, undefined, 'FAST');
    }
    if (rightLogoBase64) {
      docPdf.addImage(rightLogoBase64, 'JPEG', pageWidth - margin - col3W + 5, headerY + 5.5, col3W - 10, 11, undefined, 'FAST');
    }

    const centerX = margin + col1W + (contentW - col1W - col3W) / 2;
    docPdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0, 89, 156);
    docPdf.text('LAPORAN KEHADIRAN ABSENSI TBM', centerX, headerY + 6.5, { align: 'center' });

    docPdf.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(30, 30, 30);
    docPdf.text('PT UNITED TRANSWORLD TRADING', centerX, headerY + 11.5, { align: 'center' });

    docPdf.setFontSize(7).setFont('helvetica', 'normal').setTextColor(100, 100, 100);
    docPdf.text(`Periode: ${startDate || '-'} s.d. ${endDate || '-'}`, centerX, headerY + 16, { align: 'center' });
    docPdf.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, centerX, headerY + 20, { align: 'center' });

    // Summary Card
    let y = headerY + headerH + 5;
    docPdf.setFillColor(248, 250, 252); // Slate-50
    docPdf.rect(margin, y, contentW, 28, 'F');
    docPdf.setDrawColor(226, 232, 240); // Slate-200
    docPdf.rect(margin, y, contentW, 28, 'D');

    docPdf.setTextColor(15, 23, 42); // Slate-900
    docPdf.setFontSize(10);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('RINGKASAN STATISTIK KEHADIRAN', margin + 5, y + 6);

    docPdf.setFontSize(8);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(`Total Log Kehadiran: ${stats.total} record`, margin + 5, y + 14);
    docPdf.text(`Hadir: ${stats.hadir} kali | Tidak Hadir: ${stats.tidakHadir} kali`, margin + 5, y + 21);
    docPdf.text(`Persentase Kehadiran (Attendance Rate): ${stats.rate}%`, margin + 95, y + 14);

    // Visual Percentage Bar
    docPdf.setFillColor(244, 63, 94); // Red
    docPdf.rect(margin + 95, y + 18, 75, 4, 'F');
    if (stats.rate > 0) {
      docPdf.setFillColor(16, 185, 129); // Green
      docPdf.rect(margin + 95, y + 18, (stats.rate / 100) * 75, 4, 'F');
    }

    // ─── Draw Daily Attendance Bar Chart ──────────────────────────
    let chartY = y + 32;
    docPdf.setFillColor(248, 250, 252);
    docPdf.rect(margin, chartY, contentW, 40, 'F');
    docPdf.setDrawColor(226, 232, 240);
    docPdf.rect(margin, chartY, contentW, 40, 'D');

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('GRAFIK HARIAN KEHADIRAN (Hadir vs Tidak Hadir)', margin + 5, chartY + 6);

    const chartW = contentW - 20;
    const chartH = 22;
    const startX = margin + 10;
    const startY = chartY + 34;

    // Draw axis lines
    docPdf.setDrawColor(148, 163, 184);
    docPdf.setLineWidth(0.2);
    docPdf.line(startX, startY, startX + chartW, startY); // X axis
    docPdf.line(startX, startY, startX, startY - chartH); // Y axis

    const daysCount = stats.chartData.length;
    if (daysCount > 0) {
      // Find max attendance value to scale chart height
      let maxVal = 1;
      stats.chartData.forEach(d => {
        if (d.Hadir > maxVal) maxVal = d.Hadir;
        if (d['Tidak Hadir'] > maxVal) maxVal = d['Tidak Hadir'];
      });

      const colW = chartW / daysCount;
      stats.chartData.forEach((day, idx) => {
        const dx = startX + idx * colW + 2;
        const limitW = Math.max(2, (colW - 4) / 2);

        // Hadir Bar (Green)
        if (day.Hadir > 0) {
          const barH = (day.Hadir / maxVal) * (chartH - 4);
          docPdf.setFillColor(16, 185, 129);
          docPdf.rect(dx, startY - barH, limitW, barH, 'F');
        }

        // Tidak Hadir Bar (Red)
        if (day['Tidak Hadir'] > 0) {
          const barH = (day['Tidak Hadir'] / maxVal) * (chartH - 4);
          docPdf.setFillColor(244, 63, 94);
          docPdf.rect(dx + limitW + 1, startY - barH, limitW, barH, 'F');
        }

        // Label Tanggal (simple formatting DD/MM)
        docPdf.setTextColor(100, 116, 139);
        docPdf.setFontSize(6);
        try {
          const parts = day.tanggal.split('-');
          const dateLabel = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : day.tanggal;
          docPdf.text(dateLabel, dx + colW / 4, startY + 4, { align: 'center' });
        } catch(e) {}
      });
    }

    // Auto Table
    const tableData = filteredRecords.map((r, i) => [
      i + 1,
      r.tanggal,
      r.nama,
      r.jabatan,
      r.kehadiran,
      r.remark || '-'
    ]);

    (docPdf as any).autoTable({
      startY: chartY + 46,
      head: [['No', 'Tanggal', 'Nama', 'Jabatan', 'Status Kehadiran', 'Keterangan']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [0, 89, 156], halign: 'left' }, // Theme Blue matching the stripe
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30 },
        5: { cellWidth: contentW - 150 }
      },
      styles: { fontSize: 8.5 }
    });

    docPdf.save(`Laporan_Absen_TBM_${startDate || 'all'}_to_${endDate || 'all'}.pdf`);
    toast.success("PDF Laporan Absen TBM berhasil diunduh!");
  };

  // Export Excel
  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absensi TBM');

    // Load Logos
    let leftLogoBase64 = '';
    let rightLogoBase64 = '';
    try {
      leftLogoBase64 = await loadLogoBase64(logoDwimitra);
      rightLogoBase64 = await loadLogoBase64(logoNeutraDC);
    } catch (e) {
      console.error(e);
    }

    let leftLogoId: number | null = null;
    let rightLogoId: number | null = null;

    if (leftLogoBase64) {
      leftLogoId = workbook.addImage({
        base64: leftLogoBase64,
        extension: 'png',
      });
    }
    if (rightLogoBase64) {
      rightLogoId = workbook.addImage({
        base64: rightLogoBase64,
        extension: 'png',
      });
    }

    // Set Row Heights and columns width
    worksheet.getRow(1).height = 45;
    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 18;

    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LAPORAN KEHADIRAN ABSENSI TBM';
    titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF00599C' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:F2');
    const subtitleCell1 = worksheet.getCell('A2');
    subtitleCell1.value = 'PT UNITED TRANSWORLD TRADING';
    subtitleCell1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
    subtitleCell1.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:F3');
    const subtitleCell2 = worksheet.getCell('A3');
    subtitleCell2.value = 'Data Center Maintenance System';
    subtitleCell2.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
    subtitleCell2.alignment = { vertical: 'middle', horizontal: 'center' };

    // Apply borders around the Header Block (A1:F3)
    for (let r = 1; r <= 3; r++) {
      for (let c = 1; c <= 6; c++) {
        const cell = worksheet.getCell(r, c);
        cell.border = {
          top: r === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          bottom: r === 3 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          left: c === 1 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          right: c === 6 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        };
      }
    }

    if (leftLogoId !== null) {
      worksheet.addImage(leftLogoId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 90, height: 35 }
      });
    }

    if (rightLogoId !== null) {
      worksheet.addImage(rightLogoId, {
        tl: { col: 5.2, row: 0.2 },
        ext: { width: 85, height: 32 }
      });
    }

    // Add empty row
    worksheet.addRow([]);
    worksheet.addRow([`Periode: ${startDate || 'all'} s.d. ${endDate || 'all'}`]);
    worksheet.addRow([`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    worksheet.addRow([]);

    // Summary Rows
    worksheet.addRow(['RINGKASAN STATISTIK']);
    worksheet.addRow([`Total Log Kehadiran`, stats.total]);
    worksheet.addRow([`Hadir`, stats.hadir]);
    worksheet.addRow([`Tidak Hadir`, stats.tidakHadir]);
    worksheet.addRow([`Persentase Kehadiran`, `${stats.rate}%`]);
    worksheet.addRow([]);

    // Format summary font
    worksheet.getCell('A8').font = { bold: true };
    for (let r = 9; r <= 12; r++) {
      worksheet.getCell(`A${r}`).font = { bold: true };
      worksheet.getCell(`B${r}`).alignment = { horizontal: 'left' };
    }

    // Table Header
    const headers = ['No', 'Tanggal', 'Nama', 'Jabatan', 'Status Kehadiran', 'Keterangan'];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle' };
    
    for (let col = 1; col <= 6; col++) {
      headerRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00599C' } // Theme Blue matching the stripe
      };
      headerRow.getCell(col).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Rows Data
    filteredRecords.forEach((rec, idx) => {
      const row = worksheet.addRow([
        idx + 1,
        rec.tanggal,
        rec.nama,
        rec.jabatan,
        rec.kehadiran,
        rec.remark || '-'
      ]);
      row.height = 20;
      row.alignment = { vertical: 'middle' };
      
      // Status Color Fill
      const statusCell = row.getCell(5);
      if (rec.kehadiran === 'Hadir') {
        statusCell.font = { color: { argb: 'FF10B981' }, bold: true }; // Green
      } else {
        statusCell.font = { color: { argb: 'FFF43F5E' }, bold: true }; // Red
      }

      for (let col = 1; col <= 6; col++) {
        row.getCell(col).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }
    });

    // Columns width
    worksheet.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 6;
      else if (idx === 1) col.width = 15;
      else if (idx === 2) col.width = 25;
      else if (idx === 3) col.width = 20;
      else if (idx === 4) col.width = 18;
      else if (idx === 5) col.width = 25;
    });

    // Save Workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Absen_TBM_${startDate || 'all'}_to_${endDate || 'all'}.xlsx`;
    link.click();
    toast.success("Excel Absensi TBM berhasil diunduh!");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* ─── Header ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-900/80 to-slate-800/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg shadow-pink-500/20">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Absensi Checklist & Grafik TBM</h1>
              <p className="text-sm text-slate-400">Kelola dan analisis data absensi TBM secara real-time</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Filters & Actions Bar ──────────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">TANGGAL MULAI</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              title="Tanggal Mulai"
              placeholder="Tanggal Mulai"
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">TANGGAL SELESAI</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              title="Tanggal Selesai"
              placeholder="Tanggal Selesai"
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 block">CARI NAMA / JABATAN</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari..."
              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50 placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* ─── Statistics Cards & Chart Section ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary Cards */}
        <div className="space-y-4">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Record</p>
              <h3 className="text-2xl font-black text-white mt-1">{stats.total}</h3>
            </div>
            <div className="p-3 bg-slate-800 rounded-xl text-slate-300">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{stats.hadir}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tidak Hadir</p>
              <h3 className="text-2xl font-black text-rose-500 mt-1">{stats.tidakHadir}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rasio Kehadiran</p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 bg-slate-800 rounded-full h-3.5 overflow-hidden border border-slate-700/50">
                <div
                  ref={progressRef}
                  className="bg-gradient-to-r from-emerald-500 to-green-400 h-full transition-all duration-500"
                />
              </div>
              <span className="text-sm font-black text-white">{stats.rate}%</span>
            </div>
          </div>
        </div>

        {/* Right Side: Charts Display */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-pink-500 rounded-full shadow-lg shadow-pink-500" />
              Grafik Kehadiran Harian
            </h2>
          </div>
          <div className="flex-1 w-full h-[220px]">
            {stats.chartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <Calendar className="w-10 h-10 mb-2 opacity-30" />
                Belum ada data untuk grafik.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="tanggal" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Tidak Hadir" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* ─── Form Section: Checklist Absen TBM ───────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-violet-500 rounded-full shadow-lg shadow-violet-500" />
            Checklist Kehadiran Harian TBM
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TANGGAL ABSEN</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                title="Tanggal Absen"
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">TIM / KATEGORI</label>
              <select
                value={formCategory}
                onChange={e => setFormCategory(e.target.value as any)}
                title="Kategori TBM"
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 font-bold"
              >
                <option value="Semua">Semua</option>
                <option value="UTT Daily">UTT Daily</option>
                <option value="UTT Mobile">UTT Mobile</option>
                <option value="DME">DME</option>
                <option value="Manual">Input Manual</option>
              </select>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/60 text-slate-300">
                  <th className="px-3 py-3 text-left w-12">No</th>
                  <th className="px-3 py-3 text-left">Nama Lengkap</th>
                  <th className="px-3 py-3 text-left w-48">Jabatan</th>
                  <th className="px-3 py-3 text-center w-60">Status Kehadiran</th>
                  <th className="px-3 py-3 text-left">Keterangan (Remark)</th>
                  {formCategory === 'Manual' && <th className="px-3 py-3 text-center w-16">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {(() => {
                  let lastCategory = '';
                  return checklist.map((item, index) => {
                    const isNewCategory = formCategory === 'Semua' && item.category !== lastCategory;
                    if (isNewCategory && item.category) {
                      lastCategory = item.category;
                    }
                    return (
                      <Fragment key={index}>
                        {isNewCategory && item.category && (
                          <tr className="bg-slate-800/40 text-slate-300 border-t border-slate-700/50">
                            <td colSpan={5} className="px-3 py-2 text-[10px] text-pink-400 font-black tracking-wider uppercase bg-slate-900/40">
                              {item.category}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-3 py-3.5 text-slate-400 font-mono">{index + 1}.</td>
                          <td className="px-3 py-3.5 font-bold text-white">
                            {formCategory === 'Manual' ? (
                              <input
                                type="text"
                                value={item.nama}
                                onChange={e => updateChecklistItem(index, 'nama', e.target.value)}
                                placeholder="Ketik Nama Karyawan..."
                                title="Nama"
                                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                              />
                            ) : (
                              item.nama
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-slate-300">
                            {formCategory === 'Manual' ? (
                              <input
                                type="text"
                                value={item.jabatan}
                                onChange={e => updateChecklistItem(index, 'jabatan', e.target.value)}
                                placeholder="Jabatan..."
                                title="Jabatan"
                                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                              />
                            ) : (
                              item.jabatan
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(index, 'kehadiran', 'Hadir')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  item.kehadiran === 'Hadir'
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                    : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                HADIR
                              </button>
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(index, 'kehadiran', 'Tidak Hadir')}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                  item.kehadiran === 'Tidak Hadir'
                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-sm shadow-rose-500/10'
                                    : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
                                }`}
                              >
                                ABSEN
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <input
                              type="text"
                              value={item.remark}
                              onChange={e => updateChecklistItem(index, 'remark', e.target.value)}
                              placeholder="Tambahkan keterangan (sakit, izin, off)..."
                              title="Keterangan"
                              className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 placeholder-slate-600"
                            />
                          </td>
                          {formCategory === 'Manual' && (
                            <td className="px-3 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeManualRow(index)}
                                title="Hapus Baris"
                                className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div>
              {formCategory === 'Manual' && (
                <button
                  type="button"
                  onClick={addManualRow}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Baris Manual
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || checklist.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 active:scale-95 transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan Absensi...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Simpan Absensi Checklist ({checklist.length} Karyawan)
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Table Section: Records List ────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-hidden">
        <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500" />
          Daftar Log Kehadiran Absen TBM ({filteredRecords.length})
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
            <p className="text-slate-500 text-xs mt-2">Memuat log kehadiran...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            Tidak ada catatan kehadiran yang cocok dengan pencarian / rentang tanggal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700/50 text-slate-300 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 text-left w-12">No</th>
                  <th className="px-4 py-3 text-left w-28">Tanggal</th>
                  <th className="px-4 py-3 text-left">Nama Lengkap</th>
                  <th className="px-4 py-3 text-left">Jabatan</th>
                  <th className="px-4 py-3 text-left w-36">Kehadiran</th>
                  <th className="px-4 py-3 text-left">Keterangan</th>
                  <th className="px-4 py-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredRecords.map((rec, index) => (
                  <tr key={rec.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3.5 text-slate-500 font-mono">{index + 1}.</td>
                    <td className="px-4 py-3.5 text-slate-300 font-medium">
                      {new Date(rec.tanggal).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-white font-bold">{rec.nama}</td>
                    <td className="px-4 py-3.5 text-slate-400">{rec.jabatan}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        rec.kehadiran === 'Hadir'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          rec.kehadiran === 'Hadir' ? 'bg-emerald-400 shadow-md shadow-emerald-500/50' : 'bg-rose-400 shadow-md shadow-rose-500/50'
                        }`} />
                        {rec.kehadiran}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 italic max-w-xs truncate" title={rec.remark}>
                      {rec.remark || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-1.5 bg-slate-800/80 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-slate-500 border border-slate-700/50 hover:border-red-500/20 transition-all active:scale-95"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
