import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { auth } from '@/api/firebase';
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Building,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Layers,
  ShieldCheck,
  Gauge,
  Mic,
  MicOff,
  Loader2,
  Wand2,
  Eye
} from 'lucide-react';
import {
  ServiceReportPayload,
  UniversalCustomerInfo,
  UniversalTimeSpent,
  UniversalOperationStatus,
  VisualCheckItem
} from '@/types/serviceReportTypes';
import { getServiceReportConfigByEmail, isServiceReportSupported } from '@/config/serviceReportRegistry';
import { generateUniversalServiceReportPDF } from '@/service_reports/universalServiceReportPDF';
import { ServiceReportFullPreviewModal } from '@/components/ServiceReportFullPreviewModal';

interface ServiceReportContainerProps {
  userEmail?: string | null;
  companyType?: 'neutra' | 'bri' | 'k2';
  initialData?: ServiceReportPayload | null;
  photoCards?: Array<{ photoBase64?: string; description: string }>;
  onChange?: (payload: ServiceReportPayload | null) => void;
  onExport?: (payload: ServiceReportPayload) => Promise<void> | void;
}

function getMergedChecklist(
  savedList?: VisualCheckItem[],
  templateList?: VisualCheckItem[]
): VisualCheckItem[] {
  if (!templateList || templateList.length === 0) return savedList || [];
  if (!savedList || savedList.length === 0) return templateList;

  // Jika savedList memiliki jumlah poin yang lebih sedikit dari template (misal sisa draft lama), gabungkan dengan template resmi
  const savedMap = new Map<string, VisualCheckItem>();
  savedList.forEach(item => {
    if (item.no) savedMap.set(item.no.trim().toLowerCase(), item);
    if (item.activity) savedMap.set(item.activity.trim().toLowerCase(), item);
  });

  return templateList.map(tpl => {
    const match =
      (tpl.no ? savedMap.get(tpl.no.trim().toLowerCase()) : undefined) ||
      (tpl.activity ? savedMap.get(tpl.activity.trim().toLowerCase()) : undefined);
    if (match) {
      return {
        ...tpl,
        condition: match.condition || tpl.condition,
        remarks: match.remarks !== undefined ? match.remarks : tpl.remarks
      };
    }
    return tpl;
  });
}

// ─── HELPER: ULTRA-SMART FIELD EXTRACTOR (0ms Latency & Fallback Extractor) ───
interface ParsedVisualItem {
  match: string; // letter (e.g. 'a', 'b', 'c')
  condition?: 'Good' | 'Not Good';
  remarks?: string;
}

interface ClearActions {
  clearAllForm?: boolean;
  clearAllMeasurements?: boolean;
  clearDPM?: boolean;
  clearVC?: boolean;
  clearThermal?: boolean;
  clearGrounding?: boolean;
  clearAllRemarks?: boolean;
  clearCustomerInfo?: boolean;
  clearKeys?: string[];
  clearVisualPoints?: string[];
}

function extractFieldsFromVoiceText(text: string) {
  const logs: string[] = [];
  const textLower = text.toLowerCase();
  const measurements: Record<string, string> = {};
  const customerInfo: Record<string, string> = {};
  const timeSpent: Record<string, string> = {};
  const visualItems: ParsedVisualItem[] = [];
  const clearActions: ClearActions = {};
  let setAllVisualCondition: 'Good' | 'Not Good' | undefined = undefined;

  // ─── 0. CLEAR / DELETE / RESET DETECTION ───
  const isDeleteIntent = /\b(?:hapus|kosongkan|delete|reset|bersihkan|buang|hilangkan)\b/i.test(text);

  if (isDeleteIntent) {
    // a. Clear all form
    if (/\b(?:semua form|seluruh form|form service report|isi form|semua data)\b/i.test(text)) {
      clearActions.clearAllForm = true;
      logs.push('🗑️ Reset / Kosongkan Semua Form Service Report');
    }
    // b. Clear all measurements
    else if (/\b(?:semua pengukuran|tabel pengukuran|semua measurement|seluruh measurement|nilai pengukuran)\b/i.test(text)) {
      clearActions.clearAllMeasurements = true;
      logs.push('🗑️ Kosongkan Seluruh Tabel Pengukuran (Measurements)');
    }
    // c. Clear DPM only
    else if (/\b(?:dpm|digital power meter|power meter|meteran panel)\b/i.test(text)) {
      clearActions.clearDPM = true;
      logs.push('🗑️ Kosongkan Tabel Digital Power Meter (DPM)');
    }
    // d. Clear VC only
    else if (/\b(?:vc|voltage and current|voltage & current|tegangan arus|pengukuran manual|tester)\b/i.test(text)) {
      clearActions.clearVC = true;
      logs.push('🗑️ Kosongkan Tabel Voltage & Current (VC)');
    }

    // e. Clear Thermal
    if (/\b(?:suhu|thermal|breaker temp)\b/i.test(text) && !clearActions.clearAllMeasurements && !clearActions.clearAllForm) {
      clearActions.clearThermal = true;
      logs.push('🗑️ Hapus Pengukuran Suhu Breaker');
    }

    // f. Clear Grounding
    if (/\b(?:grounding|tahanan tanah|ground)\b/i.test(text) && !clearActions.clearAllMeasurements && !clearActions.clearAllForm) {
      clearActions.clearGrounding = true;
      logs.push('🗑️ Hapus Pengukuran Grounding');
    }

    // g. Clear Specific Measurement Key
    if (/\b(?:tegangan|voltage)?\s*rs\b/i.test(text)) {
      measurements.dpm_voltage_rs = '';
      measurements.vc_voltage_rs = '';
      logs.push('🗑️ Hapus Tegangan RS');
    }
    if (/\b(?:tegangan|voltage)?\s*st\b/i.test(text)) {
      measurements.dpm_voltage_st = '';
      measurements.vc_voltage_st = '';
      logs.push('🗑️ Hapus Tegangan ST');
    }
    if (/\b(?:tegangan|voltage)?\s*tr\b/i.test(text)) {
      measurements.dpm_voltage_tr = '';
      measurements.vc_voltage_tr = '';
      logs.push('🗑️ Hapus Tegangan TR');
    }
    if (/\b(?:tegangan|voltage)?\s*rn\b/i.test(text)) {
      measurements.dpm_voltage_rn = '';
      measurements.vc_voltage_rn = '';
      logs.push('🗑️ Hapus Tegangan RN');
    }
    if (/\b(?:tegangan|voltage)?\s*sn\b/i.test(text)) {
      measurements.dpm_voltage_sn = '';
      measurements.vc_voltage_sn = '';
      logs.push('🗑️ Hapus Tegangan SN');
    }
    if (/\b(?:tegangan|voltage)?\s*tn\b/i.test(text)) {
      measurements.dpm_voltage_tn = '';
      measurements.vc_voltage_tn = '';
      logs.push('🗑️ Hapus Tegangan TN');
    }
    if (/\b(?:kw|daya)\b/i.test(text) && !clearActions.clearDPM && !clearActions.clearAllMeasurements) {
      measurements.dpm_kw = '';
      logs.push('🗑️ Hapus KW');
    }
    if (/\bkva\b/i.test(text) && !clearActions.clearDPM && !clearActions.clearAllMeasurements) {
      measurements.dpm_kva = '';
      logs.push('🗑️ Hapus KVA');
    }
    if (/\bkvar\b/i.test(text) && !clearActions.clearDPM && !clearActions.clearAllMeasurements) {
      measurements.dpm_kvar = '';
      logs.push('🗑️ Hapus KVAR');
    }
    if (/\b(?:cos\s*p|cos\s*phi|pf)\b/i.test(text) && !clearActions.clearDPM && !clearActions.clearAllMeasurements) {
      measurements.dpm_cos_p = '';
      logs.push('🗑️ Hapus Cos Phi');
    }
    if (/\b(?:arus|ampere)\s*r\b/i.test(text)) {
      measurements.dpm_ampere_r = '';
      measurements.vc_ampere_r = '';
      logs.push('🗑️ Hapus Arus R');
    }
    if (/\b(?:arus|ampere)\s*s\b/i.test(text)) {
      measurements.dpm_ampere_s = '';
      measurements.vc_ampere_s = '';
      logs.push('🗑️ Hapus Arus S');
    }
    if (/\b(?:arus|ampere)\s*t\b/i.test(text)) {
      measurements.dpm_ampere_t = '';
      measurements.vc_ampere_t = '';
      logs.push('🗑️ Hapus Arus T');
    }
    if (/\b(?:arus|ampere)\s*n\b/i.test(text)) {
      measurements.dpm_ampere_n = '';
      measurements.vc_ampere_n = '';
      logs.push('🗑️ Hapus Arus N');
    }

    // h. Clear Remarks
    if (/\b(?:semua remark|seluruh remark|semua catatan|semua keterangan)\b/i.test(text)) {
      clearActions.clearAllRemarks = true;
      logs.push('🗑️ Hapus Semua Remarks Inspeksi Visual');
    } else {
      const clearPointMatch = text.match(/(?:hapus|kosongkan|delete|reset|bersihkan)\s*(?:remark|catatan|keterangan)?\s*(?:poin|point|item|no)?\s*([a-pA-P]|\b[1-9]\b|\b1[0-6]\b)/i);
      if (clearPointMatch) {
        let pt = clearPointMatch[1].toLowerCase();
        const num = parseInt(pt, 10);
        if (!isNaN(num) && num >= 1 && num <= 26) pt = String.fromCharCode(96 + num);
        clearActions.clearVisualPoints = [pt];
        logs.push(`🗑️ Hapus Remark Poin [${pt.toUpperCase()}]`);
      }
    }

    // i. Clear Customer Info
    if (/\b(?:data pelanggan|customer info|informasi pelanggan)\b/i.test(text)) {
      clearActions.clearCustomerInfo = true;
      logs.push('🗑️ Kosongkan Data Pelanggan');
    } else {
      if (/\b(?:company name|nama perusahaan)\b/i.test(text)) {
        customerInfo.companyName = '';
        logs.push('🗑️ Hapus Company Name');
      }
      if (/\b(?:mop no|mop)\b/i.test(text)) {
        customerInfo.mopNo = '';
        logs.push('🗑️ Hapus MOP No');
      }
      if (/\b(?:lokasi|location)\b/i.test(text)) {
        customerInfo.location = '';
        logs.push('🗑️ Hapus Lokasi');
      }
    }
  }

  // 1. Visual Checklist: Semua item (Hanya jika ada kata 'semua' / 'all' / 'seluruh' dan bukan intent delete)
  const hasWordSemua = /\b(?:semua|all|seluruh|semuanya)\b/i.test(text);
  if (!isDeleteIntent && hasWordSemua && (textLower.includes('good') || textLower.includes('bagus') || textLower.includes('baik') || textLower.includes('normal') || textLower.includes('sesuai') || textLower.includes('oke') || textLower.includes('ok'))) {
    setAllVisualCondition = 'Good';
    logs.push('Semua Inspeksi Visual → [Good]');
  } else if (!isDeleteIntent && hasWordSemua && (textLower.includes('not good') || textLower.includes('tidak bagus') || textLower.includes('rusak') || textLower.includes('abnormal') || textLower.includes('jelek'))) {
    setAllVisualCondition = 'Not Good';
    logs.push('Semua Inspeksi Visual → [Not Good]');
  }

  // 2. Visual Checklist: Poin individual (misal: "poin a good", "poin b not good remarknya kotor", "item c tidak bagus keterangan kabel lepas")
  // MUST match explicit point prefix (poin/point/item/huruf/no/nomor) OR isolated word token \b[a-pA-P]\b
  if (!isDeleteIntent) {
    const itemRegex = /(?:(?:poin|point|item|huruf|no|nomor)\s*([a-pA-P]|\b[1-9]\b|\b1[0-6]\b)|\b([a-pA-P])\b)\s*(?:adalah|diisi|kondisi|status|:|=|\s+)?\s*(good|not\s*good|tidak\s*bagus|bagus|rusak|oke|ok|jelek)(?:[,\s]*(?:remark|catatan|keterangan)\s*(?:adalah|:|=|\s+)?([^,.\n]+))?/gi;
    let matchItem;
    while ((matchItem = itemRegex.exec(text)) !== null) {
      const rawNo = (matchItem[1] || matchItem[2] || '').toLowerCase();
      if (!rawNo) continue;
      const rawCond = matchItem[3].toLowerCase();
      const rawRemark = matchItem[4] ? matchItem[4].trim() : undefined;

      const condition: 'Good' | 'Not Good' = (rawCond.includes('not') || rawCond.includes('tidak') || rawCond.includes('rusak') || rawCond.includes('jelek')) ? 'Not Good' : 'Good';
      
      let letter = rawNo;
      const num = parseInt(rawNo, 10);
      if (!isNaN(num) && num >= 1 && num <= 26) {
        letter = String.fromCharCode(96 + num); // 1 -> 'a'
      }

      visualItems.push({
        match: letter,
        condition,
        remarks: rawRemark
      });

      logs.push(`Inspeksi Visual [${letter.toUpperCase()}]: [${condition}]${rawRemark ? ` (Remark: "${rawRemark}")` : ''}`);
    }

    // 3. Standalone Remarks per poin (misal: "remark poin b kotor", "keterangan poin c baut kendor")
    const remarkRegex = /(?:remark|catatan|keterangan)\s*(?:(?:poin|point|item|huruf|no|nomor)\s*([a-pA-P]|\b[1-9]\b|\b1[0-6]\b)|\b([a-pA-P])\b)\s*(?:adalah|:|=|\s+)?([^,.\n]+)/gi;
    let matchRemark;
    while ((matchRemark = remarkRegex.exec(text)) !== null) {
      const rawNo = (matchRemark[1] || matchRemark[2] || '').toLowerCase();
      if (!rawNo) continue;
      let letter = rawNo;
      const num = parseInt(letter, 10);
      if (!isNaN(num) && num >= 1 && num <= 26) {
        letter = String.fromCharCode(96 + num);
      }
      const remarkText = matchRemark[3].trim();
      if (remarkText) {
        const existing = visualItems.find(v => v.match === letter);
        if (existing) {
          existing.remarks = remarkText;
        } else {
          visualItems.push({ match: letter, remarks: remarkText });
        }
        logs.push(`Remark Poin [${letter.toUpperCase()}] → "${remarkText}"`);
      }
    }
  }

  // Helper for regex matching single value
  const findVal = (patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) return m[1].replace(',', '.').trim();
    }
    return null;
  };

  // ─── PENGUKURAN: PEMISAHAN KETAT DPM VS VOLTAGE & CURRENT (VC) ───
  if (!isDeleteIntent) {
    const isDPMExplicit = textLower.includes('digital power meter') || textLower.includes('dpm') || textLower.includes('power meter') || textLower.includes('meteran panel') || textLower.includes('recording');
    const isVCExplicit = textLower.includes('voltage and current') || textLower.includes('voltage & current') || textLower.includes('vc') || textLower.includes('multimeter') || textLower.includes('tester') || textLower.includes('pengukuran manual') || textLower.includes('pengukuran langsung') || textLower.includes('tegangan arus');

    const setVoltage = (wire: 'rs' | 'st' | 'tr' | 'rn' | 'sn' | 'tn', val: string) => {
      if (isVCExplicit && !isDPMExplicit) {
        measurements[`vc_voltage_${wire}`] = val;
        logs.push(`Voltage & Current ${wire.toUpperCase()} → ${val} V`);
      } else {
        measurements[`dpm_voltage_${wire}`] = val;
        logs.push(`Digital Power Meter ${wire.toUpperCase()} → ${val} V`);
      }
    };

    const setCurrent = (wire: 'r' | 's' | 't' | 'n', val: string) => {
      if (isVCExplicit && !isDPMExplicit) {
        measurements[`vc_ampere_${wire}`] = val;
        logs.push(`Voltage & Current Arus ${wire.toUpperCase()} → ${val} A`);
      } else {
        measurements[`dpm_ampere_${wire}`] = val;
        logs.push(`Digital Power Meter Arus ${wire.toUpperCase()} → ${val} A`);
      }
    };

    // 4. Single Voltage Phase-to-Phase
    const rsVal = findVal([
      /\b(?:r[- ]?s|rs)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+rs\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (rsVal) setVoltage('rs', rsVal);

    const stVal = findVal([
      /\b(?:s[- ]?t|st)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+st\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (stVal) setVoltage('st', stVal);

    const trVal = findVal([
      /\b(?:t[- ]?r|tr)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+tr\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (trVal) setVoltage('tr', trVal);

    // 5. Sequential 3 numbers for RS, ST, TR (e.g. "nilai 350, 250, dan 320" or "rs st tr 380 380 380")
    if (!measurements.dpm_voltage_rs && !measurements.dpm_voltage_st && !measurements.dpm_voltage_tr && !measurements.vc_voltage_rs) {
      const seqMatch = text.match(/(?:rs\s*,?\s*st\s*,?\s*tr|r-s\s*,?\s*s-t\s*,?\s*t-r|tegangan|nilai|mencatat)\s*(?:adalah|mencatat|bernilai|sebesar|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:,|dan|\/|-|\s+)\s*(\d+(?:[.,]\d+)?)\s*(?:,|dan|\/|-|\s+)\s*(\d+(?:[.,]\d+)?)/i);
      if (seqMatch) {
        const v1 = seqMatch[1].replace(',', '.');
        const v2 = seqMatch[2].replace(',', '.');
        const v3 = seqMatch[3].replace(',', '.');
        setVoltage('rs', v1);
        setVoltage('st', v2);
        setVoltage('tr', v3);
      }
    }

    // 6. Voltages Phase-to-Neutral
    const rnVal = findVal([
      /\b(?:r[- ]?n|rn)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+rn\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (rnVal) setVoltage('rn', rnVal);

    const snVal = findVal([
      /\b(?:s[- ]?n|sn)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+sn\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (snVal) setVoltage('sn', snVal);

    const tnVal = findVal([
      /\b(?:t[- ]?n|tn)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+tn\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (tnVal) setVoltage('tn', tnVal);

    // 7. Sequential 3 numbers for RN, SN, TN
    if (!measurements.dpm_voltage_rn && !measurements.dpm_voltage_sn && !measurements.dpm_voltage_tn && !measurements.vc_voltage_rn) {
      const rnSnTnSeq = text.match(/(?:rn\s*,?\s*sn\s*,?\s*tn|r-n\s*,?\s*s-n\s*,?\s*t-n)\s*(?:adalah|mencatat|bernilai|sebesar|:)?\s*(\d+(?:[.,]\d+)?)\s*(?:,|dan|\/|-|\s+)\s*(\d+(?:[.,]\d+)?)\s*(?:,|dan|\/|-|\s+)\s*(\d+(?:[.,]\d+)?)/i);
      if (rnSnTnSeq) {
        const v1 = rnSnTnSeq[1].replace(',', '.');
        const v2 = rnSnTnSeq[2].replace(',', '.');
        const v3 = rnSnTnSeq[3].replace(',', '.');
        setVoltage('rn', v1);
        setVoltage('sn', v2);
        setVoltage('tn', v3);
      }
    }

    // 8. Voltage N-G (Hanya ada di Voltage & Current)
    const ngVal = findVal([
      /\b(?:n[- ]?g|ng)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /(?:tegangan|voltage)\s+ng\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (ngVal) {
      measurements.vc_voltage_ng = ngVal;
      logs.push(`Voltage & Current N-G → ${ngVal} V`);
    }

    // 9. Power & Cos Phi (Hanya ada di Digital Power Meter)
    const kwVal = findVal([/\b(?:kw|daya)\b[^\d]*?(\d+(?:[.,]\d+)?)/i]);
    if (kwVal) {
      measurements.dpm_kw = kwVal;
      logs.push(`DPM Daya KW → ${kwVal} kW`);
    }

    const kvaVal = findVal([/\bkva\b[^\d]*?(\d+(?:[.,]\d+)?)/i]);
    if (kvaVal) {
      measurements.dpm_kva = kvaVal;
      logs.push(`DPM Daya KVA → ${kvaVal} kVA`);
    }

    const kvarVal = findVal([/\bkvar\b[^\d]*?(\d+(?:[.,]\d+)?)/i]);
    if (kvarVal) {
      measurements.dpm_kvar = kvarVal;
      logs.push(`DPM Daya KVAR → ${kvarVal} kVAR`);
    }

    const cospVal = findVal([/\b(?:cos\s*p|cos\s*phi|pf|power factor)\b[^\d]*?(\d+(?:[.,]\d+)?)/i]);
    if (cospVal) {
      measurements.dpm_cos_p = cospVal;
      logs.push(`DPM Cos Phi → ${cospVal}`);
    }

    // 10. Currents
    const ampR = findVal([
      /(?:arus|ampere|amp)\s+r\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\br\s+(?:arus|ampere|amp)\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (ampR) setCurrent('r', ampR);

    const ampS = findVal([
      /(?:arus|ampere|amp)\s+s\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\bs\s+(?:arus|ampere|amp)\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (ampS) setCurrent('s', ampS);

    const ampT = findVal([
      /(?:arus|ampere|amp)\s+t\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\bt\s+(?:arus|ampere|amp)\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (ampT) setCurrent('t', ampT);

    const ampN = findVal([
      /(?:arus|ampere|amp)\s+n\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\bn\s+(?:arus|ampere|amp)\b[^\d]*?(\d+(?:[.,]\d+)?)/i
    ]);
    if (ampN) setCurrent('n', ampN);

    // 11. Thermal / Suhu
    const tempVal = findVal([
      /(?:suhu|thermal|temperature|suhu breaker)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\b(\d+(?:[.,]\d+)?)\s*(?:derajat|°c|celsius)\b/i
    ]);
    if (tempVal) {
      measurements.thermal_breaker_temp = tempVal;
      logs.push(`Suhu Breaker → ${tempVal} °C`);
    }

    // 12. Grounding
    const gndVal = findVal([
      /(?:grounding|ground|tahanan tanah|pentanahan)\b[^\d]*?(\d+(?:[.,]\d+)?)/i,
      /\b(\d+(?:[.,]\d+)?)\s*(?:ohm|ꭥ|omega)\b/i
    ]);
    if (gndVal) {
      measurements.grounding_ohm = gndVal;
      logs.push(`Grounding → ${gndVal} Ω`);
    }

    // 13. Customer Info
    if (textLower.includes('neutra')) {
      customerInfo.companyName = 'Neutra DC Cikarang';
      logs.push('Company Name → "Neutra DC Cikarang"');
    }

    const mopMatch = text.match(/(?:mop(?:\s+no)?)\s*(?:adalah|diisi|:|=)?\s*([A-Za-z0-9\-_/]+)/i);
    if (mopMatch) {
      customerInfo.mopNo = mopMatch[1];
      logs.push(`MOP No → ${mopMatch[1]}`);
    }

    const locMatch = text.match(/(?:lokasi|location|ruang|lantai|lt)\s*(?:adalah|diisi|:|=)?\s*([^,.\n]+)/i);
    if (locMatch) {
      customerInfo.location = locMatch[1].trim();
      logs.push(`Lokasi → "${locMatch[1].trim()}"`);
    }

    // 14. Times
    const startMatch = text.match(/(?:mulai|start)\s*(?:jam|pukul)?\s*(\d{1,2}[:.]\d{2})/i);
    if (startMatch) {
      timeSpent.start = startMatch[1].replace('.', ':');
      logs.push(`Waktu Mulai → ${timeSpent.start}`);
    }

    const finishMatch = text.match(/(?:selesai|finish)\s*(?:jam|pukul)?\s*(\d{1,2}[:.]\d{2})/i);
    if (finishMatch) {
      timeSpent.finish = finishMatch[1].replace('.', ':');
      logs.push(`Waktu Selesai → ${timeSpent.finish}`);
    }
  }

  return {
    customerInfo,
    setAllVisualCondition,
    visualItems,
    clearActions,
    measurements,
    timeSpent,
    logs
  };
}

export function ServiceReportContainer({
  userEmail,
  companyType = 'neutra',
  initialData,
  photoCards = [],
  onChange,
  onExport
}: ServiceReportContainerProps) {
  const config = getServiceReportConfigByEmail(userEmail);
  const isSupported = isServiceReportSupported(userEmail);

  // Status apakah accordion form Service Report dibuka/diaktifkan
  const [isEnabled, setIsEnabled] = useState<boolean>(!!initialData);
  const [isOpen, setIsOpen] = useState<boolean>(!!initialData);
  const [activeTab, setActiveTab] = useState<'customer' | 'visual' | 'measurements' | 'time'>('customer');
  const [showFullPreview, setShowFullPreview] = useState(false);

  // ─── STATE FORM ───
  const [customerInfo, setCustomerInfo] = useState<UniversalCustomerInfo>(
    initialData?.customerInfo || config?.defaultCustomerInfo || {
      companyName: 'Neutra DC Cikarang',
      mopNo: '',
      equipmentName: config?.name || '',
      serialNo: '',
      quarter: 'Q3',
      ciDescription: '',
      productName: '',
      location: '',
      date: new Date().toISOString().split('T')[0],
      ciName: '',
      prodYear: '',
      area: '',
      engineer: userEmail || '',
      serviceType: 'Preventive maintenance',
      contractType: 'Contract',
      specification: '',
      model: ''
    }
  );

  const [timeSpent, setTimeSpent] = useState<UniversalTimeSpent>(
    initialData?.timeSpent || config?.defaultTimeSpent || {
      date: new Date().toISOString().split('T')[0],
      departure: '08:00',
      arrival: '08:30',
      start: '09:00',
      finish: '17:00'
    }
  );

  const [operationStatus, setOperationStatus] = useState<UniversalOperationStatus>(
    initialData?.operationStatus || config?.defaultOperationStatus || {
      isNormal: true,
      remark: 'All systems operating within standard parameters.',
      faultSymptom: '',
      faultAnalysis: '',
      workDone: 'Preventive maintenance completed according to SOP.',
      faultPartSN: '',
      faultPartName: ''
    }
  );

  const [visualChecklist, setVisualChecklist] = useState<VisualCheckItem[]>(() =>
    getMergedChecklist(initialData?.visualChecklist, config?.checklistTemplate)
  );

  const [measurements, setMeasurements] = useState<Record<string, any>>(
    initialData?.measurements || {
      // Digital Power Meter
      dpm_voltage_rs: '',
      dpm_voltage_st: '',
      dpm_voltage_tr: '',
      dpm_voltage_rn: '',
      dpm_voltage_sn: '',
      dpm_voltage_tn: '',
      dpm_voltage_n: '',
      dpm_kw: '',
      dpm_kva: '',
      dpm_kvar: '',
      dpm_cos_p: '',
      dpm_ampere_r: '',
      dpm_ampere_s: '',
      dpm_ampere_t: '',
      dpm_ampere_n: '',
      dpm_remarks: '',
      // Voltage & Current Measurement
      vc_voltage_rs: '',
      vc_voltage_st: '',
      vc_voltage_tr: '',
      vc_voltage_rn: '',
      vc_voltage_sn: '',
      vc_voltage_tn: '',
      vc_voltage_ng: '',
      vc_ampere_r: '',
      vc_ampere_s: '',
      vc_ampere_t: '',
      vc_ampere_n: '',
      vc_standard: '+5% - 10% from 380V & 220V load deviation 10%',
      vc_remarks: '',
      // Thermal
      thermal_breaker_temp: '',
      thermal_standard: '40°C',
      thermal_remarks: '',
      // Grounding
      grounding_ohm: '',
      grounding_standard: '<5 ꭥ',
      grounding_remarks: ''
    }
  );

  // ─── AI VOICE NOTE AGENT STATE ───
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [updatedFieldsSummary, setUpdatedFieldsSummary] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>('');
  const lastSentPayloadRef = useRef<string>('');

  // Sinkronisasi data awal jika initialData berubah dari parent (misal switch unit/edit mode)
  useEffect(() => {
    if (initialData) {
      setIsEnabled(true);
      setIsOpen(true);
      if (initialData.customerInfo) setCustomerInfo(initialData.customerInfo);
      if (initialData.timeSpent) setTimeSpent(initialData.timeSpent);
      if (initialData.operationStatus) setOperationStatus(initialData.operationStatus);
      if (initialData.visualChecklist) setVisualChecklist(getMergedChecklist(initialData.visualChecklist, config?.checklistTemplate));
      if (initialData.measurements) setMeasurements(initialData.measurements);
    }
  }, [initialData, config?.checklistTemplate]);

  // Siarkan perubahan data Service Report ke parent form
  useEffect(() => {
    if (!onChange || !config) return;
    if (!isEnabled) {
      if (lastSentPayloadRef.current !== 'null') {
        lastSentPayloadRef.current = 'null';
        onChange(null);
      }
      return;
    }
    const payload: ServiceReportPayload = {
      equipmentKey: config.key,
      equipmentName: config.name,
      accountEmail: userEmail || config.email,
      customerInfo,
      timeSpent,
      operationStatus,
      visualChecklist,
      measurements
    };
    const serialized = JSON.stringify(payload);
    if (lastSentPayloadRef.current !== serialized) {
      lastSentPayloadRef.current = serialized;
      onChange(payload);
    }
  }, [isEnabled, customerInfo, timeSpent, operationStatus, visualChecklist, measurements, config, userEmail, onChange]);

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleVoiceRecording = () => {
    if (!SpeechRecognitionAPI) {
      toast.error('Browser ini belum mendukung mikrofon otomatis.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      // Auto process upon stopping
      const textToRun = latestTranscriptRef.current || voiceTranscript;
      if (textToRun && textToRun.trim()) {
        handleProcessVoiceInput(textToRun);
      }
      return;
    }

    try {
      if (!isEnabled) setIsEnabled(true);
      if (!isOpen) setIsOpen(true);
      setVoiceTranscript('');
      latestTranscriptRef.current = '';
      setUpdatedFieldsSummary([]);
      setVoiceFeedback(null);

      const rec = new SpeechRecognitionAPI();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'id-ID';

      rec.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ Mikrofon aktif! Silakan sebutkan data sambil membaca tabel di bawah.', { duration: 3500 });
      };

      rec.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          setVoiceTranscript(currentTranscript);
          latestTranscriptRef.current = currentTranscript;
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error('Gagal merekam suara mikrofon.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error('Mic start error:', err);
      setIsListening(false);
      toast.error('Tidak dapat mengakses mikrofon.');
    }
  };

  const handleProcessVoiceInput = async (textOverride?: string) => {
    const textToProcess = textOverride || voiceTranscript;
    if (!textToProcess || !textToProcess.trim()) {
      toast.error('Belum ada suara / teks perintah yang dimasukkan bro.');
      return;
    }

    if (!config) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }

    // ─── 1. RUN INSTANT 0ms EXTRACTOR (Live Instant Feedback) ───
    const fastExtracted = extractFieldsFromVoiceText(textToProcess);

    // Apply Clear Actions from fastExtracted
    if (fastExtracted.clearActions) {
      const ca = fastExtracted.clearActions;
      if (ca.clearAllForm) {
        setMeasurements({
          dpm_voltage_rs: '', dpm_voltage_st: '', dpm_voltage_tr: '', dpm_voltage_rn: '', dpm_voltage_sn: '', dpm_voltage_tn: '', dpm_voltage_n: '', dpm_kw: '', dpm_kva: '', dpm_kvar: '', dpm_cos_p: '', dpm_ampere_r: '', dpm_ampere_s: '', dpm_ampere_t: '', dpm_ampere_n: '', dpm_remarks: '',
          vc_voltage_rs: '', vc_voltage_st: '', vc_voltage_tr: '', vc_voltage_rn: '', vc_voltage_sn: '', vc_voltage_tn: '', vc_voltage_ng: '', vc_ampere_r: '', vc_ampere_s: '', vc_ampere_t: '', vc_ampere_n: '', vc_remarks: '',
          thermal_breaker_temp: '', thermal_remarks: '',
          grounding_ohm: '', grounding_remarks: ''
        });
        setVisualChecklist(config.checklistTemplate.map(t => ({ ...t, condition: 'Good', remarks: '' })));
        setTimeSpent(config.defaultTimeSpent || {});
        setOperationStatus(config.defaultOperationStatus || { isNormal: true });
      } else {
        if (ca.clearAllMeasurements) {
          setMeasurements({
            dpm_voltage_rs: '', dpm_voltage_st: '', dpm_voltage_tr: '', dpm_voltage_rn: '', dpm_voltage_sn: '', dpm_voltage_tn: '', dpm_voltage_n: '', dpm_kw: '', dpm_kva: '', dpm_kvar: '', dpm_cos_p: '', dpm_ampere_r: '', dpm_ampere_s: '', dpm_ampere_t: '', dpm_ampere_n: '', dpm_remarks: '',
            vc_voltage_rs: '', vc_voltage_st: '', vc_voltage_tr: '', vc_voltage_rn: '', vc_voltage_sn: '', vc_voltage_tn: '', vc_voltage_ng: '', vc_ampere_r: '', vc_ampere_s: '', vc_ampere_t: '', vc_ampere_n: '', vc_remarks: '',
            thermal_breaker_temp: '', thermal_remarks: '',
            grounding_ohm: '', grounding_remarks: ''
          });
        }
        if (ca.clearDPM) {
          setMeasurements(prev => ({
            ...prev,
            dpm_voltage_rs: '', dpm_voltage_st: '', dpm_voltage_tr: '', dpm_voltage_rn: '', dpm_voltage_sn: '', dpm_voltage_tn: '', dpm_voltage_n: '', dpm_kw: '', dpm_kva: '', dpm_kvar: '', dpm_cos_p: '', dpm_ampere_r: '', dpm_ampere_s: '', dpm_ampere_t: '', dpm_ampere_n: '', dpm_remarks: ''
          }));
        }
        if (ca.clearVC) {
          setMeasurements(prev => ({
            ...prev,
            vc_voltage_rs: '', vc_voltage_st: '', vc_voltage_tr: '', vc_voltage_rn: '', vc_voltage_sn: '', vc_voltage_tn: '', vc_voltage_ng: '', vc_ampere_r: '', vc_ampere_s: '', vc_ampere_t: '', vc_ampere_n: '', vc_remarks: ''
          }));
        }
        if (ca.clearThermal) {
          setMeasurements(prev => ({ ...prev, thermal_breaker_temp: '', thermal_remarks: '' }));
        }
        if (ca.clearGrounding) {
          setMeasurements(prev => ({ ...prev, grounding_ohm: '', grounding_remarks: '' }));
        }
        if (ca.clearAllRemarks) {
          setVisualChecklist(prev => prev.map(item => ({ ...item, remarks: '' })));
        }
        if (ca.clearVisualPoints && ca.clearVisualPoints.length > 0) {
          setVisualChecklist(prev =>
            prev.map(item => {
              const itemNoClean = (item.no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (ca.clearVisualPoints?.includes(itemNoClean)) {
                return { ...item, remarks: '' };
              }
              return item;
            })
          );
        }
        if (ca.clearCustomerInfo) {
          setCustomerInfo({
            companyName: '', mopNo: '', equipmentName: '', serialNo: '', quarter: 'Q1',
            ciDescription: '', productName: '', location: '', date: '', ciName: '',
            prodYear: '', area: '', engineer: '', specification: '', model: ''
          });
        }
      }
    }

    if (Object.keys(fastExtracted.measurements).length > 0) {
      setMeasurements(prev => ({ ...prev, ...fastExtracted.measurements }));
    }
    if (Object.keys(fastExtracted.customerInfo).length > 0) {
      setCustomerInfo(prev => ({ ...prev, ...fastExtracted.customerInfo }));
    }
    if (fastExtracted.setAllVisualCondition) {
      setVisualChecklist(prev => prev.map(item => ({ ...item, condition: fastExtracted.setAllVisualCondition! })));
    } else if (fastExtracted.visualItems && fastExtracted.visualItems.length > 0) {
      setVisualChecklist(prev =>
        prev.map(item => {
          const itemNoClean = (item.no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = fastExtracted.visualItems.find(m => {
            const matchStr = String(m.match).trim().toLowerCase();
            const matchClean = matchStr.replace(/[^a-z0-9]/g, '');
            if (matchClean && matchClean === itemNoClean) return true;
            if (matchStr === (item.no || '').trim().toLowerCase()) return true;
            if (matchStr.length >= 4 && item.activity.toLowerCase().includes(matchStr)) return true;
            return false;
          });
          if (match) {
            return {
              ...item,
              condition: match.condition || item.condition,
              remarks: match.remarks !== undefined ? match.remarks : item.remarks
            };
          }
          return item;
        })
      );
    }
    if (Object.keys(fastExtracted.timeSpent).length > 0) {
      setTimeSpent(prev => ({ ...prev, ...fastExtracted.timeSpent }));
    }

    if (fastExtracted.logs.length > 0) {
      setUpdatedFieldsSummary(fastExtracted.logs);
      setIsEnabled(true);
      setIsOpen(true);
    }

    setIsProcessingVoice(true);
    const toastId = toast.loading('AI Agent sedang menganalisis suara & mengeksekusi...');

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiBaseUrl = import.meta.env.VITE_API_URL || '';
      const url = apiBaseUrl
        ? apiBaseUrl.endsWith('/api')
          ? `${apiBaseUrl}/ai/chat`
          : `${apiBaseUrl}/api/ai/chat`
        : '/api/ai/chat';

      const checklistItemsList = config.checklistTemplate
        .map(t => `- [${t.no}] ${t.activity}`)
        .join('\n');

      const systemPrompt = `Anda adalah Asisten AI Penginput Form Service Report DwimitraSystem untuk peralatan: "${config.name}".
Pengguna memberikan perintah/catatan suara (voice note) dalam Bahasa Indonesia.
Tugas Anda: Ekstrak semua instruksi pengisian, nilai pengukuran, checklist inspeksi, data pelanggan, waktu operasi, SERTA instruksi HAPUS/KOSONGKAN/RESET ke dalam format JSON terstruktur.

DAFTAR ITEM INSPEKSI VISUAL PERALATAN INI (${config.name}):
${checklistItemsList}

ATURAN PEMETAAN KETAT (WAJIB DIIKUTI):
1. Inspeksi Visual & Remarks:
   - Ekstrak HANYA poin yang secara eksplisit disebutkan oleh pengguna (contoh jika pengguna menyebut "poin a diisi not good dengan remark rusak", masukkan HANYA poin "a". DILARANG KERAS menyertakan poin "i" atau poin lain yang tidak disebutkan).
   - Kata-kata seperti "diisi", "di", "kondisi", "dengan", "adalah" adalah kata kerja/kata hubung, BUKAN nama poin!
   - Jika pengguna menyebut "semua good" / "semua bagus", berikan "setAllVisualCondition": "Good".
   - Format array per-poin yang diminta:
     [
       { "match": "a", "condition": "Good" },
       { "match": "b", "condition": "Not Good", "remarks": "Kotor" }
     ]
   - Huruf/nomor poin harus dicocokkan ke daftar poin di atas (a sampai p).

2. Pemisahan Digital Power Meter (DPM) vs Voltage & Current Measurement (VC):
   - JIKA pengguna menyebut "Digital Power Meter" / "DPM" / "meter":
     HANYA ISI kunci "dpm_voltage_rs", "dpm_voltage_st", "dpm_voltage_tr", "dpm_voltage_rn", "dpm_voltage_sn", "dpm_voltage_tn", "dpm_kw", "dpm_kva", "dpm_kvar", "dpm_cos_p", "dpm_ampere_r", dll.
     DILARANG KERAS mengisi kunci "vc_*"!
   - JIKA pengguna menyebut "Voltage & Current" / "VC" / "tegangan arus" / "tester manual":
     HANYA ISI kunci "vc_voltage_rs", "vc_voltage_st", "vc_voltage_tr", "vc_voltage_rn", "vc_voltage_sn", "vc_voltage_tn", "vc_voltage_ng", "vc_ampere_r", dll.
     DILARANG KERAS mengisi kunci "dpm_*"!
   - JIKA pengguna hanya menyebut "tegangan rs 380...", defaultkan ke "dpm_voltage_rs" kecuali ada instruksi Voltage & Current.

3. Instruksi HAPUS / KOSONGKAN / DELETE / RESET (PENTING!):
   - Jika pengguna meminta "hapus semua pengukuran" / "kosongkan tabel measurement" / "delete measurements":
     Set semua nilai di objek measurements menjadi string kosong "".
   - Jika pengguna meminta "kosongkan DPM" / "hapus tabel digital power meter":
     Set semua kunci "dpm_*" menjadi string kosong "".
   - Jika pengguna meminta "kosongkan Voltage and Current" / "hapus tabel VC":
     Set semua kunci "vc_*" menjadi string kosong "".
   - Jika pengguna meminta "hapus remark poin A" / "kosongkan catatan poin B":
     Sertakan visualChecklist: [{ "match": "a", "remarks": "" }]
   - Jika pengguna meminta "hapus semua remark":
     Sertakan "clearAllRemarks": true
   - Jika pengguna meminta "hapus/kosongkan data pelanggan":
     Set nilai di objek customerInfo menjadi "".
   - Jika pengguna meminta "reset semua form" / "kosongkan seluruh form":
     Sertakan "clearAllForm": true

FORMAT JSON OUTPUT YANG HARUS DIHASILKAN (HANYA sertakan field yang relevan):
{
  "customerInfo": {
    "companyName": "string",
    "mopNo": "string",
    "equipmentName": "string",
    "serialNo": "string",
    "quarter": "Q1" | "Q2" | "Q3" | "Q4",
    "ciDescription": "string",
    "productName": "string",
    "location": "string",
    "date": "YYYY-MM-DD",
    "ciName": "string",
    "prodYear": "string",
    "area": "string",
    "engineer": "string",
    "specification": "string",
    "model": "string"
  },
  "setAllVisualCondition": "Good" | "Not Good",
  "visualChecklist": [
    {
      "match": "a" atau "b" atau nomor poin (misal: "a", "b", "c"),
      "condition": "Good" | "Not Good",
      "remarks": "string"
    }
  ],
  "measurements": {
    "dpm_voltage_rs": "string",
    "dpm_voltage_st": "string",
    "dpm_voltage_tr": "string",
    "dpm_voltage_rn": "string",
    "dpm_voltage_sn": "string",
    "dpm_voltage_tn": "string",
    "dpm_voltage_n": "string",
    "dpm_kw": "string",
    "dpm_kva": "string",
    "dpm_kvar": "string",
    "dpm_cos_p": "string",
    "dpm_ampere_r": "string",
    "dpm_ampere_s": "string",
    "dpm_ampere_t": "string",
    "dpm_ampere_n": "string",
    "dpm_remarks": "string",
    "vc_voltage_rs": "string",
    "vc_voltage_st": "string",
    "vc_voltage_tr": "string",
    "vc_voltage_rn": "string",
    "vc_voltage_sn": "string",
    "vc_voltage_tn": "string",
    "vc_voltage_ng": "string",
    "vc_ampere_r": "string",
    "vc_ampere_s": "string",
    "vc_ampere_t": "string",
    "vc_ampere_n": "string",
    "vc_remarks": "string",
    "thermal_breaker_temp": "string",
    "thermal_remarks": "string",
    "grounding_ohm": "string",
    "grounding_remarks": "string"
  },
  "timeSpent": {
    "date": "YYYY-MM-DD",
    "departure": "HH:MM",
    "arrival": "HH:MM",
    "start": "HH:MM",
    "finish": "HH:MM"
  },
  "operationStatus": {
    "isNormal": boolean,
    "remark": "string",
    "faultSymptom": "string",
    "faultAnalysis": "string",
    "workDone": "string",
    "faultPartSN": "string",
    "faultPartName": "string"
  },
  "summary": "Deskripsi singkat dan ramah dalam Bahasa Indonesia (maksimal 2 kalimat) tentang apa saja field yang baru saja diisikan ke form."
}

PENTING:
- Keluarkan HANYA JSON murni tanpa markdown pembuka/penutup dan tanpa teks lain di luar JSON.
- Cerdas mengenali angka kata: misal "tiga ratus delapan puluh" -> "380", "nol koma delapan ohm" -> "0.8", "tiga puluh empat derajat" -> "34".

Instruksi Suara Pengguna:
"${textToProcess}"`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: textToProcess }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'AI tidak memberikan respon.');
      }

      // Parse JSON from reply
      let parsed: any = null;
      try {
        const match = data.reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) {
          parsed = JSON.parse(match[1]);
        } else {
          const firstBrace = data.reply.indexOf('{');
          const lastBrace = data.reply.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            parsed = JSON.parse(data.reply.substring(firstBrace, lastBrace + 1));
          } else {
            parsed = JSON.parse(data.reply);
          }
        }
      } catch {
        // Fallback: If AI returned natural language text, extract fields directly from the AI reply!
        const replyExtracted = extractFieldsFromVoiceText(data.reply);
        if (Object.keys(replyExtracted.measurements).length > 0 || replyExtracted.visualItems.length > 0) {
          parsed = {
            measurements: replyExtracted.measurements,
            visualChecklist: replyExtracted.visualItems,
            setAllVisualCondition: replyExtracted.setAllVisualCondition,
            summary: data.reply
          };
        }
      }

      const logs: string[] = [...fastExtracted.logs];

      if (parsed) {
        // Clear all form if requested by AI
        if (parsed.clearAllForm) {
          setMeasurements({
            dpm_voltage_rs: '', dpm_voltage_st: '', dpm_voltage_tr: '', dpm_voltage_rn: '', dpm_voltage_sn: '', dpm_voltage_tn: '', dpm_voltage_n: '', dpm_kw: '', dpm_kva: '', dpm_kvar: '', dpm_cos_p: '', dpm_ampere_r: '', dpm_ampere_s: '', dpm_ampere_t: '', dpm_ampere_n: '', dpm_remarks: '',
            vc_voltage_rs: '', vc_voltage_st: '', vc_voltage_tr: '', vc_voltage_rn: '', vc_voltage_sn: '', vc_voltage_tn: '', vc_voltage_ng: '', vc_ampere_r: '', vc_ampere_s: '', vc_ampere_t: '', vc_ampere_n: '', vc_remarks: '',
            thermal_breaker_temp: '', thermal_remarks: '',
            grounding_ohm: '', grounding_remarks: ''
          });
          setVisualChecklist(config.checklistTemplate.map(t => ({ ...t, condition: 'Good', remarks: '' })));
          setTimeSpent(config.defaultTimeSpent || {});
          setOperationStatus(config.defaultOperationStatus || { isNormal: true });
          logs.push('🗑️ Semua data form di-reset/dikosongkan.');
        }

        // Clear all remarks if requested
        if (parsed.clearAllRemarks) {
          setVisualChecklist(prev => prev.map(item => ({ ...item, remarks: '' })));
          logs.push('🗑️ Semua remarks visual checklist dikosongkan.');
        }

        // Update Customer Info
        if (parsed.customerInfo && Object.keys(parsed.customerInfo).length > 0) {
          setCustomerInfo(prev => {
            const next = { ...prev };
            Object.entries(parsed.customerInfo).forEach(([k, v]) => {
              if (v !== undefined && v !== null) {
                (next as any)[k] = v;
                logs.push(`Data Pelanggan: ${k} → "${v || '(dikosongkan)'}"`);
              }
            });
            return next;
          });
        }

        // Update Visual Checklist
        if (parsed.setAllVisualCondition) {
          const cond = parsed.setAllVisualCondition;
          setVisualChecklist(prev => prev.map(item => ({ ...item, condition: cond })));
          logs.push(`Semua Inspeksi Visual (${visualChecklist.length} poin) diset ke [${cond}]`);
        } else if (Array.isArray(parsed.visualChecklist) && parsed.visualChecklist.length > 0) {
          setVisualChecklist(prev =>
            prev.map(item => {
              const itemNoClean = (item.no || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const match = parsed.visualChecklist.find((m: any) => {
                if (!m || !m.match) return false;
                const matchStr = String(m.match).trim().toLowerCase();
                const matchClean = matchStr.replace(/[^a-z0-9]/g, '');
                if (matchClean && matchClean === itemNoClean) return true;
                if (matchStr === (item.no || '').trim().toLowerCase()) return true;
                if (matchStr.length >= 4 && item.activity.toLowerCase().includes(matchStr)) return true;
                return false;
              });
              if (match) {
                const newCond = match.condition || item.condition;
                const newRemarks = match.remarks !== undefined ? match.remarks : item.remarks;
                logs.push(`Inspeksi Visual [${item.no}]: [${newCond}]${newRemarks ? ` (Remark: "${newRemarks}")` : ''}`);
                return {
                  ...item,
                  condition: newCond,
                  remarks: newRemarks
                };
              }
              return item;
            })
          );
        }

        // Update Measurements
        if (parsed.measurements && Object.keys(parsed.measurements).length > 0) {
          setMeasurements(prev => {
            const next = { ...prev };
            Object.entries(parsed.measurements).forEach(([k, v]) => {
              if (v !== undefined && v !== null) {
                next[k] = v as string;
                logs.push(`Pengukuran: ${k} → "${v || '(dikosongkan)'}"`);
              }
            });
            return next;
          });
        }

        // Update Time Spent
        if (parsed.timeSpent && Object.keys(parsed.timeSpent).length > 0) {
          setTimeSpent(prev => {
            const next = { ...prev };
            Object.entries(parsed.timeSpent).forEach(([k, v]) => {
              if (v !== undefined && v !== null && v !== '') {
                (next as any)[k] = v;
                logs.push(`Waktu: ${k} → "${v}"`);
              }
            });
            return next;
          });
        }

        // Update Operation Status
        if (parsed.operationStatus && Object.keys(parsed.operationStatus).length > 0) {
          setOperationStatus(prev => {
            const next = { ...prev, ...parsed.operationStatus };
            logs.push(`Status Operasi: ${parsed.operationStatus.isNormal ? 'Normal' : 'Abnormal'}`);
            return next;
          });
        }
      }

      // Also parse raw text from AI reply if any extra numbers exist
      if (data.reply) {
        const replyExtra = extractFieldsFromVoiceText(data.reply);
        if (Object.keys(replyExtra.measurements).length > 0) {
          setMeasurements(prev => ({ ...prev, ...replyExtra.measurements }));
        }
      }

      const summaryText = parsed?.summary || data.reply || `Berhasil mengisi ${logs.length} field Service Report!`;
      setVoiceFeedback(summaryText);
      setUpdatedFieldsSummary(Array.from(new Set(logs)));
      setIsEnabled(true);
      setIsOpen(true);
      toast.success('Form berhasil diisi oleh AI!', { id: toastId, duration: 3000 });

    } catch (err: any) {
      console.error('AI Voice Agent Error:', err);
      // If network or AI error, keep fast-extracted local values!
      if (fastExtracted.logs.length > 0) {
        toast.success(`Berhasil mengisi ${fastExtracted.logs.length} field dari suara!`, { id: toastId });
      } else {
        toast.error(`Gagal memproses suara: ${err.message || 'Error AI'}`, { id: toastId });
      }
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Sync internal state when initialData changes from external source (breaks infinite re-render loop)
  useEffect(() => {
    if (!initialData) {
      if (config?.checklistTemplate) {
        setVisualChecklist(config.checklistTemplate);
      }
      return;
    }

    const incomingComparable = JSON.stringify({
      isEnabled: true,
      equipmentKey: initialData.equipmentKey || config?.key,
      accountEmail: initialData.accountEmail || userEmail || config?.email,
      customerInfo: initialData.customerInfo,
      timeSpent: initialData.timeSpent,
      operationStatus: initialData.operationStatus,
      visualChecklist: initialData.visualChecklist,
      measurements: initialData.measurements
    });

    // If incoming data matches what we just sent to parent, SKIP updating to prevent render loop
    if (incomingComparable === lastSentPayloadRef.current) {
      return;
    }

    lastSentPayloadRef.current = incomingComparable;
    setIsEnabled(true);
    if (initialData.customerInfo) setCustomerInfo(initialData.customerInfo);
    if (initialData.timeSpent) setTimeSpent(initialData.timeSpent);
    if (initialData.operationStatus) setOperationStatus(initialData.operationStatus);
    if (initialData.visualChecklist) {
      setVisualChecklist(getMergedChecklist(initialData.visualChecklist, config?.checklistTemplate));
    }
    if (initialData.measurements) setMeasurements(initialData.measurements);
  }, [initialData, config]);

  // Sinkronisasi data ke parent saat ada perubahan internal (menggunakan debounced / loop prevention)
  useEffect(() => {
    if (!config || !isEnabled) {
      if (lastSentPayloadRef.current !== 'null') {
        lastSentPayloadRef.current = 'null';
        if (onChange) onChange(null);
      }
      return;
    }

    const currentComparable = JSON.stringify({
      isEnabled: true,
      equipmentKey: config.key,
      accountEmail: userEmail || config.email,
      customerInfo,
      timeSpent,
      operationStatus,
      visualChecklist,
      measurements
    });

    if (currentComparable === lastSentPayloadRef.current) {
      return;
    }

    lastSentPayloadRef.current = currentComparable;

    const payload: ServiceReportPayload = {
      equipmentKey: config.key,
      equipmentName: config.name,
      accountEmail: userEmail || config.email,
      customerInfo,
      timeSpent,
      operationStatus,
      visualChecklist,
      measurements,
      updatedAt: new Date().toISOString()
    };

    if (onChange) onChange(payload);
  }, [isEnabled, customerInfo, timeSpent, operationStatus, visualChecklist, measurements, config?.key, userEmail]);

  // Jika akun ini belum memiliki template yang dipetakan
  if (!isSupported || !config) {
    return null;
  }

  const handleToggleCondition = (index: number, condition: 'Good' | 'Not Good') => {
    setVisualChecklist(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, condition } : item))
    );
  };

  const handleUpdateRemark = (index: number, remarks: string) => {
    setVisualChecklist(prev =>
      prev.map((item, idx) => (idx === index ? { ...item, remarks } : item))
    );
  };

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const handleExportSinglePDF = async () => {
    if (!config) return;
    const payload: ServiceReportPayload = {
      equipmentKey: config.key,
      equipmentName: config.name,
      accountEmail: userEmail || config.email,
      customerInfo,
      timeSpent,
      operationStatus,
      visualChecklist,
      measurements
    };
    if (onExport) {
      await onExport(payload);
    } else {
      await generateUniversalServiceReportPDF(payload, photoCards, true);
    }
  };

  const goodCount = visualChecklist.filter(c => c.condition === 'Good').length;

  return (
    <div className="w-full mt-6 mb-2 rounded-2xl sm:rounded-3xl border border-sky-200/80 bg-gradient-to-b from-white via-sky-50/20 to-white shadow-xl shadow-sky-900/5 overflow-hidden transition-all">
      {/* ─── HEADER CONTAINER / ACCORDION TOGGLE ─── */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-sky-100/80 bg-gradient-to-r from-sky-900/5 via-indigo-900/5 to-transparent">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-600/30 shrink-0">
            <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Service Report Resmi: {config.name}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200">
                Opsional
              </span>
              {isEnabled && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terisi ({goodCount}/{visualChecklist.length} Good)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Lengkapi formulir inspeksi resmi 1:1 spreadsheet untuk dicetak bersama lampiran foto dokumentasi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* AI Voice Note Agent Button with Morphing State */}
          <button
            type="button"
            onClick={toggleVoiceRecording}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/40 ring-4 ring-red-300 animate-pulse'
                : isProcessingVoice
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-700 hover:to-sky-700 text-white shadow-md shadow-purple-600/25'
            }`}
            title={isListening ? 'Klik untuk berhenti & langsung isi form' : 'Klik dan sebutkan data sambil membaca form'}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-white animate-bounce" />
                <span>🔴 Mendengarkan... (Klik Selesai)</span>
              </>
            ) : isProcessingVoice ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-200" />
                <span>⚡ AI Mengisi Form...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                <span>🎙️ AI Voice Agent</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsEnabled(!isEnabled);
              if (!isEnabled) setIsOpen(true);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isEnabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isEnabled ? 'Service Report Aktif' : '+ Aktifkan Service Report'}</span>
          </button>

          {isEnabled && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl bg-sky-100/60 hover:bg-sky-200/60 text-sky-800 transition cursor-pointer"
              title={isOpen ? 'Tutup Form' : 'Buka Form'}
            >
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ─── BODY ACCORDION FORM ─── */}
      <AnimatePresence>
        {isEnabled && isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 sm:p-6"
          >
            {/* Inline AI Voice Bar (No Popup / No Modal Blocking) */}
            <div
              className={`mb-4 p-3.5 rounded-2xl border transition-all duration-300 shadow-xs ${
                isListening
                  ? 'bg-gradient-to-r from-red-50 via-purple-50 to-indigo-50 border-red-300 ring-2 ring-red-200'
                  : isProcessingVoice
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
                  : 'bg-gradient-to-r from-purple-50 via-indigo-50/50 to-sky-50 border-purple-200/70'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 cursor-pointer transition-all ${
                      isListening
                        ? 'bg-red-600 shadow-lg shadow-red-600/30 scale-105 animate-pulse ring-4 ring-red-200'
                        : isProcessingVoice
                        ? 'bg-amber-600 shadow-md'
                        : 'bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-600/20'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5 text-white animate-bounce" />
                    ) : isProcessingVoice ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Mic className="w-5 h-5 text-amber-300" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        {isListening ? (
                          <>
                            <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-ping" />
                            <span className="text-red-700 font-black">Sedang Mendengarkan... Silakan Baca & Sebutkan Data Tabel</span>
                          </>
                        ) : isProcessingVoice ? (
                          <span className="text-amber-800 font-black">AI Sedang Mengekstrak Suara & Mengisi Tabel...</span>
                        ) : (
                          <span className="text-purple-950 font-black">AI Voice Agent Siap Mendengarkan</span>
                        )}
                      </p>
                    </div>

                    <p className="text-[11px] font-medium mt-0.5 text-slate-600">
                      {isListening
                        ? (voiceTranscript ? `Transkrip: "${voiceTranscript}"` : 'Ucapkan data (contoh: "Tegangan RS 380V, suhu 33 derajat, semua visual good")...')
                        : 'Klik mikrofon dan sebutkan data sambil melihat tabel di bawah tanpa tertutup pop-up.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isListening ? (
                    <button
                      type="button"
                      onClick={() => {
                        const textToRun = latestTranscriptRef.current || voiceTranscript;
                        toggleVoiceRecording();
                        if (textToRun && textToRun.trim()) {
                          handleProcessVoiceInput(textToRun);
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 text-white shadow-md shadow-red-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Selesai & Isi Form (AI)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={toggleVoiceRecording}
                      className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-300 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5 text-purple-600" />
                      <span>Mulai Bicara</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Live Filled Summary or Prompt Templates */}
              {updatedFieldsSummary.length > 0 ? (
                <div className="mt-2.5 pt-2.5 border-t border-purple-200/60 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{voiceFeedback || `Berhasil mengisi ${updatedFieldsSummary.length} field!`}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setUpdatedFieldsSummary([])}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Tutup Ringkasan ✕
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 pt-2.5 border-t border-purple-200/50 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-slate-500">Template Cepat:</span>
                  <button
                    type="button"
                    onClick={() => handleProcessVoiceInput("Semua inspeksi visual poin a sampai p kondisinya Good")}
                    className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 rounded-md text-[10px] font-bold border border-emerald-200 transition cursor-pointer"
                  >
                    + Semua Visual Good
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessVoiceInput("Tegangan RS 380 volt, ST 380 volt, TR 380 volt, RN 220 volt, SN 220 volt, TN 220 volt, suhu 34 derajat, grounding 0.8 ohm")}
                    className="px-2 py-0.5 bg-white hover:bg-sky-50 text-sky-800 rounded-md text-[10px] font-bold border border-sky-200 transition cursor-pointer"
                  >
                    + Standar Tegangan & Suhu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessVoiceInput("Company name Neutra DC Cikarang, MOP no DME-TDE/MOP/ATS/02, lokasi Lt 2 CDC")}
                    className="px-2 py-0.5 bg-white hover:bg-purple-50 text-purple-800 rounded-md text-[10px] font-bold border border-purple-200 transition cursor-pointer"
                  >
                    + Data Pelanggan Neutra DC
                  </button>
                </div>
              )}
            </div>
            {/* Tabs Navigation */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl max-w-3xl mb-6 overflow-x-auto border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab('customer')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'customer'
                    ? 'bg-white text-sky-900 shadow-xs border border-slate-200/80 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-sky-600" />
                <span>Data Pelanggan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('visual')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'visual'
                    ? 'bg-white text-sky-900 shadow-xs border border-slate-200/80 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Inspeksi Visual ({visualChecklist.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('measurements')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'measurements'
                    ? 'bg-white text-sky-900 shadow-xs border border-slate-200/80 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 text-sky-600" />
                <span>Pengukuran (Measurements)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('time')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'time'
                    ? 'bg-white text-sky-900 shadow-xs border border-slate-200/80 font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Waktu & Operasi</span>
              </button>
            </div>

            {/* TAB 1: VISUAL INSPECTION CHECKLIST (16 POIN LENGKAP - 1:1 SPREADSHEET TABLE) */}
            {activeTab === 'visual' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-700">Tabel Pemeriksaan Visual & Fisik (1:1 Spreadsheet Resmi):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualChecklist(prev => prev.map(i => ({ ...i, condition: 'Good' })))}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer shadow-xs"
                    >
                      Set Semua [Good]
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-800 text-white font-extrabold border-b border-sky-900">
                        <th colSpan={6} className="px-3 py-2 text-xs tracking-wider uppercase">
                          Visual inspection & Check
                        </th>
                      </tr>
                      <tr className="bg-sky-100/90 text-sky-950 font-bold border-b border-slate-300 text-center text-[11px]">
                        <th className="py-2.5 px-2 border-r border-slate-300 w-12 shrink-0">No</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 text-left min-w-[280px]">Activity</th>
                        <th className="py-2.5 px-3 border-r border-slate-300 text-center min-w-[180px]">Parameter</th>
                        <th className="py-2.5 px-2 border-r border-slate-300 w-24">Good</th>
                        <th className="py-2.5 px-2 border-r border-slate-300 w-24">Not Good</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {visualChecklist.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-sky-50/50 transition-colors ${
                            item.condition === 'Not Good'
                              ? 'bg-red-50/60'
                              : idx % 2 === 0
                              ? 'bg-white'
                              : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-2.5 px-2 text-center font-bold text-slate-700 border-r border-slate-200 align-middle">
                            {item.no || idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium leading-snug border-r border-slate-200 align-middle">
                            {item.activity}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-center font-medium border-r border-slate-200 align-middle">
                            {item.parameter}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 align-middle">
                            <button
                              type="button"
                              onClick={() => handleToggleCondition(idx, 'Good')}
                              className={`w-full py-1.5 px-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer ${
                                item.condition === 'Good'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Good</span>
                            </button>
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 align-middle">
                            <button
                              type="button"
                              onClick={() => handleToggleCondition(idx, 'Not Good')}
                              className={`w-full py-1.5 px-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer ${
                                item.condition === 'Not Good'
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Not Good</span>
                            </button>
                          </td>
                          <td className="py-2 px-2 align-middle">
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => handleUpdateRemark(idx, e.target.value)}
                              placeholder="Remarks..."
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-slate-800"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: PENGUKURAN & PARAMETER LISTRIK (1:1 SPREADSHEET MEASUREMENTS) */}
            {activeTab === 'measurements' && (
              <div className="space-y-4">
                {/* 1. Digital Power Meter Recording */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-800 text-white font-extrabold border-b border-sky-900">
                        <th colSpan={9} className="px-3 py-2 text-xs tracking-wider">
                          Digital Power Meter Recording <span className="font-normal text-[11px] text-sky-100 italic ml-2">Please mark OK (√), not OK(×), not applicable (N/A) in the box</span>
                        </th>
                      </tr>
                      <tr className="bg-sky-100/90 text-sky-950 font-bold border-b border-slate-300 text-center text-[11px]">
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Voltage)</th>
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Voltage)</th>
                        <th className="py-2 px-2 border-r border-slate-300 w-20">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result</th>
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Ampere)</th>
                        <th className="py-2 px-3 min-w-[140px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {/* Row 1 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R-S</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_rs || ''} onChange={e => handleMeasurementChange('dpm_voltage_rs', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_rn || ''} onChange={e => handleMeasurementChange('dpm_voltage_rn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">KW</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="kW" value={measurements.dpm_kw || ''} onChange={e => handleMeasurementChange('dpm_kw', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.dpm_ampere_r || ''} onChange={e => handleMeasurementChange('dpm_ampere_r', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td rowSpan={4} className="py-1.5 px-2 align-top">
                          <textarea rows={4} placeholder="Remarks..." value={measurements.dpm_remarks || ''} onChange={e => handleMeasurementChange('dpm_remarks', e.target.value)} className="w-full h-full p-2 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none resize-none" />
                        </td>
                      </tr>
                      {/* Row 2 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S-T</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_st || ''} onChange={e => handleMeasurementChange('dpm_voltage_st', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_sn || ''} onChange={e => handleMeasurementChange('dpm_voltage_sn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">KVA</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="kVA" value={measurements.dpm_kva || ''} onChange={e => handleMeasurementChange('dpm_kva', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.dpm_ampere_s || ''} onChange={e => handleMeasurementChange('dpm_ampere_s', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                      {/* Row 3 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T-R</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_tr || ''} onChange={e => handleMeasurementChange('dpm_voltage_tr', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_tn || ''} onChange={e => handleMeasurementChange('dpm_voltage_tn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">KVAR</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="kVAR" value={measurements.dpm_kvar || ''} onChange={e => handleMeasurementChange('dpm_kvar', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.dpm_ampere_t || ''} onChange={e => handleMeasurementChange('dpm_ampere_t', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                      {/* Row 4 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-100/50">-</td>
                        <td className="py-1 px-1 border-r border-slate-200 bg-slate-100/50">-</td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.dpm_voltage_n || ''} onChange={e => handleMeasurementChange('dpm_voltage_n', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">Cos p</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="0.95" value={measurements.dpm_cos_p || ''} onChange={e => handleMeasurementChange('dpm_cos_p', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.dpm_ampere_n || ''} onChange={e => handleMeasurementChange('dpm_ampere_n', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. Voltage & Current Measurement */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-800 text-white font-extrabold border-b border-sky-900">
                        <th colSpan={8} className="px-3 py-2 text-xs tracking-wider">
                          Voltage & Current Measurement
                        </th>
                      </tr>
                      <tr className="bg-sky-100/90 text-sky-950 font-bold border-b border-slate-300 text-center text-[11px]">
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Voltage)</th>
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Voltage)</th>
                        <th className="py-2 px-2 border-r border-slate-300 w-16">Wire</th>
                        <th className="py-2 px-2 border-r border-slate-300 min-w-[90px]">Result (Ampere)</th>
                        <th className="py-2 px-3 border-r border-slate-300 bg-amber-100 text-amber-950 min-w-[160px]">Standard</th>
                        <th className="py-2 px-3 min-w-[140px]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {/* Row 1 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R-S</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_rs || ''} onChange={e => handleMeasurementChange('vc_voltage_rs', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_rn || ''} onChange={e => handleMeasurementChange('vc_voltage_rn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">R</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.vc_ampere_r || ''} onChange={e => handleMeasurementChange('vc_ampere_r', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td rowSpan={4} className="py-2 px-3 text-center align-middle font-bold text-[11px] bg-amber-50 text-amber-900 border-r border-slate-200 leading-snug">
                          +5% - 10% from 380V & 220V<br />load deviation 10%
                        </td>
                        <td rowSpan={4} className="py-1.5 px-2 align-top">
                          <textarea rows={4} placeholder="Remarks..." value={measurements.vc_remarks || ''} onChange={e => handleMeasurementChange('vc_remarks', e.target.value)} className="w-full h-full p-2 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none resize-none" />
                        </td>
                      </tr>
                      {/* Row 2 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S-T</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_st || ''} onChange={e => handleMeasurementChange('vc_voltage_st', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_sn || ''} onChange={e => handleMeasurementChange('vc_voltage_sn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">S</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.vc_ampere_s || ''} onChange={e => handleMeasurementChange('vc_ampere_s', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                      {/* Row 3 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T-R</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_tr || ''} onChange={e => handleMeasurementChange('vc_voltage_tr', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T-N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_tn || ''} onChange={e => handleMeasurementChange('vc_voltage_tn', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">T</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.vc_ampere_t || ''} onChange={e => handleMeasurementChange('vc_ampere_t', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                      {/* Row 4 */}
                      <tr>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-100/50">-</td>
                        <td className="py-1 px-1 border-r border-slate-200 bg-slate-100/50">-</td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">N-G</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="V" value={measurements.vc_voltage_ng || ''} onChange={e => handleMeasurementChange('vc_voltage_ng', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">N</td>
                        <td className="py-1 px-1 border-r border-slate-200">
                          <input type="text" placeholder="A" value={measurements.vc_ampere_n || ''} onChange={e => handleMeasurementChange('vc_ampere_n', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. Thermal Measurement & Grounding Resistance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Thermal */}
                  <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-sky-800 text-white font-extrabold border-b border-sky-900">
                          <th colSpan={4} className="px-3 py-2 text-xs tracking-wider">
                            Thermal Meassurement <span className="font-normal text-[10px] text-sky-100 italic">Please mark OK (√),not OK(×), not applicable (N/A) in the box</span>
                          </th>
                        </tr>
                        <tr className="bg-sky-100/90 text-sky-950 font-bold border-b border-slate-300 text-center text-[11px]">
                          <th className="py-2 px-2 border-r border-slate-300 w-24">Breaker</th>
                          <th className="py-2 px-2 border-r border-slate-300 min-w-[110px]">Result Temperature (°C)</th>
                          <th className="py-2 px-2 border-r border-slate-300 bg-amber-100 text-amber-950 w-24">Standard</th>
                          <th className="py-2 px-3 min-w-[120px]">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-800">
                        <tr>
                          <td className="py-2 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">
                            Breaker Panel
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-200">
                            <input type="text" placeholder="°C" value={measurements.thermal_breaker_temp || ''} onChange={e => handleMeasurementChange('thermal_breaker_temp', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                          </td>
                          <td className="py-2 px-2 text-center font-bold bg-amber-50 text-amber-900 border-r border-slate-200">
                            40°C
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" placeholder="Remarks..." value={measurements.thermal_remarks || ''} onChange={e => handleMeasurementChange('thermal_remarks', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grounding */}
                  <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-sky-800 text-white font-extrabold border-b border-sky-900">
                          <th colSpan={4} className="px-3 py-2 text-xs tracking-wider">
                            Grounding Resistance Meassurement <span className="font-normal text-[10px] text-sky-100 italic">Please mark OK (√), not OK(×), not applicable (N/A) in the box</span>
                          </th>
                        </tr>
                        <tr className="bg-sky-100/90 text-sky-950 font-bold border-b border-slate-300 text-center text-[11px]">
                          <th className="py-2 px-2 border-r border-slate-300 w-24">Wire</th>
                          <th className="py-2 px-2 border-r border-slate-300 min-w-[110px]">Result (ꭥ)</th>
                          <th className="py-2 px-2 border-r border-slate-300 bg-amber-100 text-amber-950 w-24">Standard</th>
                          <th className="py-2 px-3 min-w-[120px]">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-800">
                        <tr>
                          <td className="py-2 px-2 text-center font-bold border-r border-slate-200 bg-slate-50/50">
                            Grounding
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-200">
                            <input type="text" placeholder="ꭥ" value={measurements.grounding_ohm || ''} onChange={e => handleMeasurementChange('grounding_ohm', e.target.value)} className="w-full px-2 py-1 text-xs text-center border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-semibold" />
                          </td>
                          <td className="py-2 px-2 text-center font-bold bg-amber-50 text-amber-900 border-r border-slate-200">
                            &lt;5 ꭥ
                          </td>
                          <td className="py-1.5 px-2">
                            <input type="text" placeholder="Remarks..." value={measurements.grounding_remarks || ''} onChange={e => handleMeasurementChange('grounding_remarks', e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Operation Status & Repair Detail Table */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs bg-white mt-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {/* Normal Operation */}
                      <tr>
                        <td className="py-2.5 px-3 w-48 border-r border-slate-300 align-middle bg-slate-50/50">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="op_status"
                              checked={operationStatus.isNormal}
                              onChange={() => setOperationStatus({ ...operationStatus, isNormal: true })}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                            <span className="font-bold text-xs text-slate-900">□ Normal operation</span>
                          </label>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-slate-700 shrink-0">Remark:</span>
                            <input
                              type="text"
                              value={operationStatus.remark}
                              onChange={e => setOperationStatus({ ...operationStatus, remark: e.target.value })}
                              placeholder="Remarks..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Abnormal Operation */}
                      <tr>
                        <td rowSpan={4} className="py-3 px-3 w-48 border-r border-slate-300 align-top bg-red-50/30">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="op_status"
                              checked={!operationStatus.isNormal}
                              onChange={() => setOperationStatus({ ...operationStatus, isNormal: false })}
                              className="w-4 h-4 mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                            />
                            <div>
                              <span className="font-bold text-xs text-red-900 block">□ Abnormal operation</span>
                              <span className="text-[10px] text-slate-500 italic block mt-0.5 leading-tight">
                                (Please fill the items if the service is repair)
                              </span>
                            </div>
                          </label>
                        </td>
                        <td className="py-1.5 px-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-slate-700 w-32 shrink-0">Fault symptom</span>
                            <input
                              type="text"
                              value={operationStatus.faultSymptom}
                              onChange={e => setOperationStatus({ ...operationStatus, faultSymptom: e.target.value })}
                              placeholder="Gejala kerusakan..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-slate-700 w-32 shrink-0">Fault analysis</span>
                            <input
                              type="text"
                              value={operationStatus.faultAnalysis}
                              onChange={e => setOperationStatus({ ...operationStatus, faultAnalysis: e.target.value })}
                              placeholder="Analisis penyebab kerusakan..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-slate-700 w-32 shrink-0 leading-tight">Work done/ action taken</span>
                            <input
                              type="text"
                              value={operationStatus.workDone}
                              onChange={e => setOperationStatus({ ...operationStatus, workDone: e.target.value })}
                              placeholder="Tindakan yang telah dilakukan..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                            />
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[11px] text-slate-700 w-24 shrink-0">Faul Part SN</span>
                              <input
                                type="text"
                                value={operationStatus.faultPartSN}
                                onChange={e => setOperationStatus({ ...operationStatus, faultPartSN: e.target.value })}
                                placeholder="Serial Number Part..."
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[11px] text-slate-700 w-28 shrink-0">Fault part Name</span>
                              <input
                                type="text"
                                value={operationStatus.faultPartName}
                                onChange={e => setOperationStatus({ ...operationStatus, faultPartName: e.target.value })}
                                placeholder="Nama Part Rusak..."
                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOMER & EQUIPMENT INFO (LENGKAP 1:1 METADATA) */}
            {activeTab === 'customer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={customerInfo.companyName}
                    onChange={e => setCustomerInfo({ ...customerInfo, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">MOP No</label>
                  <input
                    type="text"
                    value={customerInfo.mopNo}
                    placeholder="Contoh: DME-TDE/MOP/ATS/02 0705/26"
                    onChange={e => setCustomerInfo({ ...customerInfo, mopNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Periode Quarter</label>
                  <select
                    value={customerInfo.quarter}
                    onChange={e => setCustomerInfo({ ...customerInfo, quarter: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="Q1">Quarter 1 (Q1)</option>
                    <option value="Q2">Quarter 2 (Q2)</option>
                    <option value="Q3">Quarter 3 (Q3)</option>
                    <option value="Q4">Quarter 4 (Q4)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Equipment Name</label>
                  <input
                    type="text"
                    value={customerInfo.equipmentName}
                    onChange={e => setCustomerInfo({ ...customerInfo, equipmentName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Serial No</label>
                  <input
                    type="text"
                    value={customerInfo.serialNo}
                    placeholder="Nomor Seri / Tag Unit"
                    onChange={e => setCustomerInfo({ ...customerInfo, serialNo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Specification / Type</label>
                  <input
                    type="text"
                    value={customerInfo.specification || ''}
                    placeholder="Spesifikasi / Rating Tegangan"
                    onChange={e => setCustomerInfo({ ...customerInfo, specification: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CI Description</label>
                  <input
                    type="text"
                    value={customerInfo.ciDescription}
                    placeholder="Deskripsi CI"
                    onChange={e => setCustomerInfo({ ...customerInfo, ciDescription: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CI Name</label>
                  <input
                    type="text"
                    value={customerInfo.ciName}
                    placeholder="Nama CI"
                    onChange={e => setCustomerInfo({ ...customerInfo, ciName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    value={customerInfo.productName}
                    placeholder="Nama Produk / Manufaktur"
                    onChange={e => setCustomerInfo({ ...customerInfo, productName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturing Year</label>
                  <input
                    type="text"
                    value={customerInfo.prodYear}
                    placeholder="Tahun Pembuatan"
                    onChange={e => setCustomerInfo({ ...customerInfo, prodYear: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location / Lokasi</label>
                  <input
                    type="text"
                    value={customerInfo.location}
                    placeholder="Contoh: Power Room Lt. 1"
                    onChange={e => setCustomerInfo({ ...customerInfo, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Area</label>
                  <input
                    type="text"
                    value={customerInfo.area}
                    placeholder="Contoh: Substation"
                    onChange={e => setCustomerInfo({ ...customerInfo, area: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Engineer / Insinyur</label>
                  <input
                    type="text"
                    value={customerInfo.engineer}
                    placeholder="Nama PIC Teknisi"
                    onChange={e => setCustomerInfo({ ...customerInfo, engineer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={customerInfo.serviceType}
                    onChange={e => setCustomerInfo({ ...customerInfo, serviceType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="Preventive maintenance">Preventive Maintenance</option>
                    <option value="Installation">Installation</option>
                    <option value="T&C">Testing & Commissioning (T&C)</option>
                    <option value="Repair">Repair / Perbaikan</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Kontrak</label>
                  <select
                    value={customerInfo.contractType}
                    onChange={e => setCustomerInfo({ ...customerInfo, contractType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="Contract">Contract</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Invoice">Invoice</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 4: TIME SPENT & OPERATION STATUS */}
            {activeTab === 'time' && (
              <div className="space-y-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    Waktu Pengerjaan (Time Spent)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Departure</label>
                      <input
                        type="time"
                        value={timeSpent.departure}
                        onChange={e => setTimeSpent({ ...timeSpent, departure: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Arrival</label>
                      <input
                        type="time"
                        value={timeSpent.arrival}
                        onChange={e => setTimeSpent({ ...timeSpent, arrival: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Start Pengerjaan</label>
                      <input
                        type="time"
                        value={timeSpent.start}
                        onChange={e => setTimeSpent({ ...timeSpent, start: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Finish Pengerjaan</label>
                      <input
                        type="time"
                        value={timeSpent.finish}
                        onChange={e => setTimeSpent({ ...timeSpent, finish: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    Status Operasional & Temuan
                  </h4>
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={operationStatus.isNormal}
                        onChange={() => setOperationStatus({ ...operationStatus, isNormal: true })}
                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-emerald-700">Normal Operation</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!operationStatus.isNormal}
                        onChange={() => setOperationStatus({ ...operationStatus, isNormal: false })}
                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-xs font-bold text-red-700">Abnormal / Ada Temuan Kerusakan</span>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Catatan Keseluruhan (Remarks)</label>
                      <input
                        type="text"
                        value={operationStatus.remark}
                        onChange={e => setOperationStatus({ ...operationStatus, remark: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tindakan Dilakukan (Work Done / Action Taken)</label>
                      <input
                        type="text"
                        value={operationStatus.workDone}
                        onChange={e => setOperationStatus({ ...operationStatus, workDone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                      />
                    </div>

                    {!operationStatus.isNormal && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-red-50/50 rounded-xl border border-red-200/60">
                        <div>
                          <label className="block text-[11px] font-bold text-red-800 mb-1">Gejala Gangguan (Fault Symptom)</label>
                          <input
                            type="text"
                            value={operationStatus.faultSymptom}
                            onChange={e => setOperationStatus({ ...operationStatus, faultSymptom: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-red-800 mb-1">Analisis Penyebab (Fault Analysis)</label>
                          <input
                            type="text"
                            value={operationStatus.faultAnalysis}
                            onChange={e => setOperationStatus({ ...operationStatus, faultAnalysis: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-red-800 mb-1">Fault Part SN</label>
                          <input
                            type="text"
                            value={operationStatus.faultPartSN}
                            onChange={e => setOperationStatus({ ...operationStatus, faultPartSN: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-red-800 mb-1">Fault Part Name</label>
                          <input
                            type="text"
                            value={operationStatus.faultPartName}
                            onChange={e => setOperationStatus({ ...operationStatus, faultPartName: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions inside Service Report */}
            <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                Lampiran Foto Terhubung: <span className="font-bold text-slate-800">{photoCards.length} Foto Dokumentasi</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowFullPreview(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 rounded-xl font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-emerald-700" />
                  <span>PREVIEW REPORT</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSinglePDF}
                  className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-sky-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>EXPORT SERVICE REPORT & DOKUMENTASI (PDF)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FULL MULTI-PAGE PREVIEW MODAL (Page 1: Service Report, Page 2: Foto) ─── */}
      {config && (
        <ServiceReportFullPreviewModal
          isOpen={showFullPreview}
          onClose={() => setShowFullPreview(false)}
          payload={{
            equipmentKey: config.key,
            equipmentName: config.name,
            accountEmail: userEmail || config.email,
            customerInfo,
            timeSpent,
            operationStatus,
            visualChecklist,
            measurements
          }}
          photoCards={photoCards}
          companyType={companyType}
          onExport={onExport}
        />
      )}
    </div>
  );
}

