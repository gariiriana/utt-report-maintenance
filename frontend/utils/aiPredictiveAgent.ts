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
 * Deprecated compatibility template. New report generation below uses the
 * evidence-limited fallback so no illustrative readings are emitted.
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
      rootCauseAnalysis: `Berdasarkan evaluasi teknis mendalam terhadap indikasi "${input.descriptionOrSymptoms}", akar masalah teridentifikasi pada penurunan performa material dan integritas komponen akibat siklus pembebanan kontinu 24/7 di Data Center NeutraDC Cikarang. Stres operasional berkelanjutan memicu akumulasi resistansi kontak abnormal, keausan mekanis permukaan (fretting wear), serta degradasi dielektrik insulasi yang berakibat pada kenaikan rugi-rugi disipasi daya lokal dan penyimpangan titik kerja unit dari kurva efisiensi desain OEM.`,
      potentialFailureMode: `Apabila anomali ini dibiarkan tanpa stabilisasi terarah, modus kegagalan diperkirakan akan bereskalasi dari deviasi parameter menuju kegagalan fungsional menyeluruh (functional failure). Eskalasi dapat berupa thermal runaway pada titik sambungan kritis, trip proteksi arus lebih/undervoltage secara mendadak, atau kerusakan katastropik mekanikal yang memicu hilangnya suplai daya/pendinginan pada jalur terkait secara seketika.`,
      remainingUsefulLife: isHighSeverity ? '7 - 14 Hari Kalender (Perlu Intervensi Segera)' : '21 - 30 Hari Kalender (Kondisi Waspada)',
      urgencyLevel: isHighSeverity ? 'High' : 'Medium',
      slaRiskAssessment: `Tingkat risiko terhadap target ketersediaan 99.982% Data Center NeutraDC berada dalam status kewaspadaan tinggi. Meskipun skenario redundansi (N+1 / 2N) saat ini masih aktif menopang beban server, hilangnya margin keandalan pada unit ini mengeliminasi tingkat toleransi kesalahan (fault tolerance). Gangguan simultan pada unit pasangan akan langsung berdampak pada parameter lingkungan data hall dan berisiko memicu pelanggaran SLA layanan.`
    },

    actionPlan: {
      immediateAction: input.correctiveActionDone || 'Lakukan pembersihan komprehensif, pengecekan kekencangan torsi baut koneksi menggunakan torque wrench terkalibrasi, pemindaian termografi inframerah berkala per 4 jam, serta verifikasi kesiapan operasi 100% pada unit cadangan redundan.',
      plannedOverhaulAction: input.recommendation || 'Jadwalkan maintenance window terencana untuk penggantian komponen aus, pengetesan resistansi insulasi (Megger Test), rekondisi mekanikal/kelistrikan, dan load test menyeluruh bersama tim QC DME sebelum serah terima operasional.',
      recommendedSpareparts: defaultSpareparts,
      followUpTestingMethods: ['Thermography Infrared FLIR Scanning', 'Vibration Spectrum Analysis (ISO 10816-3)', 'Megger Insulation Resistance Test (1000V DC)', 'Power Quality & Harmonic Distortion Analysis']
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

export function buildEvidenceLimitedReport(input: GeneratePredictiveInput, reason: string): PredictiveReportData {
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
      'Data tren serial bertimestamp, baseline OEM, jam operasi, dan konfigurasi redundansi tidak tersedia pada dokumen sumber.',
      'Tidak ada nilai pengukuran atau nomor suku cadang yang dapat divalidasi dari data sumber yang diterima.',
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
    equipmentName: input.equipmentName || 'Peralatan Data Center',
    systemCategory: 'General Facility',
    locationRoom: input.locationRoom || 'Data Center NeutraDC Cikarang',
    healthStatus: 'Caution',
    currentSymptoms: input.descriptionOrSymptoms || 'Tidak ada gejala teknis yang dicatat pada dokumen sumber.',
    measuredParameterDrift: [],
    photoEvidenceBase64: input.photoEvidenceBase64,
    photoCaption: input.photoCaption,
    aiAnalysis: {
      rootCauseAnalysis: `Fakta yang tersedia hanya mencatat: "${input.descriptionOrSymptoms || 'tidak ada gejala teknis yang dicatat'}". Akar penyebab belum dapat ditetapkan secara engineering tanpa inspeksi, riwayat gangguan, data tren, dan baseline OEM. Investigasi perlu dimulai dari verifikasi kondisi yang tercatat pada dokumen sumber, lalu pengukuran parameter yang relevan pada unit tersebut.`,
      potentialFailureMode: 'Modus kegagalan belum dapat dipastikan dari satu catatan temuan. Setelah mekanisme anomali tervalidasi di lapangan, tim dapat menyusun failure mode, P-F interval, dan dampak ke subsistem terkait berdasarkan konfigurasi aktual.',
      remainingUsefulLife: 'Belum dapat diestimasi; data tren, jam operasi, dan baseline penerimaan tidak tersedia.',
      urgencyLevel: 'Medium',
      slaRiskAssessment: 'Dampak terhadap SLA belum dapat dikuantifikasi dari dokumen sumber. Status redundansi, beban aktual, jalur distribusi, dan unit cadangan harus diverifikasi sebelum menyimpulkan risiko layanan atau adanya single point of failure.',
    },
    actionPlan: {
      immediateAction: input.correctiveActionDone || 'Verifikasi kembali kondisi yang dicatat pada temuan, dokumentasikan parameter aktual, dan eskalasi sesuai prosedur operasi apabila ditemukan kondisi tidak aman.',
      plannedOverhaulAction: input.recommendation || 'Susun scope inspeksi berbasis hasil verifikasi lapangan dan dokumen OEM sebelum menetapkan pekerjaan overhaul atau penggantian komponen.',
      recommendedSpareparts: [],
      followUpTestingMethods: ['Inspeksi visual terstruktur dan verifikasi terhadap dokumen OEM', 'Pencatatan parameter operasi sesuai jenis peralatan', 'Analisis tren setelah data pengukuran mencukupi'],
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

  const systemPrompt = `Anda adalah Senior Lead Reliability & Predictive Maintenance Specialist untuk Fasilitas Data Center Tier III/IV NeutraDC Cikarang (bekerja untuk PT Dwimitra Ekatama Mandiri / PT United Transworld Trading).
Tugas Anda adalah menganalisis temuan kerusakan/anomali operasional atau laporan Corrective Maintenance (CM), lalu menyusun LAPORAN PREDICTIVE MAINTENANCE (PdM) yang SANGAT PROFESIONAL, KOMPREHENSIF, MENDALAM, DAN BERBOBOT TEKNIS TINGGI berbasis standar keandalan (RCM, FMEA, P-F Interval, ISO 14224, IEEE, dan Uptime Institute Data Center Guidelines).

PRINSIP INTEGRITAS DATA — PRIORITAS TERTINGGI:
- Gunakan HANYA fakta yang tercantum dalam DATA SUMBER di bawah. Jangan mengisi celah data dengan asumsi, pengalaman umum, atau angka ilustratif.
- Jangan menciptakan nilai ukur, baseline, merk/model, equipment tag, nomor part, kuantitas, jam operasi, tren, konfigurasi N+1/2N, status unit cadangan, SLA aktual, atau hasil inspeksi yang tidak tersedia di sumber.
- Pisahkan tegas **Fakta terverifikasi** dari **Hipotesis teknis yang perlu diverifikasi**. Hipotesis boleh menjelaskan mekanisme kegagalan yang relevan, tetapi wajib memakai kata "kemungkinan", "perlu diverifikasi", atau "belum dapat dipastikan" dan tidak boleh dipresentasikan sebagai fakta.
- Jika data tidak cukup untuk root cause, failure mode, RUL, atau dampak SLA, nyatakan keterbatasannya secara eksplisit dan sebutkan data/pengujian yang diperlukan. Jangan membuat estimasi waktu atau tingkat risiko palsu.
- Isi measuredParameterDrift HANYA bila DATA SUMBER memuat nilai aktual DAN baseline/rujukan yang jelas; selain itu gunakan array kosong. Isi recommendedSpareparts HANYA bila nama/nomor part serta kuantitas disebut dalam sumber atau dokumen OEM yang disertakan; selain itu gunakan array kosong.
- Setiap evidenceReferences.observation wajib berupa fakta atau kutipan ringkas dari DATA SUMBER, bukan hasil rekaan. Rekomendasi pengujian boleh bersifat usulan, bukan klaim bahwa pengujian sudah dilakukan.

KRITERIA DAN PANDUAN JAWABAN (WAJIB DIPATUHI):
1. **Bahasa & Tone**: Gunakan Bahasa Indonesia teknis teknik keandalan data center yang baku, formal, berbobot, terstruktur rapi, dan otoritatif.
2. **Kualitas & Panjang Jawaban**:
   - Berikan analisis yang MENDALAM, MANTAP, dan LENGKAP (bukan kalimat singkat 1 baris!), namun kedalaman penjelasan tidak boleh mengalahkan integritas data.
   - Pada "rootCauseAnalysis": Jelaskan secara mendalam mekanisme fisika/elektrikal/mekanikal terjadinya anomali (misal: fretting wear, dielectric insulation breakdown, micro-pitting kontak, thermal runaway, harmonic stress, kavitasi, unbalance) dalam konteks pengoperasian kontinu 24/7 di Data Center NeutraDC Cikarang (minimal 2 paragraf berbobot).
   - Pada "potentialFailureMode": Jelaskan secara kronologis tahapan progresi kegagalan (P-F Interval Curve), potensi efek domino (cascading failure) ke subsistem hilir data hall/server rack, serta skenario terburuk jika penanganan tertunda (minimal 2 paragraf berbobot).
   - Pada "remainingUsefulLife": Berikan estimasi sisa umur pakai hanya jika sumber memiliki tren bertimestamp, jam operasi, dan parameter pendukung. Jika tidak, tulis "Belum dapat diestimasi" beserta data yang diperlukan.
   - Pada "slaRiskAssessment": Berikan analisis mendalam mengenai risiko terhadap komitmen Uptime SLA NeutraDC (99.982% availability), arsitektur redundansi fasilitas (N+1 / 2N), serta potensi single point of failure (SPOF) sementara jika unit cadangan ikut terbebani.
   - Pada "immediateAction": Berikan prosedur teknis mitigasi taktis 0-48 jam yang sangat spesifik dan aplikatif di lapangan.
   - Pada "plannedOverhaulAction": Berikan langkah-langkah terencana maintenance window 1-3 minggu yang terperinci.
   - Pada "recommendedSpareparts": Jangan mengarang part name, part number, kuantitas, atau urgensi. Gunakan array kosong bila belum ada rujukan sumber/OEM.
   - Pada "followUpTestingMethods": Berikan minimal 3-4 metode pengujian NDT lanjutan yang akurat (seperti Thermography Infrared FLIR, Vibration Spectrum Analysis ISO 10816, Megger Insulation Test, dsb).
3. **Format Output**:
   - Berikan respon HANYA dalam format JSON valid tanpa tanda markdown (tanpa \`\`\`json atau teks pengantar apapun).
   - JANGAN sertakan field "degradationPattern" di dalam JSON (field ini sudah dihapus dari standar laporan).

Struktur JSON yang WAJIB dipatuhi:
{
  "equipmentTag": "kode tag unit e.g. PUMP-FS-02 / CH-03-A / TRF-B",
  "systemCategory": "Fuel System" | "HVAC / Cooling" | "Electrical Distribution" | "UPS & Battery" | "Fire Protection" | "General Facility",
  "brandModel": "merek / model peralatan yang relevan",
  "healthStatus": "Critical" | "Warning" | "Caution",
  "currentSymptoms": "deskripsi komprehensif gejala kerusakan dan indikator fisik/suara/suhu/aliran",
  "measuredParameterDrift": [
    { "parameterName": "Nama Parameter", "measuredValue": "Nilai Terukur", "nominalBaseline": "Nilai Standar Normal", "unit": "Satuan" }
  ],
  "aiAnalysis": {
    "rootCauseAnalysis": "Analisis teknis penyebab akar masalah yang mendalam, terperinci, dan komprehensif (2-3 paragraf berbobot)",
    "potentialFailureMode": "Uraian tahapan progresi modus kegagalan dan dampak cascading failure (2-3 paragraf berbobot)",
    "remainingUsefulLife": "Estimasi sisa umur pakai operasional dengan justifikasi teknis (e.g. '7 - 14 Hari Kalender')",
    "urgencyLevel": "Emergency" | "High" | "Medium" | "Low",
    "slaRiskAssessment": "Analisis dampak mendalam ke SLA ketersediaan 99.982% NeutraDC dan skenario redundansi N+1 / 2N"
  },
  "actionPlan": {
    "immediateAction": "Prosedur taktis pencegahan dan pengawasan ketat jangka pendek (1 - 7 hari) yang terperinci",
    "plannedOverhaulAction": "Rencana tindakan definitif penggantian/overhaul terencana (2 - 4 minggu) yang terstruktur",
    "recommendedSpareparts": [
      { "partName": "Nama Komponen / Sparepart", "partNumber": "Nomor Part", "quantity": "Jumlah", "urgency": "Ready Stock" | "Indent Procurement" | "Critical Backup" }
    ],
    "followUpTestingMethods": [
      "Metode Pengujian 1", "Metode Pengujian 2", "Metode Pengujian 3"
    ]
  },
  "analysisMetadata": {
    "evidenceReferences": [{ "sourceType": "Corrective Maintenance", "reference": "nomor/judul sumber", "observation": "kutipan fakta dari sumber", "usedFor": "bagian analisis yang didukung" }],
    "evidenceQuality": "Memadai" | "Terbatas" | "Tidak Memadai",
    "confidenceLevel": "Tinggi" | "Sedang" | "Rendah",
    "dataLimitations": ["keterbatasan data"],
    "requiresFieldVerification": true
  }
}`;

  const userPrompt = `Lakukan analisis prediktif keandalan tingkat tinggi untuk fasilitas Data Center NeutraDC Cikarang berdasarkan data temuan pemeliharaan berikut:
- Nama Unit / Peralatan: ${input.equipmentName}
- Ruang / Lokasi: ${input.locationRoom}
- Dokumen Sumber: ${input.sourceMaintenanceName} (${input.sourceCollection})
- Nomor Referensi: ${input.sourceTicketNumber || 'Tidak tercatat'}
- Tanggal Sumber: ${input.sourceMaintenanceDate || 'Tidak tercatat'}
- Gejala / Deskripsi Temuan: ${input.descriptionOrSymptoms}
- Tindakan CM Yang Sudah Diambil: ${input.correctiveActionDone || 'Pemeriksaan awal lapangan'}
- Catatan Rekomendasi Awal: ${input.recommendation || 'Perlu pemantauan prediktif lanjutan'}

BATAS DATA: daftar di atas adalah satu-satunya bukti yang boleh dipakai. Tidak ada data pengukuran, tren, baseline OEM, riwayat jam operasi, konfigurasi redundansi, ataupun nomor part lain yang boleh diasumsikan tersedia. Susun laporan profesional yang evidence-based: gunakan analisis teknis sebagai hipotesis bersyarat bila bukti tidak cukup, bukan sebagai fakta.

Jawaban harus terperinci dan mencakup Root Cause Analysis, Potential Failure Mode, RUL, dan SLA Risk Assessment sesuai tingkat bukti yang benar-benar tersedia.`;

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

    // Semua field yang tidak dapat dibuktikan memakai fallback berbasis bukti,
    // bukan template ilustratif dengan angka/komponen yang dibuat-buat.
    const fallbackTemplate = buildEvidenceLimitedReport(input, 'Respons AI tidak menyediakan data pendukung yang dapat diverifikasi untuk field ini.');

    const result: PredictiveReportData = {
      id: `PDM_${now.getTime()}`,
      reportNumber: generatePredictiveReportNumber(),
      createdAt: now,
      updatedAt: now,
      createdBy: input.userEmail || 'standby.engineer@dwimitra.com',

      sourceDocId: input.sourceDocId,
      sourceCollection: input.sourceCollection,
      sourceTicketNumber: input.sourceTicketNumber,
      sourceMaintenanceName: input.sourceMaintenanceName,
      sourceMaintenanceDate: input.sourceMaintenanceDate || dateStr,

      equipmentName: input.equipmentName || 'Equipment Unit',
      equipmentTag: undefined,
      systemCategory: ['Fuel System', 'HVAC / Cooling', 'Electrical Distribution', 'UPS & Battery', 'Fire Protection', 'General Facility'].includes(parsed.systemCategory)
        ? parsed.systemCategory
        : fallbackTemplate.systemCategory,
      locationRoom: input.locationRoom || 'Data Center NeutraDC Cikarang',
      brandModel: undefined,

      healthStatus: ['Critical', 'Warning', 'Caution'].includes(parsed.healthStatus) ? parsed.healthStatus : 'Caution',
      currentSymptoms: input.descriptionOrSymptoms || fallbackTemplate.currentSymptoms,
      measuredParameterDrift: [],
      photoEvidenceBase64: input.photoEvidenceBase64,
      photoCaption: `Foto bukti fisik anomali pada ${input.equipmentName}`,

      aiAnalysis: {
        rootCauseAnalysis: parsed.aiAnalysis?.rootCauseAnalysis || fallbackTemplate.aiAnalysis.rootCauseAnalysis,
        potentialFailureMode: parsed.aiAnalysis?.potentialFailureMode || fallbackTemplate.aiAnalysis.potentialFailureMode,
        remainingUsefulLife: parsed.aiAnalysis?.remainingUsefulLife || fallbackTemplate.aiAnalysis.remainingUsefulLife,
        urgencyLevel: parsed.aiAnalysis?.urgencyLevel || fallbackTemplate.aiAnalysis.urgencyLevel,
        slaRiskAssessment: parsed.aiAnalysis?.slaRiskAssessment || fallbackTemplate.aiAnalysis.slaRiskAssessment
      },

      actionPlan: {
        immediateAction: parsed.actionPlan?.immediateAction || fallbackTemplate.actionPlan.immediateAction,
        plannedOverhaulAction: parsed.actionPlan?.plannedOverhaulAction || fallbackTemplate.actionPlan.plannedOverhaulAction,
        recommendedSpareparts: [],
        followUpTestingMethods: Array.isArray(parsed.actionPlan?.followUpTestingMethods) && parsed.actionPlan.followUpTestingMethods.length > 0
          ? parsed.actionPlan.followUpTestingMethods
          : fallbackTemplate.actionPlan.followUpTestingMethods
      },

      analysisMetadata: {
        evidenceReferences: fallbackTemplate.analysisMetadata!.evidenceReferences,
        evidenceQuality: fallbackTemplate.analysisMetadata!.evidenceQuality,
        confidenceLevel: fallbackTemplate.analysisMetadata!.confidenceLevel,
        dataLimitations: fallbackTemplate.analysisMetadata!.dataLimitations,
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

    onProgress?.('Analisis prediktif berhasil disintesis!');
    return result;
  } catch (err: any) {
    console.error('generatePredictiveReportAI error:', err);
    onProgress?.('AI Cloud mengalami kendala, membuat laporan berbasis bukti yang tersedia...');
    return buildEvidenceLimitedReport(input, 'Analisis AI tidak tersedia; tidak ada kesimpulan teknis tambahan yang dibuat tanpa bukti.');
  }
}
