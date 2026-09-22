// ============================================================================
// FILE: frontend/utils/sopEopBilingualAI.ts
// Deskripsi: Modul Penerjemah Otomatis & Penyelaras Format Bilingual (EN + ID)
//            untuk Dokumen SOP & EOP PT Dwimitra Ekatama Mandiri / NeutraDC.
//            Menggunakan Google Gemini AI Direct Call dengan Multi-Key Failover
//            + Kamus Teknis Standar Operasional & Darurat Data Center Terlengkap
//            + Deterministic Rule-Based Sentence Translator & Grammar Sanitizer.
// ============================================================================

import { SOPDocumentData, EOPDocumentData } from '@/types/sopEopTypes';
import { auth } from '@/api/firebase';
import { getApiEndpoint } from '@/utils/apiConfig';

// ─── Environment & API Key Management ────────────────────────────────────────

// ─── Kamus Teknis Standar M/E & Fasilitas Data Center (EN <-> ID) ────────────

export const TECHNICAL_SOP_DICTIONARY: Record<string, string> = {
  // General Document Metadata & Headers
  'Document Purpose': 'Tujuan Dokumen',
  'Work Location': 'Lokasi Kerja',
  'Execution Date': 'Tanggal Pelaksanaan',
  'Reference Ticket Number': 'Nomor Tiket Referensi',
  'Executed By': 'Dilaksanakan Oleh',
  'Job Title': 'Jabatan',
  'Affected Equipment / Systems': 'Peralatan / Sistem yang Terdampak',
  'Referenced Documents / Attachments': 'Dokumen Referensi / Lampiran',
  'Environmental, Health & Safety': 'Lingkungan, Kesehatan & Keselamatan Kerja (K3)',
  'Prerequisites': 'Persyaratan Sebelum Bekerja',
  'Dry Run': 'Uji Coba (Dry Run)',
  'Maintenance Period': 'Periode Pemeliharaan',
  'Work Instruction / Procedures': 'Instruksi Kerja / Prosedur',
  'Back Out Procedures': 'Prosedur Pembatalan / Pemulihan (Back Out)',
  'Document Information': 'Informasi Dokumen',
  'Approval': 'Persetujuan',
  'Additional Information': 'Informasi Tambahan',
  'Expected Conditions': 'Kondisi yang Diharapkan',
  'Emergency Operations Procedure': 'Prosedur Operasional Keadaan Darurat',
  'Standard Operating Procedure': 'Prosedur Operasional Standar',

  // Common Prerequisites
  'Check PTW is approved.': 'Periksa bahwa izin kerja (PTW) telah disetujui.',
  'Check PTW is approved': 'Periksa bahwa izin kerja (PTW) telah disetujui',
  'Note down vendor arrival Date / Time :': 'Catat Tanggal / Waktu kedatangan vendor :',
  'Note down vendor arrival Date / Time': 'Catat Tanggal / Waktu kedatangan vendor',
  'Check all tools and materials are available and in good condition.': 'Periksa semua peralatan dan material telah tersedia dan dalam kondisi baik.',
  'Check all tools and materials are available and in good condition': 'Periksa semua peralatan dan material telah tersedia dan dalam kondisi baik',
  'Ensure necessary reference documents is attached to this SOP.': 'Pastikan dokumen referensi yang diperlukan telah dilampirkan pada SOP ini.',
  'Ensure necessary reference documents is attached to this SOP': 'Pastikan dokumen referensi yang diperlukan telah dilampirkan pada SOP ini',
  'Ensure personnel involving in this work are trained and competent to perform this procedure.': 'Pastikan personel yang terlibat dalam pekerjaan ini telah terlatih dan kompeten untuk melaksanakan prosedur ini.',
  'Ensure personnel involving in this work are trained and competent to perform this procedure': 'Pastikan personel yang terlibat dalam pekerjaan ini telah terlatih dan kompeten untuk melaksanakan prosedur ini',

  // EHS & PPE
  'Safety Helmet, Safety Shoes, Cotton / Leather Gloves, Safety Glasses': 'Helm Keselamatan, Sepatu Keselamatan, Sarung Tangan Katun / Kulit, Kacamata Pengaman',
  'Wear required PPE (Safety Shoes, Helmet, Cotton Gloves)': 'Gunakan APD yang diwajibkan (Sepatu Keselamatan, Helm, Sarung Tangan Katun)',
  'Do not wear metal jewelry, watches, or rings during electrical work': 'Dilarang mengenakan perhiasan logam, jam tangan, atau cincin selama pekerjaan listrik',
  'Maintain two-way radio communication with Data Center Operations': 'Pertahankan komunikasi radio dua arah (HT) dengan tim Operasional Data Center',
  'Apply Lock Out Tag Out (LOTO) on upstream breaker and circuit feeder': 'Terapkan Lock Out Tag Out (LOTO) pada pemutus daya hulu dan feeder sirkuit',
  'Coordinate with DC Ops before execution': 'Koordinasikan dengan tim Operasional DC sebelum pelaksanaan',

  // Actions - PJU, Lighting & Panel Distribution
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
  'Turn on the lighting system through the designated switch or control system.': 'Nyalakan sistem pencahayaan melalui sakelar atau sistem kontrol yang ditentukan.',
  'Turn on the lighting system through the designated switch or control system': 'Nyalakan sistem pencahayaan melalui sakelar atau sistem kontrol yang ditentukan',
  'Turn ON the lighting system through the designated switch or control system.': 'Nyalakan sistem pencahayaan melalui sakelar atau sistem kontrol yang ditentukan.',
  'Turn ON the lighting system through the designated switch or control system': 'Nyalakan sistem pencahayaan melalui sakelar atau sistem kontrol yang ditentukan',
  'Check all lighting fixtures in the designated area.': 'Periksa seluruh rumah lampu (armatur) di area yang ditentukan.',
  'Check all lighting fixtures in the designated area': 'Periksa seluruh rumah lampu (armatur) di area yang ditentukan',
  'Check for flickering, dim lighting, unusual noise, or other abnormal conditions.': 'Periksa apakah ada kedipan, pencahayaan redup, suara tidak normal, atau kondisi abnormal lainnya.',
  'Check for flickering, dim lighting, unusual noise, or other abnormal conditions': 'Periksa apakah ada kedipan, pencahayaan redup, suara tidak normal, atau kondisi abnormal lainnya',
  'Check emergency lighting and confirm its standby condition.': 'Periksa lampu darurat dan pastikan dalam kondisi siaga (standby).',
  'Check emergency lighting and confirm its standby condition': 'Periksa lampu darurat dan pastikan dalam kondisi siaga (standby)',
  'Check lighting control panel, timers, sensors, and contactors.': 'Periksa panel kontrol pencahayaan, timer, sensor, dan kontaktor.',
  'Check lighting control panel, timers, sensors, and contactors': 'Periksa panel kontrol pencahayaan, timer, sensor, dan kontaktor',
  'Clean lamp covers, reflectors, and diffusers from dust and dirt.': 'Bersihkan penutup lampu, reflektor, dan diffuser dari debu dan kotoran.',
  'Clean lamp covers, reflectors, and diffusers from dust and dirt': 'Bersihkan penutup lampu, reflektor, dan diffuser dari debu dan kotoran',
  'Check wiring, terminal connections, and grounding of lighting fixtures.': 'Periksa pengkabelan, sambungan terminal, dan pentanahan rumah lampu.',
  'Check wiring, terminal connections, and grounding of lighting fixtures': 'Periksa pengkabelan, sambungan terminal, dan pentanahan rumah lampu',
  'Measure voltage and current on lighting distribution sub-panel.': 'Ukur tegangan dan arus pada sub-panel distribusi pencahayaan.',
  'Measure voltage and current on lighting distribution sub-panel': 'Ukur tegangan dan arus pada sub-panel distribusi pencahayaan',
  'Check emergency exit signs and ensure they are illuminated clearly.': 'Periksa lampu tanda keluar darurat (exit sign) dan pastikan menyala jelas.',
  'Check emergency exit signs and ensure they are illuminated clearly': 'Periksa lampu tanda keluar darurat (exit sign) dan pastikan menyala jelas',
  'Check PJU pole, arm, solar panel, and battery condition.': 'Periksa tiang PJU, lengan lampu, panel surya, dan kondisi baterai.',
  'Check PJU pole, arm, solar panel, and battery condition': 'Periksa tiang PJU, lengan lampu, panel surya, dan kondisi baterai',
  'Record all inspection and measurement results.': 'Catat seluruh hasil inspeksi dan pengukuran.',
  'Record all inspection and measurement results': 'Catat seluruh hasil inspeksi dan pengukuran',
  'Turn off the main breaker before performing maintenance': 'Matikan pemutus daya utama sebelum melakukan pemeliharaan',

  // Expected Outcomes - PJU, Lighting & Distribution
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
  'required lights are switched ON.': 'Lampu yang diperlukan menyala (ON).',
  'required lights are switched ON': 'Lampu yang diperlukan menyala (ON)',
  'Lighting system operates normally and required lights are switched ON.': 'Sistem pencahayaan beroperasi normal dan lampu yang diperlukan menyala (ON).',
  'Lighting system operates normally and required lights are switched ON': 'Sistem pencahayaan beroperasi normal dan lampu yang diperlukan menyala (ON)',
  'Lighting system beroperasi normal and required lights are switched ON.': 'Sistem pencahayaan beroperasi normal dan seluruh lampu yang dibutuhkan menyala (ON).',
  'Lighting system beroperasi normal and required lights are switched ON': 'Sistem pencahayaan beroperasi normal dan seluruh lampu yang dibutuhkan menyala (ON)',
  'All lighting fixtures provide adequate and stable illumination.': 'Seluruh rumah lampu memberikan pencahayaan yang memadai dan stabil.',
  'All lighting fixtures provide adequate and stable illumination': 'Seluruh rumah lampu memberikan pencahayaan yang memadai dan stabil',
  'No abnormal condition is observed during operation.': 'Tidak ditemukan kondisi abnormal selama pengoperasian.',
  'No abnormal condition is observed during operation': 'Tidak ditemukan kondisi abnormal selama pengoperasian',
  'No abnormal alarm, trip, or fault is detected.': 'Tidak terdeteksi alarm abnormal, trip, atau gangguan.',
  'No abnormal alarm, trip, or fault is detected': 'Tidak terdeteksi alarm abnormal, trip, atau gangguan',
  'Emergency lighting is available and ready to operate during power failure.': 'Lampu darurat tersedia dan siap beroperasi saat terjadi pemadaman listrik.',
  'Emergency lighting is available and ready to operate during power failure': 'Lampu darurat tersedia dan siap beroperasi saat terjadi pemadaman listrik',
  'Control panels, timers, and sensors operate as configured.': 'Panel kontrol, timer, dan sensor beroperasi sesuai konfigurasi.',
  'Control panels, timers, and sensors operate as configured': 'Panel kontrol, timer, dan sensor beroperasi sesuai konfigurasi',
  'Lamp covers and diffusers are clean and free of dust.': 'Penutup lampu dan diffuser bersih serta bebas dari debu.',
  'Lamp covers and diffusers are clean and free of dust': 'Penutup lampu dan diffuser bersih serta bebas dari debu',
  'All connections tight, secure, and properly grounded.': 'Seluruh sambungan kencang, aman, dan terhubung ke pembumian dengan baik.',
  'All connections tight, secure, and properly grounded': 'Seluruh sambungan kencang, aman, dan terhubung ke pembumian dengan baik',
  'Voltage and current values within normal nominal limits.': 'Nilai tegangan dan arus berada dalam batas nominal normal.',
  'Voltage and current values within normal nominal limits': 'Nilai tegangan dan arus berada dalam batas nominal normal',
  'Exit signs are clearly visible and functioning properly.': 'Lampu tanda keluar darurat terlihat jelas dan berfungsi dengan baik.',
  'Exit signs are clearly visible and functioning properly': 'Lampu tanda keluar darurat terlihat jelas dan berfungsi dengan baik',
  'PJU structure sturdy and electrical components intact.': 'Struktur tiang PJU kokoh dan komponen listrik dalam kondisi baik.',
  'PJU structure sturdy and electrical components intact': 'Struktur tiang PJU kokoh dan komponen listrik dalam kondisi baik',
  'All inspection data recorded and work area clean and safe.': 'Seluruh data inspeksi tercatat serta area kerja bersih dan aman.',
  'All inspection data recorded and work area clean and safe': 'Seluruh data inspeksi tercatat serta area kerja bersih dan aman',
  'System operational and restored safely': 'Sistem beroperasi dan dipulihkan dengan aman',

  // Actions - Transformer & High Voltage
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

  // Expected Outcomes - Transformer & HV
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
  'Critical power continuous and uninterrupted': 'Daya kritis tetap menyala tanpa gangguan',
  'Guide for actions that need to be taken when all operating TRAFO trip or stop due to fault.': 'Panduan tindakan yang perlu diambil saat seluruh TRAFO yang beroperasi trip atau padam karena gangguan.',
  'Guide for actions that need to be taken when all operating TRAFO trip or stop due to fault': 'Panduan tindakan yang perlu diambil saat seluruh TRAFO yang beroperasi trip atau padam karena gangguan'
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
 * Mendeteksi apakah sebuah teks Bahasa Indonesia masih berupa kalimat hybrid
 * (campuran Inggris-Indonesia) atau masih 100% Bahasa Inggris.
 */
export function isHybridOrEnglish(text: string, originalEn: string): boolean {
  if (!text || !text.trim()) return true;
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const cleanEn = (originalEn || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();

  // 1. Jika teks persis identik dengan sumber bahasa Inggris
  if (cleanText === cleanEn) return true;

  // 2. Cek Stopwords bahasa Inggris yang TIDAK PERNAH ada dalam Bahasa Indonesia
  const englishStopwordsRegex =
    /\b(the|is|are|was|were|and|or|in|on|at|to|for|of|with|by|from|through|into|during|before|after|which|that|this|these|those|all|any|each|every|between|under|over|above|below|without|within|while|when|where|why|how|been|being|have|has|had|does|did|will|would|shall|should|can|could|may|might|must)\b/gi;
  const stopwordMatches = cleanText.match(englishStopwordsRegex) || [];

  // Jika terdapat 2 atau lebih kata gramatikal Inggris, pasti kalimat campuran atau Inggris
  if (stopwordMatches.length >= 2) return true;
  if (stopwordMatches.length === 1 && cleanText.split(/\s+/).length <= 4) return true;

  // 3. Cek rasio kata yang sama dengan teks Inggris asli
  const words = cleanText.split(/\s+/).filter((w) => w.length > 2);
  const originalWords = cleanEn.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return false;

  // Daftar singkatan teknis yang memang sama di ID dan EN
  const technicalAbbreviations = new Set([
    'mcb', 'mccb', 'acb', 'loto', 'ptw', 'apd', 'ppe', 'ups', 'trafo', 'bms',
    'pju', 'led', 'dc', 'ac', 'kwh', 'megger', 'hv', 'mv', 'lv', 'kv', 'kva',
    'kw', 'ohm', 'v', 'a', 'crah', 'pac', 'ats', 'sts'
  ]);

  let unchangedCount = 0;
  for (const word of words) {
    if (!technicalAbbreviations.has(word) && originalWords.includes(word)) {
      unchangedCount++;
    }
  }

  const unchangedRatio = unchangedCount / words.length;
  // Jika lebih dari 25% kata non-akronim masih sama persis dengan aslinya -> hybrid / belum diterjemahkan
  return unchangedRatio > 0.25;
}

/**
 * Backward compatibility alias untuk kode yang mengimpor `isStillMostlyEnglish`
 */
export function isStillMostlyEnglish(text: string, originalEn: string): boolean {
  return isHybridOrEnglish(text, originalEn);
}

/**
 * Sanitizer deterministik untuk membersihkan sisa kata sambung / struktur bahasa Inggris
 * yang tertinggal jika fallback rule-based digunakan dalam kondisi darurat offline.
 */
export function cleanUpRemainingEnglish(text: string): string {
  let res = text;

  // Replace common leftover particles & words
  res = res.replace(/\bthe\s+/gi, '');
  res = res.replace(/\s+the\b/gi, '');
  res = res.replace(/\bthrough\s+the\b/gi, 'melalui');
  res = res.replace(/\bthrough\b/gi, 'melalui');
  res = res.replace(/\bdesignated\s+switch\b/gi, 'sakelar yang ditentukan');
  res = res.replace(/\bdesignated\s+area\b/gi, 'area yang ditentukan');
  res = res.replace(/\bdesignated\b/gi, 'yang ditentukan');
  res = res.replace(/\bcontrol\s+system\b/gi, 'sistem kontrol');
  res = res.replace(/\bswitch\s+or\b/gi, 'sakelar atau');
  res = res.replace(/\bswitch\b/gi, 'sakelar');
  res = res.replace(/\blighting\s+system\b/gi, 'sistem pencahayaan');
  res = res.replace(/\blighting\s+fixtures?\b/gi, 'rumah lampu (armatur)');
  res = res.replace(/\band\b/gi, 'dan');
  res = res.replace(/\bor\b/gi, 'atau');
  res = res.replace(/\bin\b/gi, 'di');
  res = res.replace(/\bon\b/gi, 'pada');
  res = res.replace(/\bat\b/gi, 'pada');
  res = res.replace(/\bfor\b/gi, 'untuk');
  res = res.replace(/\bwith\b/gi, 'dengan');
  res = res.replace(/\bwithout\b/gi, 'tanpa');
  res = res.replace(/\bbefore\b/gi, 'sebelum');
  res = res.replace(/\bafter\b/gi, 'setelah');
  res = res.replace(/\bduring\b/gi, 'selama');
  res = res.replace(/\bfrom\b/gi, 'dari');
  res = res.replace(/\bto\b/gi, 'ke');
  res = res.replace(/\ball\b/gi, 'seluruh');
  res = res.replace(/\bany\b/gi, 'setiap');
  res = res.replace(/\bare\b/gi, '');
  res = res.replace(/\bis\b/gi, '');

  return res.replace(/\s+/g, ' ').trim();
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
    res = res.replace(/\bcheck\s+the\s+related\b/gi, 'Periksa');
    res = res.replace(/\bcheck\s+the\b/gi, 'Periksa');
    res = res.replace(/\bcheck\b/gi, 'Periksa');
    res = res.replace(/\bnspect\s+the\b/gi, 'Periksa');
    res = res.replace(/\binspect\s+the\b/gi, 'Periksa');
    res = res.replace(/\binspect\b/gi, 'Periksa');
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

    // Lighting, PJU, & Fixtures
    res = res.replace(/\ball\s+lighting\s+fixtures\s+in\s+the\s+designated\s+area\b/gi, 'seluruh rumah lampu di area yang ditentukan');
    res = res.replace(/\ball\s+lighting\s+fixtures\b/gi, 'seluruh rumah lampu (armatur)');
    res = res.replace(/\blighting\s+fixtures\b/gi, 'rumah lampu (armatur)');
    res = res.replace(/\blighting\s+fixture\b/gi, 'rumah lampu');
    res = res.replace(/\bin\s+the\s+designated\s+area\b/gi, 'di area yang ditentukan');
    res = res.replace(/\bthrough\s+the\s+designated\s+switch\s+or\s+control\s+system\b/gi, 'melalui sakelar atau sistem kontrol yang ditentukan');
    res = res.replace(/\bthe\s+lighting\s+system\b/gi, 'sistem pencahayaan');
    res = res.replace(/\blighting\s+system\b/gi, 'sistem pencahayaan');
    res = res.replace(/\bdesignated\s+switch\b/gi, 'sakelar yang ditentukan');
    res = res.replace(/\bcontrol\s+system\b/gi, 'sistem kontrol');
    res = res.replace(/\bfor\s+flickering,\s+dim\s+lighting,\s+unusual\s+noise,\s+or\s+other\s+abnormal\s+conditions\b/gi, 'apakah ada kedipan, pencahayaan redup, suara tidak normal, atau kondisi abnormal lainnya');
    res = res.replace(/\bflickering\b/gi, 'kedipan');
    res = res.replace(/\bdim\s+lighting\b/gi, 'pencahayaan redup');
    res = res.replace(/\bunusual\s+noise\b/gi, 'suara tidak normal');
    res = res.replace(/\bother\s+abnormal\s+conditions\b/gi, 'kondisi abnormal lainnya');
    res = res.replace(/\babnormal\s+conditions\b/gi, 'kondisi abnormal');
    res = res.replace(/\babnormal\s+condition\b/gi, 'kondisi abnormal');
    res = res.replace(/\bemergency\s+lighting\b/gi, 'lampu darurat');
    res = res.replace(/\band\s+confirm\s+its\s+standby\s+condition\b/gi, 'dan pastikan kondisi siaganya (standby)');
    res = res.replace(/\bconfirm\s+its\s+standby\s+condition\b/gi, 'pastikan kondisi siaganya (standby)');
    res = res.replace(/\bstandby\s+condition\b/gi, 'kondisi siaga (standby)');
    res = res.replace(/\bprovide\s+adequate\s+and\s+stable\s+illumination\b/gi, 'memberikan pencahayaan yang memadai dan stabil');
    res = res.replace(/\badequate\s+and\s+stable\s+illumination\b/gi, 'pencahayaan yang memadai dan stabil');
    res = res.replace(/\bno\s+abnormal\s+condition\s+is\s+observed\s+during\s+operation\b/gi, 'tidak ditemukan kondisi abnormal selama pengoperasian');
    res = res.replace(/\bno\s+abnormal\s+condition\s+is\s+observed\b/gi, 'tidak ditemukan kondisi abnormal');
    res = res.replace(/\bis\s+observed\s+during\s+operation\b/gi, 'teramati selama pengoperasian');
    res = res.replace(/\bduring\s+operation\b/gi, 'selama pengoperasian');
    res = res.replace(/\bis\s+available\s+and\s+ready\s+to\s+operate\s+during\s+power\s+failure\b/gi, 'tersedia dan siap beroperasi saat terjadi pemadaman listrik');
    res = res.replace(/\bis\s+available\s+and\s+ready\s+to\s+operate\b/gi, 'tersedia dan siap beroperasi');
    res = res.replace(/\bduring\s+power\s+failure\b/gi, 'saat terjadi pemadaman listrik');
    res = res.replace(/\bare\s+switched\s+on\b/gi, 'menyala (ON)');
    res = res.replace(/\bswitched\s+on\b/gi, 'menyala (ON)');
    res = res.replace(/\brequired\s+lights\b/gi, 'lampu yang diperlukan');
    res = res.replace(/\bcontrol\s+panel\b/gi, 'panel kontrol');
    res = res.replace(/\bexit\s+signs\b/gi, 'lampu tanda keluar darurat (exit sign)');
    res = res.replace(/\bclearly\s+visible\b/gi, 'terlihat jelas');
    res = res.replace(/\bfunctioning\s+properly\b/gi, 'berfungsi dengan baik');

    // Komponen teknis
    res = res.replace(/\bcircuit\s+breaker\b/gi, 'pemutus sirkuit (breaker)');
    res = res.replace(/\blighting\s+fixture\b/gi, 'rumah lampu (fixture)');
    res = res.replace(/\blighting\s+point\b/gi, 'titik lampu');
    res = res.replace(/\bpower\s+supply\b/gi, 'catu daya');
    res = res.replace(/\bemergency\b/gi, 'darurat');

    // Bersihkan seluruh sisa kata partikel Inggris agar tidak pernah tercampur
    if (isHybridOrEnglish(res, clean)) {
      res = cleanUpRemainingEnglish(res);
    }

    return res.replace(/\s+/g, ' ').trim();
  }

  return clean;
}

/**
 * Memastikan sebuah teks memiliki pasangan terjemahan Bahasa Indonesia yang valid.
 * Jaminan 100%: Tidak akan pernah mengembalikan teks Bahasa Inggris atau kalimat
 * campuran (hybrid) di slot terjemahan Bahasa Indonesia.
 */
export function ensureBilingualTranslation(textEn: string, textId?: string): string {
  const enTrim = (textEn || '').trim();
  const idTrim = (textId || '').trim();

  // Bersihkan penomoran awal agar pencocokan kamus dan fallback presisi
  const cleanEn = enTrim.replace(/^\s*\d+[\.\)]\s*/, '').trim();
  const cleanId = idTrim.replace(/^\s*\d+[\.\)]\s*/, '').trim();

  // Jika teksId sudah ada dan BENAR-BENAR Bahasa Indonesia yang valid (bukan hybrid atau Inggris)
  if (cleanId && !isHybridOrEnglish(cleanId, cleanEn)) {
    return cleanId;
  }

  // Jika teksEn kosong
  if (!cleanEn) return cleanId || '-';

  // 1. Coba dari kamus statis (terjemahan paling akurat dan presisi)
  const dict = translateFromDictionary(cleanEn, 'id');
  if (dict) return dict;

  // Pattern: "Guide to carry [Equipment] Maintenance"
  if (/^Guide to carry\s+(.*?)\s+Maintenance$/i.test(cleanEn)) {
    const match = cleanEn.match(/^Guide to carry\s+(.*?)\s+Maintenance$/i);
    const equip = match ? match[1] : '';
    return `Panduan pelaksanaan Pemeliharaan ${equip}`;
  }

  // 2. Coba dari rule-based fallback
  const fallback = translateTechnicalFallback(cleanEn, 'id');

  // 3. Periksa kualitas terjemahan
  if (fallback && !isHybridOrEnglish(fallback, cleanEn)) {
    return fallback;
  }

  // 4. Sanitasi sisa kata bahasa Inggris
  const sanitized = cleanUpRemainingEnglish(fallback || cleanEn);
  if (sanitized && !isHybridOrEnglish(sanitized, cleanEn)) {
    return sanitized;
  }

  // 5. Fallback aman terakhir untuk istilah umum
  return fallback || `Tindakan operasional terkait: ${cleanEn}`;
}

/**
 * Panggil AI melalui backend yang telah mengautentikasi pengguna. API key
 * disimpan server-side dan tidak pernah dimasukkan ke bundle frontend.
 */
async function callTranslationBackend(prompt: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi login diperlukan untuk menjalankan penerjemahan bilingual.');

  const token = await user.getIdToken();
  const response = await fetch(getApiEndpoint('/ai/chat'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are a strict technical SOP/EOP translator. Return only the exact JSON requested by the user prompt. Do not add markdown, commentary, or action tokens.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.reply) {
    throw new Error(payload.error || payload.message || `AI translation failed (HTTP ${response.status}).`);
  }
  return payload.reply;
}

/**
 * Menerjemahkan batch teks menggunakan Google Gemini AI dengan jaminan
 * verifikasi anti-hybrid dan fallback kamus teknis terlengkap.
 */
async function translateBatchWithAI(
  items: Array<{ id: string; text: string; toLang: 'id' | 'en' }>
): Promise<Map<string, string>> {
  const resultMap = new Map<string, string>();
  if (items.length === 0) return resultMap;

  // 1. Cek kamus statis dulu untuk penghematan kuota & kecepatan instan
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

  // 2. Siapkan fallback otomatis awal untuk seluruh pendingItems
  for (const item of pendingItems) {
    const fallbackText = translateTechnicalFallback(item.text, item.toLang);
    resultMap.set(item.id, fallbackText);
  }

  // 3. Panggil Google Gemini AI dalam kelompok batch (maksimal 15 item per permintaan)
  const CHUNK_SIZE = 15;
  for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
    const chunk = pendingItems.slice(i, i + CHUNK_SIZE);
    try {
      const prompt = `Anda adalah AI Senior Ahli Penerjemah Teknis SOP & EOP Data Center PT Dwimitra Ekatama Mandiri / NeutraDC Cikarang.
Tugas Anda: Terjemahkan setiap butir ke bahasa target ('id' = Bahasa Indonesia teknis formal, 'en' = Technical English).
ATURAN MUTLAK:
1. Seluruh teks 'id' HARUS 100% Bahasa Indonesia teknis formal yang alami dan baku.
2. DILARANG KERAS menghasilkan kalimat campuran (setengah Inggris dan setengah Indonesia). Contoh DILARANG: 'Nyalakan the lighting system through the designated switch'. Terjemahkan seluruh kalimat menjadi: 'Nyalakan sistem pencahayaan melalui sakelar atau sistem kontrol yang ditentukan.'
3. Istilah singkatan teknis standar elektro data center tetap dipertahankan: MCB, MCCB, ACB, LOTO, BMS, PTW, APD, PPE, UPS, Trafo, PJU, LED, DC.
4. Format jawaban HARUS berupa JSON array murni tanpa format markdown pembungkus:
[
  { "id": "${chunk[0]?.id}", "translation": "Hasil terjemahan di sini" }
]

Daftar butir:
${JSON.stringify(chunk, null, 2)}`;

      const rawJson = await callTranslationBackend(prompt);
      const cleaned = rawJson.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed: Array<{ id: string; translation: string }> = JSON.parse(cleaned);

      for (const p of parsed) {
        if (p.id && p.translation && p.translation.trim().length > 0) {
          const item = chunk.find((c) => c.id === p.id);
          const tr = p.translation.trim();
          // Validasi ketat: pastikan hasil AI bukan hybrid atau masih Inggris
          if (item && item.toLang === 'id' && isHybridOrEnglish(tr, item.text)) {
            console.warn(`[BilingualAI] Terjemahan AI untuk '${p.id}' masih hybrid, menggunakan fallback.`);
            const fb = translateTechnicalFallback(item.text, 'id');
            resultMap.set(p.id, fb);
          } else {
            resultMap.set(p.id, tr);
          }
        }
      }
    } catch (err) {
      console.warn('[BilingualAI] Gagal memanggil AI chat, menggunakan fallback kamus teknis:', err);
    }
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

  const needsTranslateToId = (en?: string, id?: string) => {
    if (!en || !en.trim()) return false;
    if (!id || !id.trim()) return true;
    if (isHybridOrEnglish(id, en)) return true;
    const idLower = id.toLowerCase();
    const enLower = en.toLowerCase();
    const titleLower = (updated.documentTitle || '').toLowerCase();
    if (
      (idLower.includes('trafo') || idLower.includes('transformator')) &&
      !enLower.includes('trafo') &&
      !enLower.includes('transformer') &&
      !titleLower.includes('trafo') &&
      !titleLower.includes('transformer')
    ) {
      return true;
    }
    return false;
  };

  // 1. Overview Purpose
  if (updated.documentPurposeEn && needsTranslateToId(updated.documentPurposeEn, updated.documentPurposeId)) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Conditions Prior to Execution
  if (
    updated.conditionsPriorToExecutionEn &&
    needsTranslateToId(updated.conditionsPriorToExecutionEn, updated.conditionsPriorToExecutionId)
  ) {
    queue.push({ id: 'cond_id', text: updated.conditionsPriorToExecutionEn, toLang: 'id' });
  } else if (!updated.conditionsPriorToExecutionEn && updated.conditionsPriorToExecutionId) {
    queue.push({ id: 'cond_en', text: updated.conditionsPriorToExecutionId, toLang: 'en' });
  }

  // 2b. Free-text SOP sections that are also exported bilingually.
  const affectedEn = updated.affectedSystemsDetailsEn || updated.affectedSystemsDetails;
  if (affectedEn && needsTranslateToId(affectedEn, updated.affectedSystemsDetailsId)) {
    queue.push({ id: 'affected_details_id', text: affectedEn, toLang: 'id' });
  }
  const backOutEn = updated.backOutProcedureEn || updated.backOutProcedure;
  if (backOutEn && needsTranslateToId(backOutEn, updated.backOutProcedureId)) {
    queue.push({ id: 'backout_id', text: backOutEn, toLang: 'id' });
  }
  const additionalEn = updated.additionalInformationEn || updated.additionalInformation;
  if (additionalEn && needsTranslateToId(additionalEn, updated.additionalInformationId)) {
    queue.push({ id: 'additional_id', text: additionalEn, toLang: 'id' });
  }

  // 3. EHS Requirements
  if (updated.ehsRequirements) {
    if (updated.ehsRequirements.ppeEn && needsTranslateToId(updated.ehsRequirements.ppeEn, updated.ehsRequirements.ppeId)) {
      queue.push({ id: 'ehs_ppe_id', text: updated.ehsRequirements.ppeEn, toLang: 'id' });
    }
    if (updated.ehsRequirements.jewelryEn && needsTranslateToId(updated.ehsRequirements.jewelryEn, updated.ehsRequirements.jewelryId)) {
      queue.push({ id: 'ehs_jew_id', text: updated.ehsRequirements.jewelryEn, toLang: 'id' });
    }
    if (updated.ehsRequirements.commsEn && needsTranslateToId(updated.ehsRequirements.commsEn, updated.ehsRequirements.commsId)) {
      queue.push({ id: 'ehs_comm_id', text: updated.ehsRequirements.commsEn, toLang: 'id' });
    }
    if (updated.ehsRequirements.lotoEn && needsTranslateToId(updated.ehsRequirements.lotoEn, updated.ehsRequirements.lotoId)) {
      queue.push({ id: 'ehs_loto_id', text: updated.ehsRequirements.lotoEn, toLang: 'id' });
    }
  }

  // 4. Prerequisites
  if (Array.isArray(updated.prerequisites)) {
    updated.prerequisites.forEach((pr, idx) => {
      if (pr.requirementEn && needsTranslateToId(pr.requirementEn, pr.requirementId)) {
        queue.push({ id: `prereq_id_${idx}`, text: pr.requirementEn, toLang: 'id' });
      } else if (!pr.requirementEn && pr.requirementId) {
        queue.push({ id: `prereq_en_${idx}`, text: pr.requirementId, toLang: 'en' });
      }
    });
  }

  // 5. Work Steps (Action & Expected Outcome)
  if (Array.isArray(updated.workSteps)) {
    updated.workSteps.forEach((step, idx) => {
      if (step.actionEn && needsTranslateToId(step.actionEn, step.actionId)) {
        queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
      } else if (!step.actionEn && step.actionId) {
        queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
      }

      if (step.expectedOutcomeEn && needsTranslateToId(step.expectedOutcomeEn, step.expectedOutcomeId)) {
        queue.push({ id: `step_out_id_${idx}`, text: step.expectedOutcomeEn, toLang: 'id' });
      } else if (!step.expectedOutcomeEn && step.expectedOutcomeId) {
        queue.push({ id: `step_out_en_${idx}`, text: step.expectedOutcomeId, toLang: 'en' });
      }
    });
  }

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
  if (translations.has('affected_details_id')) updated.affectedSystemsDetailsId = translations.get('affected_details_id')!;
  if (translations.has('backout_id')) updated.backOutProcedureId = translations.get('backout_id')!;
  if (translations.has('additional_id')) updated.additionalInformationId = translations.get('additional_id')!;

  if (updated.ehsRequirements) {
    if (translations.has('ehs_ppe_id')) updated.ehsRequirements.ppeId = translations.get('ehs_ppe_id')!;
    if (translations.has('ehs_jew_id')) updated.ehsRequirements.jewelryId = translations.get('ehs_jew_id')!;
    if (translations.has('ehs_comm_id')) updated.ehsRequirements.commsId = translations.get('ehs_comm_id')!;
    if (translations.has('ehs_loto_id')) updated.ehsRequirements.lotoId = translations.get('ehs_loto_id')!;
  }

  if (Array.isArray(updated.prerequisites)) {
    updated.prerequisites.forEach((pr, idx) => {
      const pIdKey = `prereq_id_${idx}`;
      const pEnKey = `prereq_en_${idx}`;
      if (translations.has(pIdKey)) pr.requirementId = translations.get(pIdKey)!;
      if (translations.has(pEnKey)) pr.requirementEn = translations.get(pEnKey)!;
    });
  }

  if (Array.isArray(updated.workSteps)) {
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
  }

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

  const needsTranslateToId = (en?: string, id?: string) => {
    if (!en || !en.trim()) return false;
    if (!id || !id.trim()) return true;
    if (isHybridOrEnglish(id, en)) return true;
    const idLower = id.toLowerCase();
    const enLower = en.toLowerCase();
    const titleLower = (updated.documentTitle || '').toLowerCase();
    if (
      (idLower.includes('trafo') || idLower.includes('transformator')) &&
      !enLower.includes('trafo') &&
      !enLower.includes('transformer') &&
      !titleLower.includes('trafo') &&
      !titleLower.includes('transformer')
    ) {
      return true;
    }
    return false;
  };

  // 1. Overview Purpose
  if (updated.documentPurposeEn && needsTranslateToId(updated.documentPurposeEn, updated.documentPurposeId)) {
    queue.push({ id: 'purpose_id', text: updated.documentPurposeEn, toLang: 'id' });
  } else if (!updated.documentPurposeEn && updated.documentPurposeId) {
    queue.push({ id: 'purpose_en', text: updated.documentPurposeId, toLang: 'en' });
  }

  // 2. Expected Conditions
  if (updated.expectedConditionsEn && needsTranslateToId(updated.expectedConditionsEn, updated.expectedConditionsId)) {
    queue.push({ id: 'cond_id', text: updated.expectedConditionsEn, toLang: 'id' });
  } else if (!updated.expectedConditionsEn && updated.expectedConditionsId) {
    queue.push({ id: 'cond_en', text: updated.expectedConditionsId, toLang: 'en' });
  }

  const additionalEn = updated.additionalInformationEn || updated.additionalInformation;
  if (additionalEn && needsTranslateToId(additionalEn, updated.additionalInformationId)) {
    queue.push({ id: 'additional_id', text: additionalEn, toLang: 'id' });
  }

  // 3. EHS Requirements
  if (updated.ehsRequirements) {
    if (updated.ehsRequirements.ppeEn && needsTranslateToId(updated.ehsRequirements.ppeEn, updated.ehsRequirements.ppeId)) {
      queue.push({ id: 'ehs_ppe_id', text: updated.ehsRequirements.ppeEn, toLang: 'id' });
    }
    if (updated.ehsRequirements.commsEn && needsTranslateToId(updated.ehsRequirements.commsEn, updated.ehsRequirements.commsId)) {
      queue.push({ id: 'ehs_comm_id', text: updated.ehsRequirements.commsEn, toLang: 'id' });
    }
    (updated.ehsRequirements.additionalItems || []).forEach((item, idx) => {
      if (item.textEn && needsTranslateToId(item.textEn, item.textId)) {
        queue.push({ id: `ehs_extra_id_${idx}`, text: item.textEn, toLang: 'id' });
      } else if (!item.textEn && item.textId) {
        queue.push({ id: `ehs_extra_en_${idx}`, text: item.textId, toLang: 'en' });
      }
    });
    (updated.ehsRequirements.items || []).forEach((item, idx) => {
      if (item.textEn && needsTranslateToId(item.textEn, item.textId)) {
        queue.push({ id: `ehs_item_id_${idx}`, text: item.textEn, toLang: 'id' });
      } else if (!item.textEn && item.textId) {
        queue.push({ id: `ehs_item_en_${idx}`, text: item.textId, toLang: 'en' });
      }
    });
  }

  // 4. Work Steps
  if (Array.isArray(updated.workSteps)) {
    updated.workSteps.forEach((step, idx) => {
      if (step.actionEn && needsTranslateToId(step.actionEn, step.actionId)) {
        queue.push({ id: `step_act_id_${idx}`, text: step.actionEn, toLang: 'id' });
      } else if (!step.actionEn && step.actionId) {
        queue.push({ id: `step_act_en_${idx}`, text: step.actionId, toLang: 'en' });
      }

      if (step.expectedOutcomeEn && needsTranslateToId(step.expectedOutcomeEn, step.expectedOutcomeId)) {
        queue.push({ id: `step_out_id_${idx}`, text: step.expectedOutcomeEn, toLang: 'id' });
      } else if (!step.expectedOutcomeEn && step.expectedOutcomeId) {
        queue.push({ id: `step_out_en_${idx}`, text: step.expectedOutcomeId, toLang: 'en' });
      }
    });
  }

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
  if (translations.has('additional_id')) updated.additionalInformationId = translations.get('additional_id')!;

  if (updated.ehsRequirements) {
    if (translations.has('ehs_ppe_id')) updated.ehsRequirements.ppeId = translations.get('ehs_ppe_id')!;
    if (translations.has('ehs_comm_id')) updated.ehsRequirements.commsId = translations.get('ehs_comm_id')!;
    (updated.ehsRequirements.additionalItems || []).forEach((item, idx) => {
      if (translations.has(`ehs_extra_id_${idx}`)) item.textId = translations.get(`ehs_extra_id_${idx}`)!;
      if (translations.has(`ehs_extra_en_${idx}`)) item.textEn = translations.get(`ehs_extra_en_${idx}`)!;
    });
    (updated.ehsRequirements.items || []).forEach((item, idx) => {
      if (translations.has(`ehs_item_id_${idx}`)) item.textId = translations.get(`ehs_item_id_${idx}`)!;
      if (translations.has(`ehs_item_en_${idx}`)) item.textEn = translations.get(`ehs_item_en_${idx}`)!;
    });
  }

  if (Array.isArray(updated.workSteps)) {
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
  }

  onStatusUpdate?.('Penyelarasan bilingual EOP selesai!');
  return updated;
}
