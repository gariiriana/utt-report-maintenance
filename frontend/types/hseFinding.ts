// ============================================================================
// FILE: hseFinding.ts
// Deskripsi: Interface & Type Definitions untuk Fitur Temuan K3 / HSE (HSE Findings).
//            Digunakan khusus oleh Role HSE untuk mendata temuan keselamatan kerja,
//            kondisi bahaya (Unsafe Condition / Unsafe Act), bukti foto Before,
//            serta tindak lanjut / bukti foto After penyelesaian.
// ============================================================================

export type HSEFindingType = 'negative' | 'positive';
export type HSEFindingStatus = 'open' | 'close';
export type HSEFindingSeverity =
  | 'unsafe_condition'
  | 'unsafe_action'
  | 'safe_behavior'
  | 'safe_condition'
  | 'compliance'
  | 'best_practice'
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
  findingType?: HSEFindingType;          // 'negative' (Unsafe Act/Condition) | 'positive' (Safe Act/Best Practice)
  title: string;                         // Judul Temuan (e.g. "Engineer tidak memakai helm safety" atau "Pekerja tertib APD")
  description: string;                   // Deskripsi / Kronologi detail temuan
  location: string;                      // Lokasi temuan (e.g. "Genset Room Lantai 1", "Chiller Area")
  category: string;                      // Kategori K3 (Manual text input / kategori kustom)
  severity: HSEFindingSeverity;           // Tingkat Bahaya / Risiko (Unsafe Condition, Unsafe Action, Safe Behavior, dll)
  status: HSEFindingStatus;               // 'open' (Temuan Masih Terbuka), 'close' (Temuan Sudah Ditutup)
  
  // Pelapor & Pihak Terkait
  reportedBy: string;                    // Email HSE Officer pelapor
  inspectorName?: string;                // Nama HSE Officer / Pengawas
  targetPerson?: string;                 // Pihak terkait / Teknisi / Vendor / Subkon (atau penerima apresiasi)
  findingDate: string;                   // Tanggal temuan (YYYY-MM-DD)
  findingTime?: string;                  // Jam temuan (HH:mm)
  targetDate?: string;                   // Target tanggal penyelesaian
  
  // Foto & Bukti Temuan (Before / Dokumentasi)
  beforePhoto: string;                   // Base64 compressed image temuan awal (utama / foto pertama)
  beforePhotos?: string[];               // Daftar base64 multi-foto temuan awal
  beforeNotes?: string;                  // Catatan tambahan kondisi awal
  
  // Bukti Penyelesaian / Tindak Lanjut (After)
  afterPhoto?: string;                   // Base64 compressed image bukti perbaikan (utama / foto pertama)
  afterPhotos?: string[];                // Daftar base64 multi-foto bukti perbaikan
  afterNotes?: string;                   // Catatan tindakan perbaikan (Corrective Action Taken)
  resolvedAt?: any;                      // Timestamp / Date string selesai
  resolvedBy?: string;                   // Nama / Email yang menyelesaikan / verifikasi
  
  // Catatan Tambahan Penutupan
  closingNotes?: string;                 // Catatan saat temuan ditutup (opsional)

  // Pengajuan Hapus ke QC DME
  deleteRequested?: boolean;
  deleteRequestedBy?: string;
  deleteRequestedTo?: string;
  deleteReason?: string;
  deleteRequestedAt?: any;
  
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
  // Temuan Negatif:
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
  // Temuan Positif:
  safe_behavior: {
    label: 'Safe Behavior (Tindakan Aman)',
    color: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  safe_condition: {
    label: 'Safe Condition (Kondisi Aman)',
    color: 'text-teal-700',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    dot: 'bg-teal-500'
  },
  compliance: {
    label: 'Kepatuhan K3 & APD Lengkap',
    color: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  },
  best_practice: {
    label: 'Best Practice / Inovasi K3',
    color: 'text-cyan-700',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500'
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

export const HSE_FINDING_TYPE_CONFIG: Record<HSEFindingType, {
  label: string;
  shortLabel: string;
  subLabel: string;
  description: string;
  color: string;
  badge: string;
  border: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  iconBg: string;
}> = {
  negative: {
    label: 'Temuan Negatif (Unsafe Act / Condition)',
    shortLabel: 'Temuan Negatif',
    subLabel: 'Unsafe Action & Unsafe Condition',
    description: 'Pencatatan tindakan atau kondisi tidak aman yang membutuhkan tindakan perbaikan (Corrective Action).',
    color: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    border: 'border-rose-200',
    activeBg: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-lg shadow-rose-600/20',
    activeBorder: 'border-transparent',
    activeText: 'text-white',
    iconBg: 'bg-rose-100 text-rose-600'
  },
  positive: {
    label: 'Temuan Positif (Safe Action / Best Practice)',
    shortLabel: 'Temuan Positif',
    subLabel: 'Safe Behavior & Best Practice',
    description: 'Apresiasi & dokumentasi tindakan aman, kepatuhan APD teladan, serta penerapan K3 yang baik di lapangan.',
    color: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    border: 'border-emerald-200',
    activeBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/20',
    activeBorder: 'border-transparent',
    activeText: 'text-white',
    iconBg: 'bg-emerald-100 text-emerald-600'
  }
};
