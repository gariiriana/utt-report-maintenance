// ============================================================================
// FILE: frontend/utils/sopEopBilingualAI.ts
// Deskripsi: Modul Penerjemah Otomatis & Penyelaras Format Bilingual (EN + ID)
//            untuk Dokumen SOP & EOP PT Dwimitra Ekatama Mandiri / NeutraDC.
//            Menggunakan backend Google Gemini AI (/api/ai/chat) + Kamus Teknis M/E.
// ============================================================================

import { getApiEndpoint } from '@/utils/apiConfig';
import { SOPDocumentData, EOPDocumentData } from '@/types/sopEopTypes';

// Kamus Teknis Standar Operasional & Darurat Data Center (Fallback Cepat)
const TECHNICAL_SOP_DICTIONARY: Record<string, string> = {
  // Common Actions
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
function translateFromDictionary(text: string, toLang: 'id' | 'en'): string | null {
  const clean = text.trim();
  if (!clean) return null;

  if (toLang === 'id') {
    if (TECHNICAL_SOP_DICTIONARY[clean]) return TECHNICAL_SOP_DICTIONARY[clean];
    const lower = clean.toLowerCase();
    for (const [en, id] of Object.entries(TECHNICAL_SOP_DICTIONARY)) {
      if (en.toLowerCase() === lower) return id;
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
 * Menerjemahkan batch teks menggunakan endpoint AI Gemini backend (/api/ai/chat)
 */
async function translateBatchWithAI(
  items: Array<{ id: string; text: string; toLang: 'id' | 'en' }>
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  if (items.length === 0) return resultMap;

  // Cek kamus statis dulu
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

  try {
    const prompt = `
Tugas: Anda adalah AI Senior Ahli Penerjemah Teknis SOP & EOP Data Center PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang.
Terjemahkan setiap teks teknis berikut ke bahasa target yang diminta ('id' = Bahasa Indonesia teknis formal, 'en' = Technical English).
Gunakan peristilahan baku elektro & fasilitas data center (misal: trafo, transformator, breaker, grounding, LOTO, isolasi megger, arus, tegangan, beban kritis).

Daftar item:
${JSON.stringify(pendingItems, null, 2)}

Format jawaban HARUS berupa JSON array murni tanpa kutip markdown pembungkus:
[
  { "id": "step_action_0", "translation": "Hasil terjemahan teknis di sini" }
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
        if (p.id && p.translation) {
          resultMap.set(p.id, p.translation.trim());
        }
      }
    }
  } catch (err) {
    console.warn('[BilingualAI] Gagal memanggil AI chat, menggunakan fallback:', err);
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

  // 1. Overview Purpose
  if (updated.documentPurposeEn && !updated.documentPurposeId) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Conditions Prior to Execution
  if (updated.conditionsPriorToExecutionEn && !updated.conditionsPriorToExecutionId) {
    queue.push({ id: 'cond_id', text: updated.conditionsPriorToExecutionEn, toLang: 'id' });
  } else if (!updated.conditionsPriorToExecutionEn && updated.conditionsPriorToExecutionId) {
    queue.push({ id: 'cond_en', text: updated.conditionsPriorToExecutionId, toLang: 'en' });
  }

  // 3. Work Steps (Action & Expected Outcome)
  updated.workSteps.forEach((step, idx) => {
    if (step.actionEn && !step.actionId) {
      queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
    } else if (!step.actionEn && step.actionId) {
      queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
    }

    if (step.expectedOutcomeEn && !step.expectedOutcomeId) {
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

  // 1. Overview Purpose
  if (updated.documentPurposeEn && !updated.documentPurposeId) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Expected Conditions
  if (updated.expectedConditionsEn && !updated.expectedConditionsId) {
    queue.push({ id: 'cond_id', text: updated.expectedConditionsEn, toLang: 'id' });
  } else if (!updated.expectedConditionsEn && updated.expectedConditionsId) {
    queue.push({ id: 'cond_en', text: updated.expectedConditionsId, toLang: 'en' });
  }

  // 3. Work Steps
  updated.workSteps.forEach((step, idx) => {
    if (step.actionEn && !step.actionId) {
      queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
    } else if (!step.actionEn && step.actionId) {
      queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
    }

    if (step.expectedOutcomeEn && !step.expectedOutcomeId) {
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
