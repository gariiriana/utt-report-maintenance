// ============================================================================
// FILE: frontend/utils/aiPeriodicPredictiveAgent.ts
// Deskripsi: AI Reliability Engineering Agent untuk Analisis & Pembuatan
//            Laporan Predictive Maintenance (PdM) Periodik (Bulanan & Tahunan)
//            Data Center NeutraDC Cikarang — PT Dwimitra Ekatama Mandiri.
// ============================================================================

import {
  PeriodicPredictiveReportData,
  PeriodicScope,
  SystemAssessment,
  BadActorAsset,
  PeriodicSparepartForecast,
  PeriodicActionPlan
} from '@/types/periodicPredictiveTypes';

// ─── Environment & API Key Management ────────────────────────────────────────

const apiKeysStr = import.meta.env.VITE_NVIDIA_NIM_API_KEYS || '';
const apiKeys = apiKeysStr.split(',').map((k: string) => k.trim()).filter(Boolean);
const reasoningModel = import.meta.env.VITE_NVIDIA_NIM_REASONING_MODEL || 'gemini-1.5-flash';

let keyIndex = 0;
function getNextAPIKey(): string {
  if (apiKeys.length === 0) {
    throw new Error('API Keys tidak terkonfigurasi. Periksa VITE_NVIDIA_NIM_API_KEYS.');
  }
  const key = apiKeys[keyIndex % apiKeys.length];
  keyIndex++;
  return key;
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function callGeminiAPI(
  apiKey: string,
  model: string,
  messages: any[],
  temperature = 0.2,
  maxTokens = 4096
): Promise<string> {
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: 0.9,
    stream: false,
  };

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
      throw new RateLimitError(`API rate limit exceeded (${response.status}): ${errText}`);
    }
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('AI API tidak mengembalikan respon.');
  }

  return data.choices[0].message.content || '';
}

async function callWithFailover(
  model: string,
  messages: any[],
  temperature = 0.2,
  maxTokens = 4096
): Promise<string> {
  const totalKeys = apiKeys.length;
  if (totalKeys === 0) {
    throw new Error('Tidak ada API key yang terkonfigurasi.');
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const apiKey = getNextAPIKey();
    try {
      return await callGeminiAPI(apiKey, model, messages, temperature, maxTokens);
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        console.warn(`API Key #${(keyIndex - 1) % totalKeys} limit, mencoba key berikutnya... (${attempt + 1}/${totalKeys})`);
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Semua API key mencapai kuota limit harian. ${lastError?.message || ''}`);
}

// ─── Input & Helper Functions ────────────────────────────────────────────────

export interface GeneratePeriodicPredictiveInput {
  periodType: PeriodicScope;
  month?: number; // 1 - 12
  year: number;
  cmReports: any[];
  abnormalFindings?: any[];
  sparepartLogs?: any[];
  userEmail?: string;
  userName?: string;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function detectSystemCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('chiller') || lower.includes('pac') || lower.includes('crah') || lower.includes('cooling') || lower.includes('fan') || lower.includes('ac') || lower.includes('kondensor') || lower.includes('pipe') || lower.includes('pipa')) {
    return 'HVAC / Cooling';
  }
  if (lower.includes('ups') || lower.includes('battery') || lower.includes('baterai') || lower.includes('rectifier') || lower.includes('inverter') || lower.includes('dcdc')) {
    return 'UPS & Battery';
  }
  if (lower.includes('fuel') || lower.includes('tangki') || lower.includes('solar') || lower.includes('bbm') || lower.includes('pump') || lower.includes('pompa')) {
    return 'Fuel System';
  }
  if (lower.includes('trafo') || lower.includes('cubicle') || lower.includes('panel') || lower.includes('lv') || lower.includes('mv') || lower.includes('genset') || lower.includes('generator') || lower.includes('ats') || lower.includes('busduct') || lower.includes('breaker') || lower.includes('mcb')) {
    return 'Electrical Distribution';
  }
  if (lower.includes('fire') || lower.includes('hydrant') || lower.includes('fm200') || lower.includes('vesda') || lower.includes('smoke') || lower.includes('sprinkler') || lower.includes('alarm')) {
    return 'Fire Protection';
  }
  return 'General Facility';
}

// ─── Deterministic Fallback Builder ──────────────────────────────────────────

function buildFallbackPeriodicData(input: GeneratePeriodicPredictiveInput): PeriodicPredictiveReportData {
  const { periodType, month = 9, year, cmReports, abnormalFindings = [], sparepartLogs = [], userName = 'Standby Engineer' } = input;
  const monthName = periodType === 'monthly' ? MONTH_NAMES_ID[month - 1] : undefined;
  const totalCM = cmReports.length;
  const totalFindings = abnormalFindings.length;
  const totalSpareparts = sparepartLogs.length;

  const now = new Date();
  const reportNumber = periodType === 'monthly'
    ? `PPR/DME-NDC/${year}/${String(month).padStart(2, '0')}/001`
    : `PPR-ANNUAL/DME-NDC/${year}/001`;

  const title = periodType === 'monthly'
    ? `Laporan Predictive Maintenance & Reliability Forecast Bulanan — ${monthName} ${year}`
    : `Laporan Predictive Maintenance & Reliability Forecast Tahunan — Tahun ${year}`;

  // Hitung insiden per sistem
  const systemCounts: Record<string, number> = {
    'HVAC / Cooling': 0,
    'Electrical Distribution': 0,
    'Fuel System': 0,
    'UPS & Battery': 0,
    'Fire Protection': 0,
    'General Facility': 0,
  };

  // Bad Actor Tracking
  const equipmentFreq: Record<string, { count: number; category: string; location: string; issues: string[] }> = {};

  cmReports.forEach(cm => {
    const equip = cm.equipmentName || cm.incidentName || cm.issue || 'Facility Equipment';
    const cat = detectSystemCategory(equip + ' ' + (cm.issue || ''));
    systemCounts[cat] = (systemCounts[cat] || 0) + 1;

    if (!equipmentFreq[equip]) {
      equipmentFreq[equip] = {
        count: 0,
        category: cat,
        location: cm.location || 'Data Center NeutraDC Cikarang',
        issues: []
      };
    }
    equipmentFreq[equip].count++;
    if (cm.issue && !equipmentFreq[equip].issues.includes(cm.issue)) {
      equipmentFreq[equip].issues.push(cm.issue);
    }
  });

  // Susun System Assessments
  const systemAssessments: SystemAssessment[] = Object.keys(systemCounts).map(sys => {
    const cnt = systemCounts[sys];
    const riskLevel: 'Critical' | 'Warning' | 'Healthy' = cnt >= 8 ? 'Critical' : cnt >= 3 ? 'Warning' : 'Healthy';
    const healthScore = Math.max(50, Math.min(100, 100 - (cnt * 6)));
    return {
      systemName: sys,
      riskLevel,
      healthScore,
      totalIncidents: cnt,
      criticalIssues: cnt > 0
        ? [`Ditemukan ${cnt} kejadian penanganan maintenance pada periode ini.`]
        : ['Tidak tercatat kegagalan kritis. Kondisi nominal beroperasi penuh.'],
      aiInsight: cnt > 0
        ? `Sistem ${sys} memerlukan perhatian pada pola degradasi berulang komponen mekanis & kontak elektrik.`
        : `Sistem ${sys} menunjukkan keandalan tinggi memenuhi standar uptime Tier 3 NeutraDC.`
    };
  });

  // Susun Bad Actor Assets (Top 5)
  const sortedBadActors: BadActorAsset[] = Object.keys(equipmentFreq)
    .sort((a, b) => equipmentFreq[b].count - equipmentFreq[a].count)
    .slice(0, 5)
    .map(name => {
      const info = equipmentFreq[name];
      return {
        equipmentName: name,
        systemCategory: info.category,
        locationRoom: info.location,
        incidentCount: info.count,
        failureModes: info.issues.length > 0 ? info.issues.slice(0, 3) : ['Vibrasi mekanis', 'Keausan komponen'],
        estimatedRUL: info.count >= 3 ? '1 - 2 Bulan (Perlu Overhaul)' : '3 - 6 Bulan',
        recommendation: `Tingkatkan frekuensi pemeriksaan berkala mingguan dan siapkan sparepart cadangan kritis.`
      };
    });

  const facilityHealthScore = Math.max(65, Math.min(98, 100 - Math.round(totalCM * 1.5)));
  const overallStatus: 'Optimized' | 'Caution Needed' | 'High Risk' =
    facilityHealthScore >= 85 ? 'Optimized' : facilityHealthScore >= 70 ? 'Caution Needed' : 'High Risk';

  const executiveSummary = periodType === 'monthly'
    ? `Selama bulan ${monthName} ${year}, fasilitas Data Center NeutraDC Cikarang beroperasi dengan Indeks Keandalan Fasilitas (Health Score) sebesar ${facilityHealthScore}/100 (${overallStatus}). Tercatat ${totalCM} aktivitas Corrective Maintenance dan ${totalFindings} temuan abnormalitas. Analisis reliabilitas menunjukkan bahwa sebagian besar insiden dapat distabilkan dalam toleransi SLA, namun diperlukan penanganan preventif lanjutan pada peralatan dengan frekuensi gangguan berulang.`
    : `Sepanjang tahun ${year}, Data Center NeutraDC Cikarang mempertahankan performa operasional andal dengan rata-rata Indeks Keandalan ${facilityHealthScore}/100. Dari total ${totalCM} insiden pemeliharaan perbaikan dan ${totalFindings} temuan investigasi, fokus utama degradasi jangka panjang teridentifikasi pada sistem mekanikal pendingin dan suplai bahan bakar. Direkomendasikan alokasi anggaran peremajaan unit (CAPEX/OPEX) untuk menjaga SLA 99.982% di tahun mendatang.`;

  const sparepartForecast: PeriodicSparepartForecast[] = [
    {
      partName: 'V-Belt & Rantai Transmisi Mekanis',
      estimatedNeeded: '4 - 6 Unit',
      currentStockStatus: 'Low / Order Now',
      justification: 'Laju aus mekanis meningkat akibat operasi rotasi tinggi pada fasilitas pompa dan fan.'
    },
    {
      partName: 'Relay Kontrol & Auxiliary Switch Schneider',
      estimatedNeeded: '8 Unit',
      currentStockStatus: 'Low / Order Now',
      justification: 'Pencegahan lonjakan transient dan penurunan sensitivitas kontak panel distribusi.'
    },
    {
      partName: 'Filter Oli & Solar Pompa Transfer',
      estimatedNeeded: '6 Set',
      currentStockStatus: 'Sufficient',
      justification: 'Penggantian rutin periodik untuk menjaga kemurnian suplai solar genset.'
    }
  ];

  const actionPlan: PeriodicActionPlan = {
    immediatePreventive: [
      'Lakukan thermography scanning komprehensif pada terminal sambungan busduct & panel beban puncak.',
      'Pengecekan vibrasi dan kelonggaran baut dudukan pompa suplai solar serta motor fan pendingin.',
      'Pembersihan kontak dan pengujian resistansi isolasi (Megger test) pada motor induksi kritis.'
    ],
    scheduledOverhauls: [
      'Jadwalkan overhaul mekanikal pada peralatan bad actor teratas di kuartal berikutnya.',
      'Kalibrasi ulang sensor suhu, kelembaban, dan transduser tekanan diferensial HVAC.'
    ],
    capexReplacementRecommendations: [
      'Pertimbangkan penggantian motor penggerak berumur operasional > 5 tahun dengan efisiensi tinggi (IE3).',
      'Pengadaan kit rekondisi kompresor cadangan untuk mitigasi kenaikan suhu musiman data hall.'
    ]
  };

  const currentDateFormatted = `${now.getDate()} ${MONTH_NAMES_ID[now.getMonth()]} ${now.getFullYear()}`;

  return {
    id: `PPR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    reportNumber,
    periodType,
    month: periodType === 'monthly' ? month : undefined,
    monthName,
    year,
    title,
    createdAt: now,
    updatedAt: now,
    createdBy: userName,
    totalCMEvents: totalCM,
    totalAbnormalFindings: totalFindings,
    totalSparepartsReplaced: totalSpareparts,
    facilityHealthScore,
    overallStatus,
    executiveSummary,
    systemAssessments,
    badActorAssets: sortedBadActors,
    sparepartForecast,
    actionPlan,
    signatures: {
      preparedBy: {
        name: userName,
        title: 'Standby Engineer',
        date: currentDateFormatted
      },
      verifiedBy: {
        name: 'QC DME Engineer',
        title: 'QC & Commissioning DME',
        date: currentDateFormatted
      },
      approvedBy: {
        name: 'Facility Manager / NeutraDC',
        title: 'Site Operations Manager',
        date: currentDateFormatted
      }
    }
  };
}

// ─── Main Generator Function via AI Gemini ───────────────────────────────────

export async function generatePeriodicPredictiveReportAI(
  input: GeneratePeriodicPredictiveInput,
  onProgress?: (status: string) => void
): Promise<PeriodicPredictiveReportData> {
  const fallbackData = buildFallbackPeriodicData(input);
  const { periodType, month = 9, year, cmReports, abnormalFindings = [] } = input;
  const monthName = periodType === 'monthly' ? MONTH_NAMES_ID[month - 1] : undefined;

  onProgress?.('AI Reliability Agent sedang menganalisis seluruh data agregat...');

  // Siapkan data ringkas untuk prompt
  const cmSummaryList = cmReports.slice(0, 30).map((r, i) => {
    return `${i + 1}. [${r.reportedAt ? new Date(r.reportedAt?.toDate ? r.reportedAt.toDate() : r.reportedAt).toLocaleDateString('id-ID') : '-'}] Alat: ${r.equipmentName || r.incidentName || 'N/A'} | Area: ${r.location || 'N/A'} | Issue: ${r.issue || r.actionTaken || '-'}`;
  }).join('\n');

  const findingsSummaryList = abnormalFindings.slice(0, 15).map((f, i) => {
    return `${i + 1}. [${f.findingDate || '-'}] ${f.title || f.findingNote || 'Temuan abnormal'} (Severity: ${f.severity || 'Medium'})`;
  }).join('\n');

  const systemInstruction = `
Anda adalah Senior Reliability Engineering AI Specialist untuk Data Center NeutraDC Cikarang (PT Dwimitra Ekatama Mandiri).
Tugas Anda adalah membuat Laporan Predictive Maintenance & Reliability Forecast Periodik (${periodType === 'monthly' ? `BULANAN periode ${monthName} ${year}` : `TAHUNAN periode Tahun ${year}`}).

Gunakan pendekatan Reliability Centered Maintenance (RCM), Failure Modes & Effects Analysis (FMEA), serta Remaining Useful Life (RUL) forecasting.
Bahasa wajib: Bahasa Indonesia formal profesional teknik keandalan fasilitas data center.

Format output WAJIB HANYA berupa JSON valid murni (tanpa pembuka markdown \`\`\`json atau teks pengantar):
{
  "facilityHealthScore": 88, // integer 0 - 100
  "overallStatus": "Optimized" | "Caution Needed" | "High Risk",
  "executiveSummary": "Ringkasan eksekutif menyeluruh performa fasilitas data center, tingkat keandalan, dan tren degradasi...",
  "systemAssessments": [
    {
      "systemName": "HVAC / Cooling" | "Electrical Distribution" | "Fuel System" | "UPS & Battery" | "Fire Protection" | "General Facility",
      "riskLevel": "Critical" | "Warning" | "Healthy",
      "healthScore": 85,
      "totalIncidents": 3,
      "criticalIssues": ["Deskripsi temuan/isu kritis"],
      "aiInsight": "Analisis prediktif AI mengenai kondisi degradasi komponen..."
    }
  ],
  "badActorAssets": [
    {
      "equipmentName": "Nama Peralatan",
      "systemCategory": "HVAC / Cooling",
      "locationRoom": "Lokasi",
      "incidentCount": 2,
      "failureModes": ["Modus kegagalan 1", "Modus 2"],
      "estimatedRUL": "2 - 4 Bulan",
      "recommendation": "Rekomendasi spesifik perbaikan / overhaul..."
    }
  ],
  "sparepartForecast": [
    {
      "partName": "Nama Sparepart",
      "estimatedNeeded": "4 Unit",
      "currentStockStatus": "Sufficient" | "Low / Order Now" | "Critical Stockout",
      "justification": "Alasan justifikasi keausan / degradasi..."
    }
  ],
  "actionPlan": {
    "immediatePreventive": ["Tindakan 1", "Tindakan 2"],
    "scheduledOverhauls": ["Overhaul 1", "Overhaul 2"],
    "capexReplacementRecommendations": ["Rekomendasi CAPEX 1", "Rekomendasi 2"]
  }
}
`.trim();

  const userPrompt = `
Data Riwayat Pemeliharaan Periode: ${periodType === 'monthly' ? `Bulan ${monthName} ${year}` : `Tahun ${year}`}
Total Laporan CM: ${cmReports.length}
Total Temuan Abnormal: ${abnormalFindings.length}

Sampel Laporan CM Periode Ini:
${cmSummaryList || '(Tidak ada insiden CM kritis tercatat)'}

Sampel Temuan Abnormal:
${findingsSummaryList || '(Tidak ada temuan abnormal tercatat)'}

Hasilkan analisis prediktif periodik reliabilitas fasilitas Data Center NeutraDC dalam format JSON sesuai instruksi.
`.trim();

  try {
    const rawResponse = await callWithFailover(reasoningModel, [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt }
    ], 0.2, 4096);

    let cleanJson = rawResponse.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }

    const parsed = JSON.parse(cleanJson);

    return {
      ...fallbackData,
      facilityHealthScore: typeof parsed.facilityHealthScore === 'number' ? parsed.facilityHealthScore : fallbackData.facilityHealthScore,
      overallStatus: parsed.overallStatus || fallbackData.overallStatus,
      executiveSummary: parsed.executiveSummary || fallbackData.executiveSummary,
      systemAssessments: Array.isArray(parsed.systemAssessments) && parsed.systemAssessments.length > 0
        ? parsed.systemAssessments
        : fallbackData.systemAssessments,
      badActorAssets: Array.isArray(parsed.badActorAssets) && parsed.badActorAssets.length > 0
        ? parsed.badActorAssets
        : fallbackData.badActorAssets,
      sparepartForecast: Array.isArray(parsed.sparepartForecast) && parsed.sparepartForecast.length > 0
        ? parsed.sparepartForecast
        : fallbackData.sparepartForecast,
      actionPlan: parsed.actionPlan || fallbackData.actionPlan,
    };
  } catch (err: any) {
    console.warn('AI Periodic Predictive Generation failed or timed out, using high-fidelity heuristic fallback:', err);
    return fallbackData;
  }
}
