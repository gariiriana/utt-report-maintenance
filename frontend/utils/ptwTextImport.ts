// ============================================================================
// FILE: ptwTextImport.ts
// Deskripsi: Parser daftar nomor PTW berbentuk teks (salinan chat WhatsApp).
//            Format yang didukung:
//              3 Agustus                          <- header tanggal (boleh *bold*)
//              *584*. TDE/PTW/0633/LV/03/2026/08  <- nomor urut chat diabaikan
//              - TDE/PTW/0811/WLD/04/2026/10
//            Tahun diambil dari nomor PTW, tanggal dari header terakhir di atasnya.
// ============================================================================

const EQUIPMENT_CODE_MAP: Record<string, string> = {
  'WT': 'WATER TREATMENT',
  'WL': 'WATER LEAK DETECTOR',
  'FLD': 'FUEL LEAK DETECTOR',
  'LP': 'LIGHTING POINT',
  'CT': 'COOLING TOWER',
  'DL': 'DOCK LEVELLER'
};

export const normalizeEquipmentCode = (rawCode: string): string => {
  if (!rawCode) return 'LAINNYA';
  let code = rawCode.toUpperCase().trim();
  while (/^(PTW|PM|TDE|HSE)([\s\-_/]+|$)/i.test(code)) {
    code = code.replace(/^(PTW|PM|TDE|HSE)([\s\-_/]+|$)/i, '').trim();
  }
  code = code.toUpperCase() || 'LAINNYA';
  return EQUIPMENT_CODE_MAP[code] || code;
};

const MONTHS_ID = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
];

const DATE_HEADER_RE = new RegExp(`^\\*?\\s*(\\d{1,2})\\s+(${MONTHS_ID.join('|')})\\s*\\*?$`, 'i');
const PTW_LINE_RE = /TDE\/PTW\/(\d{3,4})\/(.+)\/(\d{1,2})\/(\d{4})\/(\d{1,2})\s*$/i;

export type ParsedPTWStatus = 'new' | 'exists' | 'duplicate' | 'error';

export interface ParsedPTWLine {
  lineNo: number;
  raw: string;
  key: string;
  ptwNumber: string;
  sequenceNumber: number;
  year: number;
  equipmentCode: string;
  quarter: string;
  date: string;
  notes: string;
  ptwType: 'CM' | 'PM';
  status: ParsedPTWStatus;
  message?: string;
}

// Kunci unik nomor PTW, juga dipakai sebagai ID dokumen di `ptw_numbers` ("2026-0633")
export const ptwNumberKey = (year: number, sequenceNumber: number) =>
  `${year}-${String(sequenceNumber).padStart(4, '0')}`;

// "CoolingPump" -> "Cooling Pump"
const splitCamel = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2');

/**
 * Pecah segmen equipment pada nomor PTW menjadi jenis PTW, kode equipment, dan catatan.
 * "CM UPS(MovementBattery)" -> { ptwType: 'CM', equipmentCode: 'UPS', notes: 'CM UPS (Movement Battery)' }
 */
export function parsePTWEquipment(rawSegment: string) {
  let name = rawSegment.trim();
  let ptwType: 'CM' | 'PM' = 'PM';

  const cm = name.match(/^cm\s*(.+)$/i);
  if (cm) {
    ptwType = 'CM';
    name = cm[1].trim();
  }

  let detail = '';
  const paren = name.match(/^([^(]+)\(([^)]*)\)\s*$/);
  if (paren) {
    name = paren[1].trim();
    detail = splitCamel(paren[2]).trim();
  }

  const label = splitCamel(name).toUpperCase().replace(/\s+/g, ' ').trim();
  const equipmentCode = normalizeEquipmentCode(label);
  const notes = `${ptwType} ${equipmentCode}${detail ? ` (${detail})` : ''}`;

  return { ptwType, equipmentCode, notes };
}

// Data satu nomor PTW yang disimpan ke koleksi `ptw_numbers`
export type PTWNumberEntry = Pick<ParsedPTWLine,
  'key' | 'ptwNumber' | 'sequenceNumber' | 'year' | 'equipmentCode' | 'quarter' | 'date' | 'notes' | 'ptwType'>;

/**
 * Susun nomor PTW dari input form manual.
 * { sequenceNumber: 824, equipment: 'Lift', quarter: '4', date: '2026-10-09', ptwType: 'CM' }
 *   -> ptwNumber "TDE/PTW/0824/CM Lift/04/2026/10"
 */
export function buildPTWNumberEntry(input: {
  sequenceNumber: number;
  equipment: string;
  quarter: string;
  date: string;
  ptwType: 'CM' | 'PM';
}): PTWNumberEntry {
  const [yearStr, monthStr] = input.date.split('-');
  const year = parseInt(yearStr, 10);
  const segment = `${input.ptwType === 'CM' ? 'CM ' : ''}${input.equipment.trim()}`;
  const { equipmentCode, notes } = parsePTWEquipment(segment);
  return {
    key: ptwNumberKey(year, input.sequenceNumber),
    ptwNumber: `TDE/PTW/${String(input.sequenceNumber).padStart(4, '0')}/${segment}/${input.quarter.padStart(2, '0')}/${year}/${monthStr}`,
    sequenceNumber: input.sequenceNumber,
    year,
    equipmentCode,
    quarter: String(parseInt(input.quarter, 10)),
    date: input.date,
    notes,
    ptwType: input.ptwType
  };
}

/**
 * Pecah nomor PTW lengkap untuk auto-isi form manual.
 * "TDE/PTW/0802/CM VRV/04/2026/10" -> { sequenceNumber: 802, equipment: 'VRV', quarter: '4', ptwType: 'CM' }
 */
export function splitFullPTWNumber(value: string) {
  const m = value.trim().match(PTW_LINE_RE);
  if (!m) return null;
  const cm = m[2].trim().match(/^cm\s*(.+)$/i);
  return {
    sequenceNumber: parseInt(m[1], 10),
    equipment: cm ? cm[1].trim() : m[2].trim(),
    quarter: String(parseInt(m[3], 10)),
    ptwType: (cm ? 'CM' : 'PM') as 'CM' | 'PM'
  };
}

/**
 * Parse teks daftar PTW. `existingKeys` (lihat ptwNumberKey) menandai nomor yang sudah tersimpan.
 * `defaultDate` (YYYY-MM-DD) dipakai untuk baris yang tidak punya header tanggal di atasnya.
 */
export function parsePTWListText(
  text: string,
  existingKeys: Set<string> = new Set(),
  defaultDate?: string
): ParsedPTWLine[] {
  const results: ParsedPTWLine[] = [];
  const seen = new Set<string>();
  let currentDay: number | null = null;
  let currentMonth: number | null = null;

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const header = line.match(DATE_HEADER_RE);
    if (header) {
      currentDay = parseInt(header[1], 10);
      currentMonth = MONTHS_ID.indexOf(header[2].toLowerCase()) + 1;
      return;
    }

    const m = line.match(PTW_LINE_RE);
    if (!m) return;

    const seq = parseInt(m[1], 10);
    const equipmentSegment = m[2].trim();
    const quarterNum = parseInt(m[3], 10);
    const year = parseInt(m[4], 10);
    const ptwMonth = parseInt(m[5], 10);
    const key = ptwNumberKey(year, seq);
    const ptwNumber = `TDE/PTW/${m[1].padStart(4, '0')}/${equipmentSegment}/${m[3].padStart(2, '0')}/${year}/${m[5].padStart(2, '0')}`;
    const { ptwType, equipmentCode, notes } = parsePTWEquipment(equipmentSegment);

    let date = '';
    let status: ParsedPTWStatus = 'new';
    let message: string | undefined;

    if (currentDay !== null && currentMonth !== null) {
      date = `${year}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      if (currentMonth !== ptwMonth) {
        message = `Bulan header (${currentMonth}) beda dengan bulan di nomor PTW (${ptwMonth})`;
      }
    } else if (defaultDate) {
      date = defaultDate;
    } else {
      status = 'error';
      message = 'Tidak ada header tanggal di atas baris ini';
    }

    if (quarterNum < 1 || quarterNum > 4) {
      status = 'error';
      message = `Quarter tidak valid: ${m[3]}`;
    }

    if (status !== 'error') {
      if (seen.has(key)) {
        status = 'duplicate';
        message = 'Nomor urut muncul lebih dari sekali di teks';
      } else if (existingKeys.has(key)) {
        status = 'exists';
        message = 'Sudah tercatat di database';
      }
    }
    seen.add(key);

    results.push({
      lineNo: idx + 1,
      raw: line,
      key,
      ptwNumber,
      sequenceNumber: seq,
      year,
      equipmentCode,
      quarter: String(quarterNum),
      date,
      notes,
      ptwType,
      status,
      message
    });
  });

  return results;
}
