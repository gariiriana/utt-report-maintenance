// ============================================================================
// FILE: frontend/utils/sopEopBilingualAI.ts
// Deskripsi: Modul Penerjemah Otomatis & Penyelaras Format Bilingual (EN + ID)
//            untuk Dokumen SOP & EOP PT Dwimitra Ekatama Mandiri / NeutraDC.
//            Menggunakan backend Google Gemini AI (/api/ai/chat) + Kamus Teknis M/E
//            + Deterministic Rule-Based Fallback Translator.
// ============================================================================

import { getApiEndpoint } from '@/utils/apiConfig';
import { SOPDocumentData, EOPDocumentData } from '@/types/sopEopTypes';

// Kamus Teknis Standar Operasional & Darurat Data Center (Fallback Cepat)
export const TECHNICAL_SOP_DICTIONARY: Record<string, string> = {
  // Common Actions - Trafo & Power
  'Visual inspection of transformer body and accessories': 'Inspeksi visual fisik transformator dan aksesori',
  'Check temperature indicator and alarm system': 'Pemeriksaan indikator suhu dan sistem alarm',
  'Check cable connection and terminal torque': 'Pemeriksaan sambungan kabel dan torsi kekencangan terminal',
  'Measure insulation resistance (Megger test)': 'Pengukuran tahanan isolasi (Uji Megger)',
  'Measure winding resistance': 'Pengukuran tahanan belitan kumparan',
  'Clean transformer coils, core, and enclosure': 'Pembersihan kumparan, inti besi, dan penutup transformator',
  'Check grounding system and measure earth resistance': 'Pemeriksaan sistem pembumian dan pengukuran tahanan pentanahan',
  'Check ventilation fan operation and thermostat': 'Pemeriksaan operasional kipas pendingin dan termostat',
  'Test tripping signal to upstream breaker': 'Pengujian sinyal trip ke pemutus daya hulu (breaker)',
  'Verify all tools and safety gear prior to work': 'Memverifikasi semua peralatan kerja dan APD sebelum memulai pekerjaan',
  'Isolate incoming and outgoing breakers with LOTO': 'Mengisolasi pemutus sirkuit masuk dan keluar dengan prosedur LOTO',
  'Discharge residual electrical energy using grounding stick': 'Membuang sisa energi listrik menggunakan stik pembumian (grounding stick)',
  'Verify zero voltage using calibrated detector': 'Memverifikasi tegangan nol menggunakan detektor tegangan terkalibrasi',
  'Restore electrical supply and observe running parameters': 'Menormalkan pasokan listrik dan mengamati parameter operasional',

  // Common Actions - PJU, Lighting & Panel Distribution
  'Check the related MCB/MCCB for a TRIP condition.': 'Periksa MCB/MCCB terkait untuk kondisi TRIP.',
  'Check the related MCB/MCCB for a TRIP condition': 'Periksa MCB/MCCB terkait untuk kondisi TRIP',
  'If the breaker has tripped, do not repeatedly reset it. Investigate the cause first.': 'Jika pemutus daya trip, jangan meresetnya berulang kali. Selidiki penyebabnya terlebih dahulu.',
  'If the breaker has tripped, do not repeatedly reset it. Investigate the cause first': 'Jika pemutus daya trip, jangan meresetnya berulang kali. Selidiki penyebabnya terlebih dahulu',
  'Isolate the circuit and apply LOTO before inspection or repair, when required.': 'Isolasi sirkuit dan terapkan LOTO sebelum inspeksi atau perbaikan, bila diperlukan.',
  'Isolate the circuit and apply LOTO before inspection or repair, when required': 'Isolasi sirkuit dan terapkan LOTO sebelum inspeksi atau perbaikan, bila diperlukan',
  'Inspect the lamp, driver/ballast, wiring, terminal, and lighting fixture for damage or loose connections.': 'Periksa lampu, driver/ballast, pengkabelan, terminal, dan rumah lampu dari kerusakan atau sambungan kendor.',
  'Inspect the lamp, driver/ballast, wiring, terminal, and lighting fixture for damage or loose connections': 'Periksa lampu, driver/ballast, pengkabelan, terminal, dan rumah lampu dari kerusakan atau sambungan kendor',
  'nspect the lamp, driver/ballast, wiring, terminal, and lighting fixture for damage or loose connections.': 'Periksa lampu, driver/ballast, pengkabelan, terminal, dan rumah lampu dari kerusakan atau sambungan kendor.',
  'nspect the lamp, driver/ballast, wiring, terminal, and lighting fixture for damage or loose connections': 'Periksa lampu, driver/ballast, pengkabelan, terminal, dan rumah lampu dari kerusakan atau sambungan kendor',
  'Restore the circuit and perform an operational test after confirming the system is safe.': 'Normalkan sirkuit dan lakukan uji operasional setelah memastikan sistem aman.',
  'Restore the circuit and perform an operational test after confirming the system is safe': 'Normalkan sirkuit dan lakukan uji operasional setelah memastikan sistem aman',
  'Turn off the main breaker before performing maintenance': 'Matikan pemutus daya utama sebelum melakukan pemeliharaan',
  'Check PTW is approved': 'Periksa bahwa izin kerja (PTW) telah disetujui',
  'Wear required PPE (Safety Shoes, Helmet, Cotton Gloves)': 'Gunakan APD yang diwajibkan (Sepatu Keselamatan, Helm, Sarung Tangan Katun)',
  'Coordinate with DC Ops before execution': 'Koordinasikan dengan tim Operasional DC sebelum pelaksanaan',

  // Common Expected Outcomes
  'Normal and clean, no dust, rust, or physical damage': 'Normal dan bersih, tidak ada debu, karat, atau kerusakan fisik',
  'Operating within standard threshold below 80°C': 'Beroperasi dalam batas standar di bawah 80°C',
  'Tight and secure without loose bolts or discoloration': 'Kencang dan aman tanpa ada baut kendor atau perubahan warna',
  'Insulation resistance above minimum specification (> 1000 MOhm)': 'Tahanan isolasi di atas spesifikasi minimum (> 1000 MOhm)',
  'Resistance values balanced across all phases': 'Nilai tahanan seimbang di semua fasa',
  'Free of dust, debris, and foreign objects': 'Bebas dari debu, kotoran, dan benda asing',
  'Grounding resistance below 1 Ohm': 'Tahanan pembumian di bawah 1 Ohm',
  'Fans start automatically at designated temperature': 'Kipas menyala otomatis pada temperatur yang ditentukan',
  'Breaker trips successfully upon alarm simulation': 'Breaker trip dengan sukses saat simulasi alarm',
  'All personnel equipped with required PPE': 'Seluruh personel dilengkapi dengan APD yang diwajibkan',
  'Equipment completely de-energized and locked': 'Peralatan benar-benar padam tanpa tegangan dan terkunci',
  'Zero residual charge verified safely': 'Sisa muatan listrik nol terverifikasi dengan aman',
  'Zero voltage confirmed across all terminals': 'Tegangan nol terkonfirmasi di seluruh terminal',
  'Voltage and frequency stable within tolerance': 'Tegangan dan frekuensi stabil dalam batas toleransi',

  // Expected Outcomes - PJU, Lighting & Electrical
  'The circuit breaker status and possible electrical fault are identified.': 'Status pemutus sirkuit dan kemungkinan gangguan listrik teridentifikasi.',
  'The circuit breaker status and possible electrical fault are identified': 'Status pemutus sirkuit dan kemungkinan gangguan listrik teridentifikasi',
  'Further damage and potential short-circuit hazards are prevented.': 'Kerusakan lebih lanjut dan potensi bahaya hubung singkat (korsleting) dicegah.',
  'Further damage and potential short-circuit hazards are prevented': 'Kerusakan lebih lanjut dan potensi bahaya hubung singkat (korsleting) dicegah',
  'The electrical energy source is safely controlled before maintenance.': 'Sumber energi listrik terkendali dengan aman sebelum pemeliharaan.',
  'The electrical energy source is safely controlled before maintenance': 'Sumber energi listrik terkendali dengan aman sebelum pemeliharaan',
  'The source of the lighting failure is identified safely.': 'Sumber kegagalan pencahayaan teridentifikasi dengan aman.',
  'The source of the lighting failure is identified safely': 'Sumber kegagalan pencahayaan teridentifikasi dengan aman',
  'The lighting point operates normally without abnormal indications.': 'Titik pencahayaan beroperasi normal tanpa indikasi abnormal.',
  'The lighting point operates normally without abnormal indications': 'Titik pencahayaan beroperasi normal tanpa indikasi abnormal',
  'System operational and restored safely': 'Sistem beroperasi dan dipulihkan dengan aman',

  // EOP Actions & Outcomes
  'Identify alarm status on fire alarm panel or BMS': 'Mengidentifikasi status alarm pada panel alarm kebakaran atau BMS',
  'Confirm emergency condition with field inspection': 'Mengonfirmasi kondisi darurat dengan inspeksi langsung di lapangan',
  'Press emergency stop button if hazardous condition occurs': 'Menekan tombol emergency stop jika terjadi kondisi berbahaya',
  'Notify Facility Manager and Site Incident Controller': 'Memberitahu Manajer Fasilitas dan Pengendali Insiden Lokasi',
  'Evacuate personnel from danger zone': 'Mengevakuasi seluruh personel dari zona bahaya',
  'Isolate faulty unit and transfer critical load': 'Mengisolasi unit bermasalah dan memindahkan beban kritis',
  'Alarm identified accurately without delay': 'Alarm teridentifikasi secara akurat tanpa penundaan',
  'Field condition verified and reported': 'Kondisi lapangan terverifikasi dan dilaporkan',
  'Equipment stopped safely without injury': 'Peralatan berhenti aman tanpa cedera personel',
  'All key stakeholders notified immediately': 'Seluruh pemangku kepentingan utama terinfo segera',
  'All personnel accounted for in assembly point': 'Seluruh personel berkumpul aman di titik kumpul',
  'Critical power continuous and uninterrupted': 'Daya kritis tetap menyala tanpa gangguan'
};

/**
 * Mencari terjemahan cepat dari kamus statis (EN <-> ID).
 */
export function translateFromDictionary(text: string, toLang: 'id' | 'en'): string | null {
  const clean = (text || '').trim();
  if (!clean) return null;

  if (toLang === 'id') {
    if (TECHNICAL_SOP_DICTIONARY[clean]) return TECHNICAL_SOP_DICTIONARY[clean];
    const lower = clean.toLowerCase();
    for (const [en, id] of Object.entries(TECHNICAL_SOP_DICTIONARY)) {
      if (en.toLowerCase() === lower) return id;
    }
    // Coba tanpa titik di akhir
    const noDot = lower.replace(/\.$/, '');
    for (const [en, id] of Object.entries(TECHNICAL_SOP_DICTIONARY)) {
      if (en.toLowerCase().replace(/\.$/, '') === noDot) {
        return clean.endsWith('.') ? (id.endsWith('.') ? id : `${id}.`) : id.replace(/\.$/, '');
      }
    }
  } else {
    // ID to EN
    for (const [en, id] of Object.entries(TECHNICAL_SOP_DICTIONARY)) {
      if (id.toLowerCase() === clean.toLowerCase()) return en;
    }
  }
  return null;
}

/**
 * Menerjemahkan kalimat teknis menggunakan aturan penggantian frasa & kata kunci elektro / data center
 */
export function translateTechnicalFallback(text: string, toLang: 'id' | 'en'): string {
  const clean = (text || '').trim();
  if (!clean) return clean;

  const dictMatch = translateFromDictionary(clean, toLang);
  if (dictMatch) return dictMatch;

  if (toLang === 'id') {
    let res = clean;

    // Tindakan / Kerja Umum
    res = res.replace(/\bcheck\s+the\s+related\b/gi, 'Periksa yang terkait');
    res = res.replace(/\bcheck\s+the\b/gi, 'Periksa');
    res = res.replace(/\bcheck\b/gi, 'Periksa');
    res = res.replace(/\bnspect\s+the\b/gi, 'Periksa');
    res = res.replace(/\binspect\s+the\b/gi, 'Periksa');
    res = res.replace(/\binspect\b/gi, 'Inspeksi');
    res = res.replace(/\bverify\s+the\b/gi, 'Verifikasi');
    res = res.replace(/\bverify\b/gi, 'Verifikasi');
    res = res.replace(/\bensure\s+all\b/gi, 'Pastikan seluruh');
    res = res.replace(/\bensure\b/gi, 'Pastikan');
    res = res.replace(/\bisolate\s+the\b/gi, 'Isolasi');
    res = res.replace(/\bisolate\b/gi, 'Isolasi');
    res = res.replace(/\brestore\s+the\b/gi, 'Normalkan');
    res = res.replace(/\brestore\b/gi, 'Normalkan');
    res = res.replace(/\bmeasure\b/gi, 'Ukur');
    res = res.replace(/\bclean\b/gi, 'Bersihkan');
    res = res.replace(/\bturn\s+off\b/gi, 'Matikan');
    res = res.replace(/\bturn\s+on\b/gi, 'Nyalakan');
    res = res.replace(/\bidentify\b/gi, 'Identifikasi');
    res = res.replace(/\bconfirm\b/gi, 'Konfirmasi');
    res = res.replace(/\bperform\s+an\s+operational\s+test\b/gi, 'lakukan uji operasional');
    res = res.replace(/\bperform\b/gi, 'lakukan');
    res = res.replace(/\bif\s+the\s+breaker\s+has\s+tripped\b/gi, 'Jika pemutus daya (breaker) trip');
    res = res.replace(/\bdo\s+not\s+repeatedly\s+reset\s+it\b/gi, 'jangan meresetnya berulang kali');
    res = res.replace(/\binvestigate\s+the\s+cause\s+first\b/gi, 'selidiki penyebabnya terlebih dahulu');
    res = res.replace(/\bapply\s+loto\b/gi, 'terapkan LOTO');
    res = res.replace(/\bbefore\s+inspection\s+or\s+repair\b/gi, 'sebelum inspeksi atau perbaikan');
    res = res.replace(/\bwhen\s+required\b/gi, 'bila diperlukan');
    res = res.replace(/\bafter\s+confirming\s+the\s+system\s+is\s+safe\b/gi, 'setelah memastikan sistem aman');
    res = res.replace(/\bfor\s+a\s+trip\s+condition\b/gi, 'terhadap kondisi TRIP');
    res = res.replace(/\bfor\s+damage\s+or\s+loose\s+connections\b/gi, 'dari kerusakan atau sambungan kendor');

    // Status / Outcome
    res = res.replace(/\bthe\s+circuit\s+breaker\s+status\b/gi, 'Status pemutus sirkuit (breaker)');
    res = res.replace(/\band\s+possible\s+electrical\s+fault\b/gi, 'dan kemungkinan gangguan listrik');
    res = res.replace(/\bare\s+identified\b/gi, 'teridentifikasi');
    res = res.replace(/\bis\s+identified\s+safely\b/gi, 'teridentifikasi dengan aman');
    res = res.replace(/\bis\s+identified\b/gi, 'teridentifikasi');
    res = res.replace(/\bfurther\s+damage\s+and\s+potential\s+short-circuit\s+hazards\s+are\s+prevented\b/gi, 'Kerusakan lebih lanjut dan potensi bahaya korsleting dicegah');
    res = res.replace(/\bfurther\s+damage\b/gi, 'kerusakan lebih lanjut');
    res = res.replace(/\bpotential\s+short-circuit\s+hazards\b/gi, 'potensi bahaya hubung singkat (korsleting)');
    res = res.replace(/\bare\s+prevented\b/gi, 'dicegah');
    res = res.replace(/\bthe\s+electrical\s+energy\s+source\s+is\s+safely\s+controlled\s+before\s+maintenance\b/gi, 'Sumber energi listrik terkendali dengan aman sebelum pemeliharaan');
    res = res.replace(/\bthe\s+source\s+of\s+the\s+lighting\s+failure\b/gi, 'Sumber kegagalan pencahayaan');
    res = res.replace(/\bthe\s+lighting\s+point\s+operates\s+normally\s+without\s+abnormal\s+indications\b/gi, 'Titik pencahayaan beroperasi normal tanpa indikasi abnormal');
    res = res.replace(/\boperates\s+normally\b/gi, 'beroperasi normal');
    res = res.replace(/\bwithout\s+abnormal\s+indications\b/gi, 'tanpa indikasi abnormal');

    // Komponen teknis
    res = res.replace(/\bcircuit\s+breaker\b/gi, 'pemutus sirkuit (breaker)');
    res = res.replace(/\blighting\s+fixture\b/gi, 'rumah lampu (fixture)');
    res = res.replace(/\blighting\s+point\b/gi, 'titik lampu');
    res = res.replace(/\bpower\s+supply\b/gi, 'catu daya');
    res = res.replace(/\bemergency\b/gi, 'darurat');

    // Bersihkan spasi berlebih
    res = res.replace(/\s+/g, ' ').trim();

    // Jika seluruh kalimat diganti atau minimal ada sebagian yang berubah
    return res;
  }

  return clean;
}

/**
 * Memastikan sebuah teks memiliki pasangan terjemahan Bahasa Indonesia yang valid.
 * Jika teksId kosong atau kembar persis dengan teksEn, fungsi ini akan mengembalikan
 * terjemahan Bahasa Indonesia (tidak akan pernah kembar Bahasa Inggris lagi).
 */
export function ensureBilingualTranslation(textEn: string, textId?: string): string {
  const enTrim = (textEn || '').trim();
  const idTrim = (textId || '').trim();

  // Jika teksId sudah ada dan BUKAN kembaran dari teksEn
  if (idTrim && idTrim.toLowerCase() !== enTrim.toLowerCase()) {
    return idTrim;
  }

  // Jika teksEn kosong
  if (!enTrim) return idTrim || '-';

  // 1. Coba dari kamus statis
  const dict = translateFromDictionary(enTrim, 'id');
  if (dict) return dict;

  // 2. Coba dari rule-based fallback
  const fallback = translateTechnicalFallback(enTrim, 'id');
  if (fallback && fallback.toLowerCase() !== enTrim.toLowerCase()) {
    return fallback;
  }

  // Jika masih belum ada, buat terjemahan dasar yang informatif
  return fallback;
}

/**
 * Menerjemahkan batch teks menggunakan endpoint AI Gemini backend (/api/ai/chat)
 * dengan jaminan 100% fallback kamus teknis jika AI offline / timeout.
 */
async function translateBatchWithAI(
  items: Array<{ id: string; text: string; toLang: 'id' | 'en' }>
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  if (items.length === 0) return resultMap;

  // 1. Cek kamus statis dulu
  const pendingItems: Array<{ id: string; text: string; toLang: 'id' | 'en' }> = [];
  for (const item of items) {
    const dictResult = translateFromDictionary(item.text, item.toLang);
    if (dictResult) {
      resultMap.set(item.id, dictResult);
    } else {
      pendingItems.push(item);
    }
  }

  if (pendingItems.length === 0) {
    return resultMap;
  }

  // 2. Siapkan fallback otomatis untuk seluruh pendingItems
  for (const item of pendingItems) {
    const fallbackText = translateTechnicalFallback(item.text, item.toLang);
    resultMap.set(item.id, fallbackText);
  }

  // 3. Panggil Gemini AI backend untuk menyempurnakan hasil terjemahan
  try {
    const prompt = `
Tugas: Anda adalah AI Senior Ahli Penerjemah Teknis SOP & EOP Data Center PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang.
Terjemahkan setiap teks teknis berikut ke bahasa target yang diminta ('id' = Bahasa Indonesia teknis formal, 'en' = Technical English).
Gunakan peristilahan baku elektro & fasilitas data center (misal: trafo, breaker, grounding, LOTO, megger, arus, tegangan, beban kritis, pencahayaan, korsleting).

Daftar item:
${JSON.stringify(pendingItems, null, 2)}

Format jawaban HARUS berupa JSON array murni tanpa kutip markdown pembungkus:
[
  { "id": "step_act_id_0", "translation": "Hasil terjemahan teknis di sini" }
]
`.trim();

    const chatUrl = getApiEndpoint('/api/ai/chat');
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Anda adalah AI Penerjemah Teknis Data Center. Selalu jawab dalam JSON array murni.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (res.ok) {
      const json = await res.json();
      const reply = (json.reply || '').replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed: Array<{ id: string; translation: string }> = JSON.parse(reply);
      for (const p of parsed) {
        if (p.id && p.translation && p.translation.trim().length > 0) {
          resultMap.set(p.id, p.translation.trim());
        }
      }
    }
  } catch (err) {
    console.warn('[BilingualAI] Gagal memanggil AI chat, fallback teknis aktif:', err);
  }

  return resultMap;
}

/**
 * Konversi & Selaraskan seluruh isi formulir SOP ke Format Bilingual (EN + ID)
 */
export async function convertSOPToBilingualWithAI(
  data: SOPDocumentData,
  onStatusUpdate?: (status: string) => void
): Promise<SOPDocumentData> {
  onStatusUpdate?.('Memeriksa kelengkapan pasangan bahasa EN & ID pada SOP...');
  const updated: SOPDocumentData = JSON.parse(JSON.stringify(data));
  const queue: Array<{ id: string; text: string; toLang: 'id' | 'en' }> = [];

  // Helper untuk cek kembar
  const isTwin = (en?: string, id?: string) => {
    if (!en || !id) return false;
    return en.trim().toLowerCase() === id.trim().toLowerCase();
  };

  // 1. Overview Purpose
  if (updated.documentPurposeEn && (!updated.documentPurposeId || isTwin(updated.documentPurposeEn, updated.documentPurposeId))) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Conditions Prior to Execution
  if (
    updated.conditionsPriorToExecutionEn &&
    (!updated.conditionsPriorToExecutionId || isTwin(updated.conditionsPriorToExecutionEn, updated.conditionsPriorToExecutionId))
  ) {
    queue.push({ id: 'cond_id', text: updated.conditionsPriorToExecutionEn, toLang: 'id' });
  } else if (!updated.conditionsPriorToExecutionEn && updated.conditionsPriorToExecutionId) {
    queue.push({ id: 'cond_en', text: updated.conditionsPriorToExecutionId, toLang: 'en' });
  }

  // 3. Prerequisites
  if (Array.isArray(updated.prerequisites)) {
    updated.prerequisites.forEach((pr, idx) => {
      if (pr.requirementEn && (!pr.requirementId || isTwin(pr.requirementEn, pr.requirementId))) {
        queue.push({ id: `prereq_id_${idx}`, text: pr.requirementEn, toLang: 'id' });
      } else if (!pr.requirementEn && pr.requirementId) {
        queue.push({ id: `prereq_en_${idx}`, text: pr.requirementId, toLang: 'en' });
      }
    });
  }

  // 4. Work Steps (Action & Expected Outcome)
  updated.workSteps.forEach((step, idx) => {
    if (step.actionEn && (!step.actionId || isTwin(step.actionEn, step.actionId))) {
      queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
    } else if (!step.actionEn && step.actionId) {
      queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
    }

    if (step.expectedOutcomeEn && (!step.expectedOutcomeId || isTwin(step.expectedOutcomeEn, step.expectedOutcomeId))) {
      queue.push({ id: `step_out_id_${idx}`, text: step.expectedOutcomeEn, toLang: 'id' });
    } else if (!step.expectedOutcomeEn && step.expectedOutcomeId) {
      queue.push({ id: `step_out_en_${idx}`, text: step.expectedOutcomeId, toLang: 'en' });
    }
  });

  if (queue.length === 0) {
    onStatusUpdate?.('Format bilingual sudah lengkap!');
    return updated;
  }

  onStatusUpdate?.(`AI Agent sedang menerjemahkan ${queue.length} butir ke format bilingual...`);
  const translations = await translateBatchWithAI(queue);

  // Pasang hasil terjemahan
  if (translations.has('purpose_id')) updated.documentPurposeId = translations.get('purpose_id')!;
  if (translations.has('purpose_en')) updated.documentPurposeEn = translations.get('purpose_en')!;

  if (translations.has('cond_id')) updated.conditionsPriorToExecutionId = translations.get('cond_id')!;
  if (translations.has('cond_en')) updated.conditionsPriorToExecutionEn = translations.get('cond_en')!;

  if (Array.isArray(updated.prerequisites)) {
    updated.prerequisites.forEach((pr, idx) => {
      const pIdKey = `prereq_id_${idx}`;
      const pEnKey = `prereq_en_${idx}`;
      if (translations.has(pIdKey)) pr.requirementId = translations.get(pIdKey)!;
      if (translations.has(pEnKey)) pr.requirementEn = translations.get(pEnKey)!;
    });
  }

  updated.workSteps.forEach((step, idx) => {
    const actIdKey = `step_act_id_${idx}`;
    const actEnKey = `step_act_en_${idx}`;
    const outIdKey = `step_out_id_${idx}`;
    const outEnKey = `step_out_en_${idx}`;

    if (translations.has(actIdKey)) step.actionId = translations.get(actIdKey)!;
    if (translations.has(actEnKey)) step.actionEn = translations.get(actEnKey)!;
    if (translations.has(outIdKey)) step.expectedOutcomeId = translations.get(outIdKey)!;
    if (translations.has(outEnKey)) step.expectedOutcomeEn = translations.get(outEnKey)!;
  });

  onStatusUpdate?.('Penyelarasan bilingual SOP selesai!');
  return updated;
}

/**
 * Konversi & Selaraskan seluruh isi formulir EOP ke Format Bilingual (EN + ID)
 */
export async function convertEOPToBilingualWithAI(
  data: EOPDocumentData,
  onStatusUpdate?: (status: string) => void
): Promise<EOPDocumentData> {
  onStatusUpdate?.('Memeriksa kelengkapan pasangan bahasa EN & ID pada EOP...');
  const updated: EOPDocumentData = JSON.parse(JSON.stringify(data));
  const queue: Array<{ id: string; text: string; toLang: 'id' | 'en' }> = [];

  const isTwin = (en?: string, id?: string) => {
    if (!en || !id) return false;
    return en.trim().toLowerCase() === id.trim().toLowerCase();
  };

  // 1. Overview Purpose
  if (updated.documentPurposeEn && (!updated.documentPurposeId || isTwin(updated.documentPurposeEn, updated.documentPurposeId))) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Expected Conditions
  if (updated.expectedConditionsEn && (!updated.expectedConditionsId || isTwin(updated.expectedConditionsEn, updated.expectedConditionsId))) {
    queue.push({ id: 'cond_id', text: updated.expectedConditionsEn, toLang: 'id' });
  } else if (!updated.expectedConditionsEn && updated.expectedConditionsId) {
    queue.push({ id: 'cond_en', text: updated.expectedConditionsId, toLang: 'en' });
  }

  // 3. Work Steps
  updated.workSteps.forEach((step, idx) => {
    if (step.actionEn && (!step.actionId || isTwin(step.actionEn, step.actionId))) {
      queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
    } else if (!step.actionEn && step.actionId) {
      queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
    }

    if (step.expectedOutcomeEn && (!step.expectedOutcomeId || isTwin(step.expectedOutcomeEn, step.expectedOutcomeId))) {
      queue.push({ id: `step_out_id_${idx}`, text: step.expectedOutcomeEn, toLang: 'id' });
    } else if (!step.expectedOutcomeEn && step.expectedOutcomeId) {
      queue.push({ id: `step_out_en_${idx}`, text: step.expectedOutcomeId, toLang: 'en' });
    }
  });

  if (queue.length === 0) {
    onStatusUpdate?.('Format bilingual sudah lengkap!');
    return updated;
  }

  onStatusUpdate?.(`AI Agent sedang menerjemahkan ${queue.length} butir darurat EOP...`);
  const translations = await translateBatchWithAI(queue);

  if (translations.has('purpose_id')) updated.documentPurposeId = translations.get('purpose_id')!;
  if (translations.has('purpose_en')) updated.documentPurposeEn = translations.get('purpose_en')!;

  if (translations.has('cond_id')) updated.expectedConditionsId = translations.get('cond_id')!;
  if (translations.has('cond_en')) updated.expectedConditionsEn = translations.get('cond_en')!;

  updated.workSteps.forEach((step, idx) => {
    const actIdKey = `step_act_id_${idx}`;
    const actEnKey = `step_act_en_${idx}`;
    const outIdKey = `step_out_id_${idx}`;
    const outEnKey = `step_out_en_${idx}`;

    if (translations.has(actIdKey)) step.actionId = translations.get(actIdKey)!;
    if (translations.has(actEnKey)) step.actionEn = translations.get(actEnKey)!;
    if (translations.has(outIdKey)) step.expectedOutcomeId = translations.get(outIdKey)!;
    if (translations.has(outEnKey)) step.expectedOutcomeEn = translations.get(outEnKey)!;
  });

  onStatusUpdate?.('Penyelarasan bilingual EOP selesai!');
  return updated;
}
