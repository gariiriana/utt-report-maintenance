// ============================================================================
// FILE: frontend/utils/aiPredictiveAgent.ts
// Deskripsi: AI Engineering Agent untuk Analisis & Pembuatan Laporan Predictive
//            Maintenance (PdM) Otomatis Berstandar Keandalan Data Center NeutraDC.
//            Terhubung ke Google Gemini API (dengan multi-key round-robin failover)
//            dan dilengkapi deterministic heuristic fallback jika offline/rate-limited.
// ============================================================================

import {
  PredictiveReportData,
  PredictiveParameterDrift,
  PredictiveSparepart,
  PredictiveAnalysisMetadata
} from '@/types/predictiveReportTypes';
import { auth } from '@/api/firebase';
import { getApiEndpoint } from '@/utils/apiConfig';
import {
  PREPARED_BY_SIGNATURES,
  getEngineerSignature,
  cleanSignature,
  ARIF_BUDIMAN_SIGNATURE_BASE64,
  ASEP_SIGNATURE_BASE64,
} from '@/utils/engineerSignatures';

// ─── Environment & API Key Management ────────────────────────────────────────

async function callReliabilityAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Login diperlukan untuk menjalankan analisis predictive.');

  const response = await fetch(getApiEndpoint('/ai/chat'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.reply !== 'string') {
    throw new Error(payload.error || payload.message || 'AI Reliability Engine tidak mengembalikan respons valid.');
  }
  return payload.reply;
}

// ─── Input Interface untuk Generator ─────────────────────────────────────────

export interface GeneratePredictiveInput {
  sourceDocId: string;
  sourceCollection: 'excel_documents' | 'pdf_documents' | 'findings' | 'cm_reports' | 'corrective_reports';
  sourceTicketNumber?: string;
  sourceMaintenanceName: string;
  sourceMaintenanceDate: string;
  equipmentName: string;
  locationRoom: string;
  descriptionOrSymptoms: string;
  correctiveActionDone?: string;
  recommendation?: string;
  photoEvidenceBase64?: string;
  photoCaption?: string;
  userEmail?: string;
  userName?: string;
}

// ─── Helper Generator Nomor Laporan PdM ──────────────────────────────────────

export function generatePredictiveReportNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const randNum = Math.floor(100 + Math.random() * 900);
  return `PDM/DME-NDC/${year}/${month}/${randNum}`;
}

// ─── Fallback Heuristik Deterministic (Offline / Rate Limit Guard) ────────────

/**
 * Legacy template retained only for backward-compatible historical rendering.
 * Never use it to create a new report: it contains illustrative values, not evidence.
 */
function generateLegacyTemplate(input: GeneratePredictiveInput): PredictiveReportData {
  const text = `${input.equipmentName} ${input.descriptionOrSymptoms} ${input.correctiveActionDone || ''}`.toLowerCase();
  
  let category: PredictiveReportData['systemCategory'] = 'General Facility';
  if (text.includes('pump') || text.includes('pompa') || text.includes('fuel') || text.includes('solar') || text.includes('tangki')) {
    category = 'Fuel System';
  } else if (text.includes('chiller') || text.includes('pac') || text.includes('ahu') || text.includes('cooling') || text.includes('hvac') || text.includes('pipa') || text.includes('leak') || text.includes('bocor')) {
    category = 'HVAC / Cooling';
  } else if (text.includes('trafo') || text.includes('panel') || text.includes('ats') || text.includes('cubicle') || text.includes('lvmdp') || text.includes('busbar') || text.includes('breaker') || text.includes('mcb')) {
    category = 'Electrical Distribution';
  } else if (text.includes('ups') || text.includes('battery') || text.includes('baterai') || text.includes('rectifier') || text.includes('inverter')) {
    category = 'UPS & Battery';
  } else if (text.includes('fire') || text.includes('fm200') || text.includes('smoke') || text.includes('hydrant') || text.includes('apar')) {
    category = 'Fire Protection';
  }

  const isHighSeverity = text.includes('bocor') || text.includes('panas') || text.includes('hotspot') || text.includes('trip') || text.includes('rusak') || text.includes('abnormal') || text.includes('drop') || text.includes('fault');
  const healthStatus: PredictiveReportData['healthStatus'] = isHighSeverity ? 'Warning' : 'Caution';

  const defaultDrift: PredictiveParameterDrift[] = [];
  if (category === 'HVAC / Cooling') {
    defaultDrift.push(
      { parameterName: 'Temperatur Operasional', measuredValue: '18.4', nominalBaseline: '12.0 - 15.0', unit: '°C' },
      { parameterName: 'Tekanan Refrigerant / Aliran', measuredValue: '3.2', nominalBaseline: '4.5 - 5.5', unit: 'Bar' }
    );
  } else if (category === 'Fuel System') {
    defaultDrift.push(
      { parameterName: 'Tekanan Discharge Pompa', measuredValue: '2.1', nominalBaseline: '3.5 - 4.0', unit: 'Bar' },
      { parameterName: 'Level Getaran / Vibrasi Motor', measuredValue: '4.8', nominalBaseline: '< 2.8', unit: 'mm/s' }
    );
  } else if (category === 'Electrical Distribution') {
    defaultDrift.push(
      { parameterName: 'Temperatur Terminasi (Thermal)', measuredValue: '54.2', nominalBaseline: '< 40.0', unit: '°C' },
      { parameterName: 'Grounding Resistance (Ohm)', measuredValue: '1.45', nominalBaseline: '< 2.0', unit: 'Ω' }
    );
  } else {
    defaultDrift.push(
      { parameterName: 'Status Kondisi Fisik & Operasi', measuredValue: 'Indikasi Penurunan', nominalBaseline: 'Normal Fit', unit: 'Index' }
    );
  }

  const defaultSpareparts: PredictiveSparepart[] = [];
  if (category === 'Fuel System') {
    defaultSpareparts.push(
      { partName: 'Mechanical Seal & Gasket Kit', quantity: '1 Set', urgency: 'Critical Backup' },
      { partName: 'Filter Separator Element', quantity: '2 Pcs', urgency: 'Ready Stock' }
    );
  } else if (category === 'HVAC / Cooling') {
    defaultSpareparts.push(
      { partName: 'Pressure Transducer / Flow Switch', quantity: '1 Pcs', urgency: 'Indent Procurement' },
      { partName: 'Valve Actuator Seal Kit', quantity: '1 Set', urgency: 'Ready Stock' }
    );
  } else {
    defaultSpareparts.push(
      { partName: 'Auxiliary Contact & Wiring Harness', quantity: '1 Set', urgency: 'Ready Stock' }
    );
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return {
    id: `PDM_${now.getTime()}`,
    reportNumber: generatePredictiveReportNumber(),
    createdAt: now,
    updatedAt: now,
    createdBy: input.userEmail || 'standby.engineer@dwimitra.com',

    sourceDocId: input.sourceDocId,
    sourceCollection: input.sourceCollection,
    sourceTicketNumber: input.sourceTicketNumber || 'CM-REF-' + now.getTime().toString().slice(-4),
    sourceMaintenanceName: input.sourceMaintenanceName,
    sourceMaintenanceDate: input.sourceMaintenanceDate || dateStr,

    equipmentName: input.equipmentName || 'Critical Infrastructure Unit',
    equipmentTag: `${category.substring(0, 3).toUpperCase()}-UNIT-${now.getTime().toString().slice(-3)}`,
    systemCategory: category,
    locationRoom: input.locationRoom || 'Data Center NeutraDC Cikarang',
    brandModel: 'Standard Data Center Spec',

    healthStatus,
    currentSymptoms: input.descriptionOrSymptoms || 'Terindikasi anomali kerja operasional saat pemantauan berkala.',
    measuredParameterDrift: defaultDrift,
    photoEvidenceBase64: input.photoEvidenceBase64,
    photoCaption: `Foto bukti fisik anomali pada ${input.equipmentName}`,

    aiAnalysis: {
      rootCauseAnalysis: `Berdasarkan parameter anomali "${input.descriptionOrSymptoms}", akar masalah terindikasi berasal dari kelelahan mekanis / degradasi termal material insulasi akibat beban operasional kontinu 24/7.`,
      potentialFailureMode: `Potensi kegagalan berupa macetnya sirkulasi sistem, trip proteksi elektrik mendadak, atau kebocoran fluida yang memicu penurunan efisiensi keandalan.`,
      degradationPattern: `Degradasi berlangsung linier bertahap dan dapat memasuki fase eksponensial (failure curve P-F interval) dalam kurun waktu 1 hingga 3 pekan ke depan jika tidak distabilkan.`,
      remainingUsefulLife: isHighSeverity ? '7 - 14 Hari Kerja' : '21 - 30 Hari Kerja',
      urgencyLevel: isHighSeverity ? 'High' : 'Medium',
      slaRiskAssessment: `Tingkat risiko SLA NeutraDC berada pada kategori TERKENDALI dengan catatan jalur redundansi (N+1) tetap aktif prima. Jika unit redundan ikut mengalami gangguan, berpotensi memicu degradasi layanan data hall.`
    },

    actionPlan: {
      immediateAction: input.correctiveActionDone || 'Lakukan pembersihan area kontak, pengecekan kekencangan torsi baut koneksi, serta penyesuaian kalibrasi batas proteksi sementara.',
      plannedOverhaulAction: input.recommendation || 'Jadwalkan shutdown maintenance terencana untuk rekondisi bearing/seal, pengujian resistansi insulasi, dan pengetesan beban komprehensif bersama tim QC DME.',
      recommendedSpareparts: defaultSpareparts,
      followUpTestingMethods: ['Thermography Infrared Scanning', 'Vibration Amplitude Monitoring', 'Acoustic / Visual Leakage Inspection']
    },

    signatures: {
      authorName: 'Rizki Novri Yanda – Data Center Operation',
      preparedBy: {
        name: input.userName || 'Asep Mohammad Fauzi',
        title: '(Electrical Engineer)',
        signatureBase64:
          cleanSignature(PREPARED_BY_SIGNATURES[input.userName || 'Asep Mohammad Fauzi']) ||
          getEngineerSignature(input.userName || 'Asep Mohammad Fauzi') ||
          ASEP_SIGNATURE_BASE64,
        date: dateStr,
      },
      reviewedBy: {
        name: 'Arif Budiman',
        title: '(Technical Manager)',
        signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
        date: dateStr,
      },
      verifiedBy: {
        name: 'Arif Budiman',
        title: '(Technical Manager)',
        signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
        date: dateStr,
      },
      acknowledgedBy1: {
        name: 'Habib Mulyana',
        title: '(Chief Engineer)',
        signatureBase64: '',
        date: dateStr,
      },
      acknowledgedBy2: {
        name: 'Supriyatno',
        title: '(Facility manager)',
        signatureBase64: '',
        date: dateStr,
      },
      approvedBy: {
        name: 'Budi Susanto',
        title: '(Assistant manager HDC Facility Management)',
        signatureBase64: '',
        date: dateStr,
      },
    }
  };
}

// ─── AI Pipeline Execution ──────────────────────────────────────────────────

function buildEvidenceLimitedReport(input: GeneratePredictiveInput, reason: string): PredictiveReportData {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hasSymptom = Boolean(input.descriptionOrSymptoms?.trim());
  const hasAction = Boolean(input.correctiveActionDone?.trim());
  const evidenceQuality: PredictiveAnalysisMetadata['evidenceQuality'] = hasSymptom && hasAction ? 'Terbatas' : 'Tidak Memadai';
  const metadata: PredictiveAnalysisMetadata = {
    evidenceQuality,
    confidenceLevel: 'Rendah',
    requiresFieldVerification: true,
    generatedAt: now.toISOString(),
    evidenceReferences: [
      {
        sourceType: input.sourceCollection === 'findings' ? 'Temuan Abnormal' : 'Corrective Maintenance',
        reference: `${input.sourceMaintenanceName || 'Dokumen sumber'}${input.sourceTicketNumber ? ` / ${input.sourceTicketNumber}` : ''}`,
        observation: input.descriptionOrSymptoms || 'Tidak ada deskripsi gejala yang tercatat.',
        usedFor: 'Identifikasi awal anomali',
      },
      ...(input.photoEvidenceBase64 ? [{
        sourceType: 'Foto Inspeksi' as const,
        reference: input.photoCaption || 'Foto bukti terlampir',
        observation: 'Bukti visual tersedia; perlu verifikasi kondisi dan waktu pengambilan di lapangan.',
        usedFor: 'Verifikasi visual',
      }] : []),
    ],
    dataLimitations: [
      'Tidak ada tren pengukuran serial dengan timestamp, sehingga nilai parameter dan RUL tidak boleh diestimasi.',
      'Baseline OEM/as-built, tag aset, dan riwayat umur komponen belum tersedia pada dokumen sumber.',
      reason,
    ],
  };

  return {
    id: `PDM_${now.getTime()}`,
    reportNumber: generatePredictiveReportNumber(),
    createdAt: now,
    updatedAt: now,
    createdBy: input.userEmail || 'standby.engineer@dwimitra.com',
    sourceDocId: input.sourceDocId,
    sourceCollection: input.sourceCollection,
    sourceTicketNumber: input.sourceTicketNumber,
    sourceMaintenanceName: input.sourceMaintenanceName,
    sourceMaintenanceDate: input.sourceMaintenanceDate || date,
    equipmentName: input.equipmentName || 'Peralatan belum teridentifikasi',
    systemCategory: 'General Facility',
    locationRoom: input.locationRoom || 'Lokasi belum tercatat',
    healthStatus: 'Caution',
    currentSymptoms: input.descriptionOrSymptoms || 'Data gejala belum cukup untuk analisis.',
    measuredParameterDrift: [],
    photoEvidenceBase64: input.photoEvidenceBase64,
    photoCaption: input.photoCaption,
    aiAnalysis: {
      rootCauseAnalysis: 'Belum dapat dikonfirmasi. Dokumen sumber hanya mendukung hipotesis awal dan memerlukan inspeksi serta pengukuran lapangan.',
      potentialFailureMode: 'Belum dapat dipastikan tanpa verifikasi teknis terhadap kondisi, baseline, dan riwayat aset.',
      degradationPattern: 'Tidak dapat ditentukan karena tren parameter bertimestamp belum tersedia.',
      remainingUsefulLife: 'Tidak dapat diestimasi — data tren pengukuran belum memadai.',
      urgencyLevel: 'Medium',
      slaRiskAssessment: 'Dampak SLA belum dapat dikuantifikasi. Verifikasi redundansi dan kondisi unit terkait sebelum menetapkan risiko.',
    },
    actionPlan: {
      immediateAction: input.correctiveActionDone || 'Amankan kondisi, catat parameter aktual, dan lakukan inspeksi oleh engineer kompeten.',
      plannedOverhaulAction: input.recommendation || 'Tentukan tindakan definitif setelah baseline OEM dan tren pengukuran tervalidasi.',
      recommendedSpareparts: [],
      followUpTestingMethods: ['Kumpulkan minimal tiga pembacaan parameter bertimestamp', 'Verifikasi baseline OEM/as-built', 'Inspeksi dan validasi engineer kompeten'],
    },
    analysisMetadata: metadata,
    signatures: {
      preparedBy: { name: input.userName || 'Standby Engineer', title: '(Engineer)', date },
      approvedBy: { name: '', title: '(Menunggu review)', date },
    },
  };
}

export async function generatePredictiveReportAI(
  input: GeneratePredictiveInput,
  onProgress?: (message: string) => void
): Promise<PredictiveReportData> {
  onProgress?.('Menginisialisasi AI Reliability Engineering Agent...');

  const systemPrompt = `Anda adalah Lead Reliability & Predictive Maintenance Engineer berpengalaman untuk Data Center NeutraDC Cikarang (Tier 3/4 Mission-Critical Facility) yang bekerja untuk PT Dwimitra Ekatama Mandiri.
Tugas Anda adalah menganalisis temuan kerusakan/abnormalitas operasional atau laporan Corrective Maintenance (CM), lalu menyusun LAPORAN PREDICTIVE MAINTENANCE (PdM) komprehensif berbasis standar keandalan (RCM, FMEA, P-F Interval, dan Uptime Institute Data Center Guidelines).

Instruksi Output:
- Berikan respon HANYA dalam format JSON valid tanpa tanda markdown (tanpa \`\`\`json atau teks pengantar apapun).
- Gunakan Bahasa Indonesia teknis yang formal, lugas, profesional, dan otoritatif.
- HANYA gunakan fakta yang eksplisit ada di DATA SUMBER. Jangan menciptakan angka pengukuran, baseline, tag aset, merek/model, part number, stok, status redundansi, atau nilai SLA.
- Jika data tren pengukuran bertimestamp, baseline OEM/as-built, atau riwayat komponen tidak tersedia, nyatakan keterbatasan tersebut secara eksplisit. Dalam kondisi itu, measuredParameterDrift WAJIB [], RUL WAJIB "Tidak dapat diestimasi — data tren pengukuran belum memadai", dan rekomendasi sparepart WAJIB [].
- Bedakan "fakta sumber" dengan "hipotesis teknis". Hipotesis tidak boleh ditulis sebagai kepastian dan wajib meminta verifikasi engineer.
- Jangan memakai pengetahuan umum, standar, atau nama vendor sebagai sumber faktual kecuali dokumen tersebut diberikan pada DATA SUMBER.

Struktur JSON yang WAJIB dipatuhi:
{
  "equipmentTag": "kode tag unit e.g. PUMP-FS-02 / CH-03-A / TRF-B",
  "systemCategory": "Fuel System" | "HVAC / Cooling" | "Electrical Distribution" | "UPS & Battery" | "Fire Protection" | "General Facility",
  "brandModel": "merek / model peralatan yang relevan",
  "healthStatus": "Critical" | "Warning" | "Caution",
  "currentSymptoms": "deskripsi gejala kerusakan dan indikator fisik/suara/suhu/aliran",
  "measuredParameterDrift": [
    { "parameterName": "Nama Parameter", "measuredValue": "Nilai Terukur", "nominalBaseline": "Nilai Standar Normal", "unit": "Satuan" }
  ],
  "aiAnalysis": {
    "rootCauseAnalysis": "Analisis teknis penyebab akar masalah",
    "potentialFailureMode": "Modus kegagalan spesifik jika tidak ditangani",
    "degradationPattern": "Pola laju keausan / degradasi komponen",
    "remainingUsefulLife": "Estimasi sisa umur pakai sebelum failure fatal, misal: '7 - 14 Hari'",
    "urgencyLevel": "Emergency" | "High" | "Medium" | "Low",
    "slaRiskAssessment": "Analisis dampak ke SLA ketersediaan 99.982% NeutraDC dan skenario redundansi N+1"
  },
  "actionPlan": {
    "immediateAction": "Tindakan pencegahan dan pengawasan ketat jangka pendek (1 - 7 hari)",
    "plannedOverhaulAction": "Rencana tindakan definitif penggantian/overhaul terencana (2 - 4 minggu)",
    "recommendedSpareparts": [
      { "partName": "Nama Komponen / Sparepart", "partNumber": "Nomor Part", "quantity": "Jumlah", "urgency": "Ready Stock" | "Indent Procurement" | "Critical Backup" }
    ],
    "followUpTestingMethods": [
      "Metode Pengujian 1", "Metode Pengujian 2"
    ]
  },
  "analysisMetadata": {
    "evidenceReferences": [{ "sourceType": "Corrective Maintenance", "reference": "nomor/judul sumber", "observation": "kutipan fakta dari sumber", "usedFor": "bagian analisis yang didukung" }],
    "evidenceQuality": "Memadai" | "Terbatas" | "Tidak Memadai",
    "confidenceLevel": "Tinggi" | "Sedang" | "Rendah",
    "dataLimitations": ["data yang belum tersedia"],
    "requiresFieldVerification": true
  }
}`;

  const userPrompt = `Analisis temuan abnormal / Corrective Maintenance berikut untuk fasilitas Data Center NeutraDC Cikarang:
- Nama Unit / Peralatan: ${input.equipmentName}
- Ruang / Lokasi: ${input.locationRoom}
- Dokumen Sumber: ${input.sourceMaintenanceName} (${input.sourceCollection})
- Nomor Referensi: ${input.sourceTicketNumber || 'Tidak tercatat'}
- Tanggal Sumber: ${input.sourceMaintenanceDate || 'Tidak tercatat'}
- Gejala / Deskripsi Temuan: ${input.descriptionOrSymptoms}
- Tindakan CM Yang Sudah Diambil: ${input.correctiveActionDone || 'Pemeriksaan awal lapangan'}
- Catatan Rekomendasi Awal: ${input.recommendation || 'Perlu pemantauan prediktif lanjutan'}

Semua pernyataan harus dapat ditelusuri ke data di atas. Jika data belum cukup untuk prediksi, hasilkan laporan evidence-limited, bukan angka atau detail rekaan.`;

  try {
    onProgress?.('Mengirim data ke AI Reliability Engine...');
    const rawResponse = await callReliabilityAI(systemPrompt, userPrompt);

    onProgress?.('Menyusun struktur laporan prediktif...');

    let cleaned = rawResponse.trim();
    if (cleaned.includes('</think>')) {
      cleaned = cleaned.split('</think>')[1].trim();
    }
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

    const parsed = JSON.parse(cleaned);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const result: PredictiveReportData = {
      id: `PDM_${now.getTime()}`,
      reportNumber: generatePredictiveReportNumber(),
      createdAt: now,
      updatedAt: now,
      createdBy: input.userEmail || 'standby.engineer@dwimitra.com',

      sourceDocId: input.sourceDocId,
      sourceCollection: input.sourceCollection,
      sourceTicketNumber: input.sourceTicketNumber || 'CM-' + now.getTime().toString().slice(-4),
      sourceMaintenanceName: input.sourceMaintenanceName,
      sourceMaintenanceDate: input.sourceMaintenanceDate || dateStr,

      equipmentName: input.equipmentName || 'Equipment Unit',
      equipmentTag: parsed.equipmentTag || undefined,
      systemCategory: parsed.systemCategory || 'General Facility',
      locationRoom: input.locationRoom || 'Data Center NeutraDC Cikarang',
      brandModel: parsed.brandModel || undefined,

      healthStatus: parsed.healthStatus || 'Warning',
      currentSymptoms: parsed.currentSymptoms || input.descriptionOrSymptoms,
      // This input has no structured measurements. Never present model-generated values as readings.
      measuredParameterDrift: [],
      photoEvidenceBase64: input.photoEvidenceBase64,
      photoCaption: `Foto bukti fisik anomali pada ${input.equipmentName}`,

      aiAnalysis: {
        rootCauseAnalysis: parsed.aiAnalysis?.rootCauseAnalysis || 'Belum dapat dikonfirmasi dari data sumber.',
        potentialFailureMode: parsed.aiAnalysis?.potentialFailureMode || 'Belum dapat dipastikan dari data sumber.',
        degradationPattern: parsed.aiAnalysis?.degradationPattern || 'Tidak dapat ditentukan karena tren parameter belum tersedia.',
        remainingUsefulLife: 'Tidak dapat diestimasi — data tren pengukuran belum memadai.',
        urgencyLevel: parsed.aiAnalysis?.urgencyLevel || 'Medium',
        slaRiskAssessment: parsed.aiAnalysis?.slaRiskAssessment || 'Dampak SLA belum dapat dikuantifikasi dari data sumber.'
      },

      actionPlan: {
        immediateAction: parsed.actionPlan?.immediateAction || 'Lakukan monitoring ketat suhu dan getaran harian.',
        plannedOverhaulAction: parsed.actionPlan?.plannedOverhaulAction || 'Jadwalkan perbaikan terencana dengan tim spesialis DME.',
        recommendedSpareparts: [],
        followUpTestingMethods: parsed.actionPlan?.followUpTestingMethods || ['Thermography Infrared', 'Visual Inspection']
      },

      analysisMetadata: {
        evidenceReferences: Array.isArray(parsed.analysisMetadata?.evidenceReferences)
          ? parsed.analysisMetadata.evidenceReferences
          : buildEvidenceLimitedReport(input, 'Referensi bukti dari AI tidak lengkap.').analysisMetadata!.evidenceReferences,
        evidenceQuality: parsed.analysisMetadata?.evidenceQuality || 'Terbatas',
        confidenceLevel: parsed.analysisMetadata?.confidenceLevel || 'Rendah',
        dataLimitations: Array.isArray(parsed.analysisMetadata?.dataLimitations)
          ? parsed.analysisMetadata.dataLimitations
          : ['Tidak ada tren pengukuran bertimestamp; RUL, parameter drift, dan kebutuhan sparepart memerlukan verifikasi lapangan.'],
        requiresFieldVerification: true,
        generatedAt: now.toISOString(),
      },
      signatures: {
        authorName: 'Rizki Novri Yanda – Data Center Operation',
        preparedBy: {
          name: input.userName || 'Asep Mohammad Fauzi',
          title: '(Electrical Engineer)',
          signatureBase64:
            cleanSignature(PREPARED_BY_SIGNATURES[input.userName || 'Asep Mohammad Fauzi']) ||
            getEngineerSignature(input.userName || 'Asep Mohammad Fauzi') ||
            ASEP_SIGNATURE_BASE64,
          date: dateStr,
        },
        reviewedBy: {
          name: 'Arif Budiman',
          title: '(Technical Manager)',
          signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
          date: dateStr,
        },
        verifiedBy: {
          name: 'Arif Budiman',
          title: '(Technical Manager)',
          signatureBase64: ARIF_BUDIMAN_SIGNATURE_BASE64,
          date: dateStr,
        },
        acknowledgedBy1: {
          name: 'Habib Mulyana',
          title: '(Chief Engineer)',
          signatureBase64: '',
          date: dateStr,
        },
        acknowledgedBy2: {
          name: 'Supriyatno',
          title: '(Facility manager)',
          signatureBase64: '',
          date: dateStr,
        },
        approvedBy: {
          name: 'Budi Susanto',
          title: '(Assistant manager HDC Facility Management)',
          signatureBase64: '',
          date: dateStr,
        },
      }
    };

    onProgress?.('Laporan Prediktif AI siap ditampilkan!');
    return result;
  } catch (error: any) {
    console.error('AI Predictive Agent error:', error);
    onProgress?.('Data AI tidak tersedia; membuat laporan dengan batasan bukti yang jelas...');
    return buildEvidenceLimitedReport(input, 'AI tidak tersedia atau responsnya tidak valid; tidak ada nilai rekaan yang digunakan.');
  }
}
