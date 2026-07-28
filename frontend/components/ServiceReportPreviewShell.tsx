import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';
import logoNeutraDC from '@/assets/logo_neutradc.png';

// ─── Shared Types ──────────────────────────────────────────────────────────────

export interface InspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: string; // 'Good' | 'Not Good' | 'Not good' | 'N/A'
  remarks: string;
}

export interface CommonCustomerInfo {
  companyName: string;
  equipmentName: string;
  ciDescription?: string;
  ciName?: string;
  type: string;
  serialNo: string;
  productName: string;
  productYears: string;
  specification: string;
  location: string;
  area: string;
  mapNo?: string;
  mopNo?: string;
  quarter: string;
  date: string;
  engineer: string;
}

export interface CommonTimeSpent {
  date: string;
  departure: string;
  start: string;
  finish: string;
}

export interface OperationStatus {
  is_normal: boolean;
  remark: string;
  fault_symptom?: string;
  fault_analysis?: string;
  work_done?: string;
  fault_part_sn?: string;
  fault_part_name?: string;
}

export interface PhotoCard {
  photoBase64?: string;
  description: string;
}

// ─── Preview Shell Props ──────────────────────────────────────────────────────

export interface ServiceReportPreviewShellProps {
  /** Report title, e.g. "Service Report Fan Coil Unit (FCU)" */
  title: string;
  /** Short equipment label for documentation page, e.g. "FCU" */
  equipmentLabel: string;
  /** Customer Info data */
  customerInfo: CommonCustomerInfo;
  /** Time Spent data */
  timeSpent: CommonTimeSpent;
  /** Visual Inspection items */
  visualInspection: InspectionItem[];
  /** Cleaning items (optional — not all reports have them) */
  cleaning?: InspectionItem[];
  /** Equipment-specific measurement sections rendered as JSX */
  measurementSections?: ReactNode;
  /** Operation status data */
  operationStatus?: OperationStatus;
  /** Photos for documentation page */
  photos?: PhotoCard[];
  /** Callbacks */
  onBack: () => void;
  onExportPDF: () => void;
  onExportExcel?: () => void;
}

// ─── Checklist Table ──────────────────────────────────────────────────────────

function ChecklistTable({ title, items }: { title: string; items: InspectionItem[] }) {
  return (
    <table className="w-full text-[10px] border-collapse border border-gray-400">
      <thead>
        <tr className="bg-blue-700 text-white">
          <th colSpan={6} className="px-2 py-1 text-left text-xs font-bold">{title}</th>
        </tr>
        <tr className="bg-yellow-100 text-gray-800 font-bold">
          <th className="border border-gray-300 px-1 py-1 w-6">No</th>
          <th className="border border-gray-300 px-1 py-1 text-left">Aktivitas</th>
          <th className="border border-gray-300 px-1 py-1 w-28">Parameter</th>
          <th className="border border-gray-300 px-1 py-1 w-12" colSpan={2}>Kondisi</th>
          <th className="border border-gray-300 px-1 py-1 w-16">Keterangan</th>
        </tr>
        <tr className="bg-yellow-50 text-gray-600 text-center">
          <th className="border border-gray-300 px-1 py-0.5"></th>
          <th className="border border-gray-300 px-1 py-0.5"></th>
          <th className="border border-gray-300 px-1 py-0.5"></th>
          <th className="border border-gray-300 px-1 py-0.5">Baik</th>
          <th className="border border-gray-300 px-1 py-0.5">Tidak Baik</th>
          <th className="border border-gray-300 px-1 py-0.5"></th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.no} className="hover:bg-gray-50">
            <td className="border border-gray-300 px-1 py-0.5 text-center font-bold">{item.no}.</td>
            <td className="border border-gray-300 px-1 py-0.5">{item.activity}</td>
            <td className="border border-gray-300 px-1 py-0.5 text-center">{item.parameter}</td>
            <td className="border border-gray-300 px-1 py-0.5 text-center">
              {(item.condition === 'Good') && <span className="text-green-600 font-bold">Baik</span>}
            </td>
            <td className="border border-gray-300 px-1 py-0.5 text-center">
              {(item.condition === 'Not Good' || item.condition === 'Not good') && <span className="text-red-600 font-bold">Tidak Baik</span>}
            </td>
            <td className="border border-gray-300 px-1 py-0.5">{item.remarks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main Shell Component ──────────────────────────────────────────────────────

export function ServiceReportPreviewShell({
  title, equipmentLabel, customerInfo, timeSpent,
  visualInspection, cleaning, measurementSections,
  operationStatus, photos, onBack, onExportPDF, onExportExcel,
}: ServiceReportPreviewShellProps) {

  const containerRef = useRef<HTMLDivElement>(null);
  const formattedDate = customerInfo.date
    ? new Date(customerInfo.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/98 overflow-y-auto pb-10 pt-4 px-2 sm:px-4"
    >
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-bold">Kembali</span>
          </button>
          <div className="text-center hidden sm:block">
            <p className="text-xs font-bold text-white">Pratinjau {title}</p>
          </div>
          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
            )}
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview - mimics PDF layout */}
      <div className="max-w-4xl mx-auto mt-6 overflow-x-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden min-w-[700px]">
          <div className="p-6 sm:p-8 space-y-4 font-sans text-slate-900">

            {/* Header with logos */}
            <div className="flex items-center justify-between border-2 border-gray-300 rounded-lg p-3">
              <img src={logoDwimitra} alt="Dwimitra" className="h-10 object-contain" />
              <div className="text-center flex-1">
                <h1 className="text-sm font-bold text-blue-800 uppercase">{title}</h1>
                <p className="text-xs text-gray-600">Neutra DC Cikarang</p>
              </div>
              <img src={logoNeutraDC} alt="NeutraDC" className="h-8 object-contain" />
            </div>

            {/* Customer Info Table */}
            <table className="w-full text-[10px] border-collapse border border-gray-400">
              <tbody>
                <tr className="bg-blue-700 text-white">
                  <td colSpan={8} className="px-2 py-1 font-bold text-xs">Pelanggan</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-24">Nama Perusahaan</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.companyName}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Tipe</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.type}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50" rowSpan={2}>Spesifikasi</td>
                  <td className="border border-gray-300 px-1.5 py-1" rowSpan={2}>{customerInfo.specification}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">No Peta</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.mapNo || customerInfo.mopNo}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Nama Perangkat</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.equipmentName}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">No Seri</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.serialNo}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Kuartal</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.quarter}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Deskripsi CI</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.ciDescription}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Nama Produk</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.productName}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Lokasi</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.location}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Tanggal</td>
                  <td className="border border-gray-300 px-1.5 py-1">{formattedDate}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Nama CI</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.ciName}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Tahun Produk</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.productYears}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Area</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.area}</td>
                  <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Teknisi</td>
                  <td className="border border-gray-300 px-1.5 py-1">{customerInfo.engineer}</td>
                </tr>
              </tbody>
            </table>

            {/* Visual Inspection */}
            <ChecklistTable title="Inspeksi & Pemeriksaan Visual" items={visualInspection} />

            {/* Cleaning */}
            {cleaning && cleaning.length > 0 && (
              <ChecklistTable title="Pembersihan" items={cleaning} />
            )}

            {/* Equipment-specific measurement sections */}
            {measurementSections}

            {/* Operation Status */}
            {operationStatus && (
              <>
                <table className="w-full text-[10px] border-collapse border border-gray-400">
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-40">
                        {operationStatus.is_normal ? '☑ Operasi Normal' : '☐ Operasi Normal'}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-20">Keterangan</td>
                      <td className="border border-gray-300 px-1.5 py-1">{operationStatus.remark}</td>
                    </tr>
                  </tbody>
                </table>
                {!operationStatus.is_normal && (
                  <table className="w-full text-[10px] border-collapse border border-gray-400">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50 w-40">☑ Operasi Abnormal</td>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Gejala kerusakan</td>
                        <td className="border border-gray-300 px-1.5 py-1">{operationStatus.fault_symptom}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">(Jika perbaikan)</td>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Analisis kerusakan</td>
                        <td className="border border-gray-300 px-1.5 py-1">{operationStatus.fault_analysis}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-1.5 py-1"></td>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">Pekerjaan yang dilakukan</td>
                        <td className="border border-gray-300 px-1.5 py-1">{operationStatus.work_done}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-1.5 py-1"></td>
                        <td className="border border-gray-300 px-1.5 py-1 font-bold bg-gray-50">No. Seri Komponen Rusak</td>
                        <td className="border border-gray-300 px-1.5 py-1">{operationStatus.fault_part_sn}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Time Spent */}
            <table className="w-full text-[10px] border-collapse border border-gray-400">
              <thead>
                <tr className="bg-yellow-200 text-gray-800 font-bold italic">
                  <th colSpan={4} className="px-2 py-1 text-left text-xs">WAKTU PENGERJAAN</th>
                </tr>
                <tr className="bg-yellow-100 font-bold text-gray-800">
                  <th className="border border-gray-300 px-1 py-1">Tanggal</th>
                  <th className="border border-gray-300 px-1 py-1">Keberangkatan</th>
                  <th className="border border-gray-300 px-1 py-1">Mulai</th>
                  <th className="border border-gray-300 px-1 py-1">Selesai</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.date}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.departure}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.start}</td>
                  <td className="border border-gray-300 px-1 py-2 text-center">{timeSpent.finish}</td>
                </tr>
              </tbody>
            </table>

            {/* Customer Acknowledgement */}
            <div className="text-center mt-6">
              <p className="text-xs font-bold text-gray-800 mb-4 uppercase">Customer Acknowledgement:</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-600">Dibuat</p>
                  <div className="h-16 border-b border-gray-400 mt-1"></div>
                  <p className="text-[10px] font-bold text-gray-800 mt-1">Teknisi</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-600">Diperiksa</p>
                  <div className="h-16 border-b border-gray-400 mt-1"></div>
                  <p className="text-[10px] font-bold text-gray-800 mt-1">SM/PM</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-gray-600">Disetujui</p>
                  <div className="h-16 border-b border-gray-400 mt-1"></div>
                  <p className="text-[10px] font-bold text-gray-800 mt-1">Klien / Pemilik</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Page Preview */}
      {photos && photos.length > 0 && (
        <div className="max-w-4xl mx-auto mt-6 overflow-x-auto">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden min-w-[700px]">
            <div className="p-6 sm:p-8 space-y-4 font-sans text-slate-900">
              {/* Header with logos matching the PDF format */}
              <div className="flex items-center justify-between border-2 border-gray-300 rounded-lg p-3 mb-6">
                <img src={logoDwimitra} alt="Dwimitra" className="h-10 object-contain" />
                <div className="text-center flex-1 mx-4">
                  <h1 className="text-sm font-bold text-blue-800 uppercase tracking-tight">Laporan Maintenance</h1>
                  <h2 className="text-[11px] font-bold text-gray-800 uppercase">Dokumentasi PM: {equipmentLabel}</h2>
                  {customerInfo.specification && (
                    <p className="text-[9px] font-bold text-blue-600 uppercase mt-0.5">{customerInfo.specification}</p>
                  )}
                  <p className="text-[8px] text-gray-500 mt-0.5">Tanggal Maintenance: {formattedDate}</p>
                </div>
                <img src={logoNeutraDC} alt="NeutraDC" className="h-8 object-contain" />
              </div>

              <div className="h-px w-full bg-slate-100 mb-6" />

              {/* Grid of photos */}
              <div className="grid grid-cols-3 gap-3">
                {photos.map((card, idx) => (
                  <div key={idx} className="flex flex-col border-2 border-slate-900 overflow-hidden shadow-sm bg-white">
                    <div className="aspect-video w-full relative bg-slate-100 flex items-center justify-center overflow-hidden border-b-2 border-slate-900">
                      {card.photoBase64 ? (
                        <img src={card.photoBase64} alt={card.description} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-300">
                          <span className="text-[10px] font-black uppercase tracking-tighter">Tidak Ada Foto</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white min-h-[50px] flex items-center gap-2 text-left relative">
                      <div className="absolute left-1 top-2 bottom-2 w-[2.5px] bg-blue-600 rounded-full" />
                      <p className="text-[11px] leading-tight text-slate-900 font-bold break-words pl-2.5 pr-1">
                        {card.description || 'N/A'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
