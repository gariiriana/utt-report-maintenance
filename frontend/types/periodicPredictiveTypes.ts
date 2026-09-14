// ============================================================================
// FILE: frontend/types/periodicPredictiveTypes.ts
// Deskripsi: Definisi Tipe Data Standar untuk Laporan Predictive Maintenance (PdM)
//            Periodik (Bulanan & Tahunan) Data Center NeutraDC Cikarang.
// ============================================================================

export type PeriodicScope = 'monthly' | 'yearly';

export interface SystemAssessment {
  systemName:
    | 'HVAC / Cooling'
    | 'Electrical Distribution'
    | 'Fuel System'
    | 'UPS & Battery'
    | 'Fire Protection'
    | 'General Facility'
    | string;
  riskLevel: 'Critical' | 'Warning' | 'Healthy';
  healthScore: number; // 0 - 100
  totalIncidents: number;
  criticalIssues: string[];
  aiInsight: string;
}

export interface BadActorAsset {
  equipmentName: string;
  systemCategory: string;
  locationRoom: string;
  incidentCount: number;
  failureModes: string[];
  estimatedRUL: string; // e.g. "1 - 3 Bulan"
  recommendation: string; // e.g. "Jadwalkan Overhaul Bearing & Rantai di Q4"
}

export interface PeriodicSparepartForecast {
  partName: string;
  estimatedNeeded: string | number;
  currentStockStatus: 'Sufficient' | 'Low / Order Now' | 'Critical Stockout';
  justification: string;
}

export interface PeriodicActionPlan {
  immediatePreventive: string[]; // Tindakan mitigasi bulan berikutnya
  scheduledOverhauls: string[]; // Jadwal overhaul terencana kuartal depan
  capexReplacementRecommendations: string[]; // Rekomendasi peremajaan unit (CAPEX tahunan)
}

export interface PeriodicSignatures {
  preparedBy: {
    name: string;
    title: string;
    date: string;
    signatureBase64?: string;
  };
  verifiedBy: {
    name: string;
    title: string;
    date: string;
    signatureBase64?: string;
  };
  approvedBy: {
    name: string;
    title: string;
    date: string;
    signatureBase64?: string;
  };
}

export interface PeriodicPredictiveReportData {
  id: string; // e.g. "PPR_2026_09_XXXX"
  reportNumber: string; // e.g. "PPR/DME-NDC/2026/09/001" or "PPR-ANNUAL/DME-NDC/2026"
  periodType: PeriodicScope;
  month?: number; // 1 - 12 (hanya untuk bulanan)
  monthName?: string; // e.g. "September"
  year: number; // e.g. 2026
  title: string;
  createdAt: Date | any;
  updatedAt: Date | any;
  createdBy: string;

  // Statistik Agregat Dasar
  totalCMEvents: number;
  totalAbnormalFindings: number;
  totalSparepartsReplaced: number;

  // Analisis Indeks Kesehatan Fasilitas
  facilityHealthScore: number; // 0 - 100
  overallStatus: 'Optimized' | 'Caution Needed' | 'High Risk';
  executiveSummary: string;

  // Analisis per Sub-Sistem
  systemAssessments: SystemAssessment[];

  // Bad Actor Equipment (Peralatan paling rewel)
  badActorAssets: BadActorAsset[];

  // Prediksi Kebutuhan Suku Cadang
  sparepartForecast: PeriodicSparepartForecast[];

  // Rencana Tindakan & Rekomendasi CAPEX/OPEX
  actionPlan: PeriodicActionPlan;

  // Lembar Pengesahan
  signatures: PeriodicSignatures;
}
