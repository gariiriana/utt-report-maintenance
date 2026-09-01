// ============================================================================
// FILE: hseFinding.ts
// Deskripsi: Interface & Type Definitions untuk Fitur Temuan K3 / HSE (HSE Findings).
//            Digunakan khusus oleh Role HSE untuk mendata temuan keselamatan kerja,
//            kondisi bahaya (Unsafe Condition / Unsafe Act), bukti foto Before,
//            serta tindak lanjut / bukti foto After penyelesaian.
// ============================================================================

export type HSEFindingStatus = 'open' | 'close';
export type HSEFindingSeverity =
  | 'unsafe_condition'
  | 'unsafe_action'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | (string & {});

export type HSEFindingCategory =
  | 'unsafe_act'
  | 'unsafe_condition'
  | 'apd_ppe'
  | 'housekeeping'
  | 'tools_equipment'
  | 'electrical_safety'
  | 'environmental'
  | 'other'
  | (string & {});

export interface HSEFindingItem {
  id?: string;
  title: string;                         // Judul Temuan (e.g. "Engineer tidak memakai helm safety")
  description: string;                   // Deskripsi / Kronologi detail temuan
  location: string;                      // Lokasi temuan (e.g. "Genset Room Lantai 1", "Chiller Area")
  category: string;                      // Kategori K3 (Manual text input / kategori kustom)
  severity: HSEFindingSeverity;           // Tingkat Bahaya / Risiko (Unsafe Condition, Unsafe Action, dll)
  status: HSEFindingStatus;               // 'open' (Temuan Masih Terbuka), 'close' (Temuan Sudah Ditutup)
  
  // Pelapor & Pihak Terkait
  reportedBy: string;                    // Email HSE Officer pelapor
  inspectorName?: string;                // Nama HSE Officer / Pengawas
  targetPerson?: string;                 // Pihak terkait / Teknisi / Vendor / Subkon
  findingDate: string;                   // Tanggal temuan (YYYY-MM-DD)
  findingTime?: string;                  // Jam temuan (HH:mm)
  targetDate?: string;                   // Target tanggal penyelesaian
  
  // Foto & Bukti Temuan (Before)
  beforePhoto: string;                   // Base64 compressed image temuan awal
  beforeNotes?: string;                  // Catatan tambahan kondisi awal
  
  // Bukti Penyelesaian / Tindak Lanjut (After)
  afterPhoto?: string;                   // Base64 compressed image bukti perbaikan
  afterNotes?: string;                   // Catatan tindakan perbaikan (Corrective Action Taken)
  resolvedAt?: any;                      // Timestamp / Date string selesai
  resolvedBy?: string;                   // Nama / Email yang menyelesaikan / verifikasi
  
  // Catatan Tambahan Penutupan
  closingNotes?: string;                 // Catatan saat temuan ditutup (opsional)
  
  // Meta Firestore
  createdAt?: any;
  updatedAt?: any;
}

export const HSE_CATEGORY_LABELS: Record<HSEFindingCategory, { label: string; badgeColor: string }> = {
  unsafe_act: {
    label: 'Tindakan Tidak Aman (Unsafe Act)',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  unsafe_condition: {
    label: 'Kondisi Tidak Aman (Unsafe Condition)',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  apd_ppe: {
    label: 'Pelanggaran APD / Safety PPE',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  housekeeping: {
    label: 'Kebersihan & Housekeeping',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
  },
  tools_equipment: {
    label: 'Peralatan / Perkakas Kerja',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  electrical_safety: {
    label: 'Bahaya Kelistrikan (Electrical)',
    badgeColor: 'bg-red-50 text-red-700 border-red-200'
  },
  environmental: {
    label: 'Lingkungan & Limbah B3',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  other: {
    label: 'Lainnya',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200'
  }
};

export const HSE_SEVERITY_CONFIG: Record<string, { label: string; color: string; badge: string; dot: string }> = {
  unsafe_condition: {
    label: 'Unsafe Condition',
    color: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500'
  },
  unsafe_action: {
    label: 'Unsafe Action',
    color: 'text-rose-700',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  },
  // Backward compatibility:
  high: {
    label: 'Tinggi (High)',
    color: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500'
  },
  medium: {
    label: 'Sedang (Medium)',
    color: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500'
  },
  low: {
    label: 'Rendah (Low)',
    color: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  },
  critical: {
    label: 'Kritis (Critical)',
    color: 'text-red-700',
    badge: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-600'
  }
};

export const HSE_STATUS_CONFIG: Record<HSEFindingStatus, { label: string; color: string; badge: string; iconBg: string }> = {
  open: {
    label: 'Open (Temuan Terbuka)',
    color: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700'
  },
  close: {
    label: 'Close (Temuan Ditutup)',
    color: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-700'
  }
};
