// ============================================================================
// FILE: frontend/types/predictiveReportTypes.ts
// Deskripsi: Tipe Data Standar untuk Laporan Predictive Maintenance (PdM)
//            Data Center NeutraDC Cikarang — PT Dwimitra Ekatama Mandiri.
// ============================================================================

export interface PredictiveParameterDrift {
  parameterName: string;
  measuredValue: string;
  nominalBaseline: string;
  unit?: string;
}

export interface PredictiveSparepart {
  partName: string;
  partNumber?: string;
  quantity: string | number;
  urgency: 'Ready Stock' | 'Indent Procurement' | 'Critical Backup';
}

export interface PredictiveReportData {
  id: string; // e.g. "PDM_20260912_XXXX"
  reportNumber: string; // e.g. "PDM/DME-NDC/2026/09/001"
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Email akun pembuat (Standby Engineer / QC DME)

  // ─── Referensi Dokumen Asal (Parent Linking) ─────────────────────────────
  sourceDocId: string; // ID dokumen laporan CM atau arsip temuan abnormal
  sourceCollection: 'excel_documents' | 'pdf_documents' | 'findings' | 'cm_reports' | 'corrective_reports';
  sourceTicketNumber?: string; // Nomor tiket CM / No Laporan asal
  sourceMaintenanceName: string;
  sourceMaintenanceDate: string;

  // ─── Bagian 1: Identitas Peralatan (Asset Identification) ───────────────
  equipmentName: string; // e.g. "Fuel Pump Supply 2", "Chiller 03", "Trafo B"
  equipmentTag?: string; // e.g. "PUMP-FS-02", "CH-03-A"
  systemCategory:
    | 'Fuel System'
    | 'HVAC / Cooling'
    | 'Electrical Distribution'
    | 'UPS & Battery'
    | 'Fire Protection'
    | 'General Facility';
  locationRoom: string; // e.g. "Power House Lt. 1", "Chiller Yard", "Data Hall 1"
  brandModel?: string; // e.g. "Kirloskar / Kyoritsu KEW 3125B"

  // ─── Bagian 2: Kondisi Aktual & Gejala Awal (Anomaly Drift) ──────────────
  healthStatus: 'Critical' | 'Warning' | 'Caution';
  currentSymptoms: string; // Deskripsi gejala kerusakan terdeteksi
  measuredParameterDrift?: PredictiveParameterDrift[];
  photoEvidenceBase64?: string; // Foto bukti temuan dari CM/Abnormal
  photoCaption?: string;

  // ─── Bagian 3: Analisis Prediktif AI (AI Engineering Insight) ────────────
  aiAnalysis: {
    rootCauseAnalysis: string; // Analisis penyebab utama terjadinya anomali
    potentialFailureMode: string; // Modus kegagalan jika tidak ditangani
    degradationPattern: string; // Pola laju degradasi komponen
    remainingUsefulLife: string; // Estimasi sisa umur pakai (e.g. "7 - 14 Hari")
    urgencyLevel: 'Emergency' | 'High' | 'Medium' | 'Low';
    slaRiskAssessment: string; // Potensi dampak terhadap uptime beban kritis server
  };

  // ─── Bagian 4: Rencana Tindakan Prediktif (Action Plan) ──────────────────
  actionPlan: {
    immediateAction: string; // Tindakan stabilisasi jangka pendek (1 - 7 hari)
    plannedOverhaulAction: string; // Tindakan perbaikan definitif / overhaul (2 - 4 minggu)
    recommendedSpareparts: PredictiveSparepart[];
    followUpTestingMethods: string[]; // e.g. ["Thermography Scanning", "Megger Test", "Vibration Analysis"]
  };

  // ─── Bagian 5: Lembar Pengesahan (Approval Sheet) ────────────────────────
  signatures: {
    preparedBy: {
      name: string;
      title: string;
      signatureBase64?: string;
      date: string;
    };
    verifiedBy: {
      name: string;
      title: string;
      signatureBase64?: string;
      date: string;
    };
    approvedBy: {
      name: string;
      title: string;
      signatureBase64?: string;
      date: string;
    };
  };
}
