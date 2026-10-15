// ============================================================================
// FILE: frontend/types/pmPredictiveTypes.ts
// Deskripsi: Tipe data Predictive Report yang dibuat dari laporan Preventive
//            Maintenance (fitur "Buat Laporan" engineer). Satu laporan PM = satu
//            dokumen predictive berisi beberapa bagian per equipment. Riwayat angka
//            tiap parameter dibawa maju dari predictive sebelumnya (field history),
//            sehingga generate kuartal berikutnya cukup membaca satu dokumen.
// ============================================================================

export type PmCardKind = 'measurement' | 'nameplate' | 'visual';
export type PmStatus = 'normal' | 'watch' | 'warning' | 'alarm' | 'unknown';
export type PmConfidence = 'tinggi' | 'sedang' | 'rendah';
export type PmVisualCondition = 'baik' | 'perlu perhatian' | 'buruk' | 'tidak jelas';

export interface PmNameplate {
  brand?: string;
  model?: string;
  serial?: string;
  ratedVoltage?: number | null;
  ratedCurrent?: number | null;
  ratedPowerKw?: number | null;
  phase?: number | null;
  frequencyHz?: number | null;
  notes?: string;
  source?: 'foto' | 'predictive sebelumnya' | 'manual';
}

/** Satu angka hasil pengukuran yang sudah dikonfirmasi engineer. */
export interface PmReading {
  param: string;
  photoIndex: number;
  cardLabel: string;
  value: number | null;
  unit: string;
  aiValue: number | null;
  aiUnit?: string;
  aiRaw?: string;
  aiConfidence: PmConfidence;
  edited: boolean;
  note?: string;
}

export interface PmVisualObservation {
  key: string;
  photoIndex: number;
  cardLabel: string;
  condition: PmVisualCondition;
  observation: string;
  aiConfidence: PmConfidence;
}

export interface PmSeriesPoint {
  date: string; // YYYY-MM-DD tanggal pelaksanaan PM
  value: number;
  reportId: string;
}

/** Deret angka per parameter, termasuk titik laporan ini. */
export type PmHistory = Record<string, PmSeriesPoint[]>;

export interface PmProjection {
  level: 'warning' | 'alarm';
  limit: number;
  date: string; // YYYY-MM-DD
  daysAhead: number;
}

export interface PmParamResult {
  param: string;
  label: string;
  unit: string;
  value: number | null;
  status: PmStatus;
  limitText: string;
  points: number;
  previous: PmSeriesPoint | null;
  change: number | null;
  changePct: number | null;
  trendPerQuarter: number | null;
  projection: PmProjection | null;
  confidence: 'Tinggi' | 'Sedang' | 'Rendah';
  note: string;
}

export interface PmSectionNarrative {
  kondisi: string;
  analisisTren: string;
  prediksiRisiko: string;
  rekomendasi: string[];
}

export interface PmEquipmentSection {
  id: string;
  name: string;
  role: string;
  status: PmStatus;
  statusOverride?: PmStatus | null;
  params: PmParamResult[];
  visuals: PmVisualObservation[];
  narrative: PmSectionNarrative;
  narrativeSource: 'ai' | 'otomatis';
}

export interface PmSignatory {
  name: string;
  title: string;
}

export interface PmPredictiveReport {
  id: string; // = id laporan PM asal (satu predictive per laporan PM)
  reportNumber: string;
  profileId: string;
  profileVersion: number;
  unitType: string;
  account: string; // akun unit pemilik laporan PM (createdBy)
  unitLabel: string;
  unitKey: string;
  maintenanceName: string;
  maintenanceDate: string; // YYYY-MM-DD
  sourceDocId: string;
  sourceCollection: 'pdf_documents';
  sourceFileName?: string;
  nameplate: PmNameplate;
  readings: PmReading[];
  visuals: PmVisualObservation[];
  history: PmHistory;
  previousReportId: string | null;
  previousMaintenanceDate: string | null;
  sections: PmEquipmentSection[];
  overallStatus: PmStatus;
  summary: { ringkasan: string; prioritas: string[]; source: 'ai' | 'otomatis' };
  signatures: {
    authorName: string;
    preparedBy: PmSignatory;
    reviewedBy: PmSignatory;
    acknowledgedBy1: PmSignatory;
    acknowledgedBy2: PmSignatory;
    approvedBy: PmSignatory;
  };
  generatedBy: string;
  createdAt?: any;
  updatedAt?: any;
}

/** Hasil baca AI satu foto (respons backend /api/ai/pm-predictive/extract). */
export interface PmExtractResult {
  index: number;
  value: number | null;
  unit?: string;
  raw?: string;
  confidence: PmConfidence;
  condition?: PmVisualCondition | '';
  observation?: string;
  nameplate?: {
    brand?: string;
    model?: string;
    serial?: string;
    ratedVoltage: number | null;
    ratedCurrent: number | null;
    ratedPowerKw: number | null;
    phase: number | null;
    frequencyHz: number | null;
    notes?: string;
  };
}
