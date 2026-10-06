// ============================================================================
// FILE: frontend/utils/abnormalFindingsData.ts
// Deskripsi: Sumber data tunggal "Temuan Abnormal". Dipakai oleh Pusat Temuan
//            Abnormal (realtime onSnapshot) dan Monthly Report (fetch sekali per
//            bulan) supaya jumlah & isi temuan per bulan selalu identik.
// ============================================================================

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/api/firebase';
import type { AbnormalFinding } from '@/components/DocumentList';
import type { PredictiveReportData } from '@/types/predictiveReportTypes';

export interface AbnormalItem {
  id: string;
  docId: string;
  collectionName: 'pdf_documents' | 'excel_documents' | 'hse' | 'findings';
  documentType: 'pdf' | 'excel' | 'hse';
  fileName: string;
  maintenanceName: string;
  maintenanceTime: string;
  specificDetail?: string;
  companyType?: 'neutra' | 'bri' | 'k2';
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  hasAbnormal: boolean;
  abnormalFinding: AbnormalFinding;
  attachedSrFile?: any;
  attachedSrBase64?: string;
  findingId?: string;
  partName?: string;
  partNumber?: string;
  brandName?: string;
  quantity?: string | number;
  hasPredictiveReport?: boolean;
  predictiveReportId?: string;
  predictiveReportNumber?: string;
  predictiveHealthStatus?: 'Critical' | 'Warning' | 'Caution';
  predictiveRemainingLife?: string;
  predictiveReportData?: PredictiveReportData;
  predictiveEligible?: boolean;
  predictiveEligibleUpdatedAt?: any;
  predictiveEligibleUpdatedBy?: string;
}

// Helper ekstraksi tanggal waktu upload secara deterministik & aman
export function parseDocUploadDate(data: any): Date {
  if (!data) return new Date(0);

  // 1. Cek createdAt / created_at (Timestamp, Date, number ms, atau ISO string)
  const c = data.createdAt || data.created_at;
  if (c) {
    if (c instanceof Date && !isNaN(c.getTime())) return c;
    if (typeof c.toDate === 'function') {
      const d = c.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof c.toMillis === 'function') {
      const ms = c.toMillis();
      if (!isNaN(ms)) return new Date(ms);
    }
    if (typeof c === 'number') {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Cek uploadedAt / uploaded_at / timestamp
  const u = data.uploadedAt || data.uploaded_at || data.timestamp;
  if (u) {
    if (u instanceof Date && !isNaN(u.getTime())) return u;
    if (typeof u.toDate === 'function') {
      const d = u.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof u.toMillis === 'function') {
      const ms = u.toMillis();
      if (!isNaN(ms)) return new Date(ms);
    }
    if (typeof u === 'number') {
      const d = new Date(u);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(u);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback ke maintenanceTime / findingDate / reportedAt / date
  const timeStr = data.findingDate || data.maintenanceTime || data.date || data.reportedAt;
  if (timeStr && typeof timeStr === 'string') {
    const raw = timeStr.trim();
    const firstPart = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw;
    const ymd = firstPart.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymd) {
      const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
      if (!isNaN(d.getTime())) return d;
    }
    const dmy = firstPart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
      if (!isNaN(d.getTime())) return d;
    }
    const parsed = new Date(firstPart);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return new Date(0);
}

// Helper ekstraksi waktu upload temuan dalam milidetik (stabil & tidak berubah saat diedit)
export function getItemUploadTime(item: AbnormalItem): number {
  if (item.createdAt && item.createdAt instanceof Date && !isNaN(item.createdAt.getTime()) && item.createdAt.getTime() > 0) {
    return item.createdAt.getTime();
  }
  const mDate = getItemMonthData(item).date;
  if (mDate && !isNaN(mDate.getTime())) {
    return mDate.getTime();
  }
  return 0;
}

// Helper ekstraksi data bulan & tahun dari laporan temuan abnormal
export function getItemMonthData(item: AbnormalItem): { key: string; label: string; date: Date } {
  let targetDate: Date = (item.createdAt && !isNaN(item.createdAt.getTime()) && item.createdAt.getTime() > 0) ? item.createdAt : new Date(0);

  // 1. Prioritas dari findingDate
  if (item.abnormalFinding?.findingDate) {
    const raw = String(item.abnormalFinding.findingDate).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    } else {
      const match = raw.match(/(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})/);
      if (match) {
        const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        if (!isNaN(parsed.getTime())) targetDate = parsed;
      }
    }
  } else if (item.abnormalFinding?.reportedAt) {
    const raw = item.abnormalFinding.reportedAt;
    const d = new Date(raw as any);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    }
  } else if (item.maintenanceTime) {
    const raw = String(item.maintenanceTime).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    } else {
      const match = raw.match(/(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})/);
      if (match) {
        const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        if (!isNaN(parsed.getTime())) targetDate = parsed;
      }
    }
  }

  const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const label = targetDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return { key, label, date: targetDate };
}

const toUpdatedAt = (data: any, createdAt: Date): Date =>
  data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : createdAt);

// Mapper dokumen pdf_documents / excel_documents (hasAbnormal == true) -> AbnormalItem
export function mapMaintenanceDocToAbnormalItem(
  collectionName: 'pdf_documents' | 'excel_documents',
  id: string,
  data: any
): AbnormalItem {
  const isExcel = collectionName === 'excel_documents';
  const createdAt = parseDocUploadDate(data);
  return {
    id: `${isExcel ? 'excel' : 'pdf'}_${id}`,
    docId: id,
    findingId: data.findingId || data.abnormalFinding?.findingId || undefined,
    collectionName,
    documentType: isExcel ? 'excel' : 'pdf',
    fileName: data.fileName || `${data.maintenanceName || 'Laporan'}.${isExcel ? 'xlsx' : 'pdf'}`,
    maintenanceName: data.maintenanceName || 'Maintenance',
    maintenanceTime: data.maintenanceTime || '',
    specificDetail: data.specificDetail || '',
    companyType: data.companyType,
    createdBy: (data.createdBy || 'engineer').toLowerCase().trim(),
    createdAt,
    updatedAt: toUpdatedAt(data, createdAt),
    hasAbnormal: true,
    abnormalFinding: data.abnormalFinding ? {
      ...data.abnormalFinding,
      findingId: data.findingId || data.abnormalFinding.findingId || undefined,
    } : {
      unitName: data.specificDetail || data.maintenanceName || 'Unit',
      description: 'Temuan abnormal tercatat pada dokumen ini.'
    },
    attachedSrFile: data.attachedSrFile,
    attachedSrBase64: data.attachedSrBase64,
    hasPredictiveReport: Boolean(data.hasPredictiveReport),
    predictiveReportId: data.predictiveReportId,
    predictiveReportNumber: data.predictiveReportNumber,
    predictiveHealthStatus: data.predictiveHealthStatus,
    predictiveRemainingLife: data.predictiveRemainingLife,
    predictiveEligible: data.predictiveEligible !== undefined ? data.predictiveEligible : undefined,
    predictiveEligibleUpdatedAt: data.predictiveEligibleUpdatedAt,
    predictiveEligibleUpdatedBy: data.predictiveEligibleUpdatedBy,
  };
}

// Mapper dokumen hse (hasAbnormal == true) -> AbnormalItem
export function mapHseDocToAbnormalItem(id: string, data: any): AbnormalItem {
  const createdAt = parseDocUploadDate(data);
  return {
    id: `hse_${id}`,
    docId: id,
    findingId: data.findingId || data.abnormalFinding?.findingId || undefined,
    collectionName: 'hse',
    documentType: 'hse',
    fileName: `HSE_${data.aktivitas || 'Inspeksi'}_${data.date || ''}.pdf`,
    maintenanceName: data.aktivitas || 'Inspeksi HSE',
    maintenanceTime: data.date || '',
    specificDetail: data.lokasi || '',
    createdBy: (data.authorEmail || 'hse').toLowerCase().trim(),
    createdAt,
    updatedAt: toUpdatedAt(data, createdAt),
    hasAbnormal: true,
    abnormalFinding: data.abnormalFinding ? {
      ...data.abnormalFinding,
      findingId: data.findingId || data.abnormalFinding.findingId || undefined,
    } : {
      unitName: data.lokasi || data.aktivitas || 'HSE Area',
      description: 'Temuan abnormal tercatat pada dokumen HSE ini.'
    },
    predictiveEligible: data.predictiveEligible !== undefined ? data.predictiveEligible : undefined,
    predictiveEligibleUpdatedAt: data.predictiveEligibleUpdatedAt,
    predictiveEligibleUpdatedBy: data.predictiveEligibleUpdatedBy,
  };
}

/**
 * Gabungkan dokumen abnormal (pdf/excel/hse) dengan koleksi `findings`:
 * - temuan yang cocok dengan dokumen induk diperkaya ke dokumen tsb (tidak dobel),
 * - temuan mandiri (tanpa dokumen induk) ditambahkan setelah dideduplikasi.
 */
export function mergeAbnormalSources(
  pdfList: AbnormalItem[],
  excelList: AbnormalItem[],
  hseList: AbnormalItem[],
  findingsList: any[]
): AbnormalItem[] {
  const normalize = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matchedFindingIds = new Set<string>();

  // Helper pembanding tanggal fleksibel (mendukung format "02 Sep 2026", "2026-09-02", "02/09/2026")
  const datesCompatible = (d1?: string, d2?: string): boolean => {
    if (!d1 || !d2) return true;
    if (d1 === d2) return true;

    // Cek kecocokan tahun (4 digit)
    const y1 = d1.match(/\b(20\d\d)\b/)?.[1];
    const y2 = d2.match(/\b(20\d\d)\b/)?.[1];
    if (y1 && y2 && y1 !== y2) return false;

    // Cek kecocokan bulan (nama bulan ID/EN atau angka MM)
    const getMonthNum = (str: string): number => {
      const s = str.toLowerCase();
      const months = ['jan', 'feb', 'mar', 'apr', 'mei', 'may', 'jun', 'jul', 'agu', 'aug', 'sep', 'okt', 'oct', 'nop', 'nov', 'des', 'dec'];
      for (let i = 0; i < months.length; i++) {
        if (s.includes(months[i])) return Math.floor(i / 2) + 1;
      }
      const mIso = s.match(/^\d{4}-(\d{2})-\d{2}/);
      if (mIso) return parseInt(mIso[1], 10);
      return 0;
    };

    const m1 = getMonthNum(d1);
    const m2 = getMonthNum(d2);
    if (m1 > 0 && m2 > 0 && m1 !== m2) return false;

    return true;
  };

  const enrichItemWithFinding = (it: AbnormalItem): AbnormalItem => {
    const currentDesc = it.abnormalFinding?.description || '';
    const isGenericFallback = !currentDesc ||
      currentDesc === 'Temuan abnormal tercatat pada dokumen ini.' ||
      currentDesc === 'Temuan abnormal tercatat pada dokumen HSE ini.' ||
      currentDesc === 'Ditemukan kondisi kelainan / abnormal pada unit ini.' ||
      currentDesc.startsWith('Temuan abnormal pada part:');

    const sCreated = normalize(it.createdBy);
    const sSpec = normalize(it.specificDetail);
    const sMaint = normalize(it.maintenanceName);

    // Cari SEMUA finding di findingsList yang cocok dengan dokumen induk ini
    const matchingCandidates = findingsList.filter(f => {
      if (!f || matchedFindingIds.has(f.id)) return false;

      // 1. Strict ID matching (prioritas utama)
      if (it.findingId && f.id && it.findingId === f.id) return true;
      if (it.docId && f.docId && it.docId === f.docId) return true;
      if (it.docId && f.reportId && it.docId === f.reportId) return true;
      if (it.docId && f.id && it.docId === f.id) return true;

      // 2. Creator matching
      const fCreated = normalize(f.createdByEmail);
      const creatorMatch = sCreated && fCreated && (
        sCreated === fCreated ||
        sCreated.includes(fCreated) ||
        fCreated.includes(sCreated) ||
        (sCreated.replace(/@.*$/, '') === fCreated.replace(/@.*$/, ''))
      );
      if (!creatorMatch) return false;

      // Cek tanggal apakah bertentangan
      if (!datesCompatible(it.maintenanceTime, f.findingDate)) return false;

      // 3. Unit / Specific Detail matching
      const fSpec = normalize(f.specificDetail);
      const fPart = normalize(f.partName);

      if (sSpec && fSpec && (sSpec === fSpec || sSpec.includes(fSpec) || fSpec.includes(sSpec))) return true;
      if (sSpec && fPart && (sSpec === fPart || sSpec.includes(fPart) || fPart.includes(sSpec))) return true;

      // 4. Maintenance name matching
      const fMaint = normalize(f.maintenanceName);
      if (sMaint && fMaint && (sMaint === fMaint || sMaint.includes(fMaint) || fMaint.includes(sMaint))) {
        if (sSpec && fSpec && sSpec !== fSpec && !sSpec.includes(fSpec) && !fSpec.includes(sSpec)) {
          return false;
        }
        return true;
      }

      return false;
    });

    // Tandai SEMUA candidates yang cocok ke matchedFindingIds agar tidak ada sisa temuan yang lolos ke standaloneFindings!
    matchingCandidates.forEach(cand => matchedFindingIds.add(cand.id));

    // Pilih candidate yang paling terbaru (updatedAt atau createdAt terbaru)
    const matched = matchingCandidates.length > 0
      ? [...matchingCandidates].sort((a, b) => {
          const timeA = a.updatedAt?.toDate?.()?.getTime?.() || (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0) || a.createdAt?.toDate?.()?.getTime?.() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
          const timeB = b.updatedAt?.toDate?.()?.getTime?.() || (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0) || b.createdAt?.toDate?.()?.getTime?.() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
          return timeB - timeA;
        })[0]
      : null;

    if (matched) {
      const hasOwnPhoto = Boolean(
        it.abnormalFinding?.photoBase64 ||
        (it.abnormalFinding?.photos && it.abnormalFinding.photos.length > 0)
      );

      // PENTING: Hanya ambil foto dari finding jika dokumen asli belum ada foto dan finding memiliki foto
      const matchedPhoto = (matched.photos && matched.photos[0]?.base64) || matched.photoBase64 || '';
      const realPhoto = hasOwnPhoto
        ? (it.abnormalFinding?.photoBase64 || (it.abnormalFinding?.photos && it.abnormalFinding.photos[0]?.base64) || '')
        : matchedPhoto;

      const realPhotos = hasOwnPhoto
        ? (it.abnormalFinding?.photos && it.abnormalFinding.photos.length > 0
            ? it.abnormalFinding.photos
            : (it.abnormalFinding?.photoBase64 ? [{ base64: it.abnormalFinding.photoBase64, description: 'Bukti Temuan Abnormal' }] : []))
        : (matched.photos && matched.photos.length > 0
            ? matched.photos
            : (matchedPhoto ? [{ base64: matchedPhoto, description: 'Bukti Temuan Abnormal' }] : []));

      // Ambil deskripsi dan rekomendasi yang diinputkan oleh teknisi
      const realDesc = (isGenericFallback ? (matched.remark || matched.description || (matched.partName ? `Temuan abnormal pada: ${matched.partName}` : '')) : currentDesc)
        || matched.remark
        || matched.description
        || currentDesc;
      const realReco = it.abnormalFinding?.actionRecommendation
        || matched.actionRecommendation
        || (matched.partName ? `Perlu perbaikan / penggantian ${matched.partName}${matched.brandName ? ` (${matched.brandName})` : ''}` : '');

      const realPartName = it.abnormalFinding?.partName || matched.partName || it.partName;
      const realPartNumber = it.abnormalFinding?.partNumber || matched.partNumber || it.partNumber;
      const realBrandName = it.abnormalFinding?.brandName || matched.brandName || it.brandName;
      const realQuantity = it.abnormalFinding?.quantity || matched.quantity || it.quantity;

      return {
        ...it,
        findingId: matched.id,
        partName: realPartName,
        partNumber: realPartNumber,
        brandName: realBrandName,
        quantity: realQuantity,
        predictiveEligible: it.predictiveEligible !== undefined ? it.predictiveEligible : matched.predictiveEligible,
        predictiveEligibleUpdatedAt: it.predictiveEligibleUpdatedAt || matched.predictiveEligibleUpdatedAt,
        predictiveEligibleUpdatedBy: it.predictiveEligibleUpdatedBy || matched.predictiveEligibleUpdatedBy,
        abnormalFinding: {
          ...it.abnormalFinding,
          unitName: it.abnormalFinding?.unitName || matched.specificDetail || matched.partName || it.specificDetail || it.maintenanceName,
          description: realDesc || 'Temuan abnormal tercatat pada dokumen ini.',
          actionRecommendation: realReco || undefined,
          photoBase64: realPhoto || undefined,
          photos: realPhotos,
          reportedBy: it.abnormalFinding?.reportedBy || matched.createdByEmail || it.createdBy,
          reportedAt: it.abnormalFinding?.reportedAt || matched.findingDate || it.maintenanceTime,
          partName: realPartName,
          partNumber: realPartNumber,
          brandName: realBrandName,
          quantity: realQuantity,
          findingId: matched.id,
        }
      };
    }

    return it;
  };

  const enrichedPdf = pdfList.map(enrichItemWithFinding);
  const enrichedExcel = excelList.map(enrichItemWithFinding);
  const enrichedHse = hseList.map(enrichItemWithFinding);

  // Standalone findings: HANYA temuan mandiri tanpa dokumen induk PM (misal dari form input temuan lepas)
  // Jangan pernah melipatgandakan temuan PM yang sudah memiliki dokumen atau dokumennya sudah Normal/dihapus!
  const allEnrichedDocs = [...enrichedPdf, ...enrichedExcel, ...enrichedHse];
  const rawStandaloneFindings = findingsList
    .filter(f => {
      if (!f || matchedFindingIds.has(f.id)) return false;

      // Jika finding memiliki docId/reportId atau terikat ke dokumen yang sudah dihapus/Normal -> JANGAN tampilkan
      if (f.docId || f.reportId) return false;

      // Cek apakah finding ini sudah terwakili oleh salah satu item dokumen yang aktif
      const fSpec = normalize(f.specificDetail || f.partName);
      const fMaint = normalize(f.maintenanceName);
      const fCreated = normalize(f.createdByEmail);

      const isRepresentedInDocs = allEnrichedDocs.some(docIt => {
        const dSpec = normalize(docIt.specificDetail || docIt.abnormalFinding?.unitName);
        const dMaint = normalize(docIt.maintenanceName);
        const dCreated = normalize(docIt.createdBy);

        const creatorOk = !fCreated || !dCreated || dCreated === fCreated || dCreated.includes(fCreated) || fCreated.includes(dCreated);
        const specOk = dSpec && fSpec && (dSpec === fSpec || dSpec.includes(fSpec) || fSpec.includes(dSpec));
        const maintOk = dMaint && fMaint && (dMaint === fMaint || dMaint.includes(fMaint) || fMaint.includes(dMaint));

        return creatorOk && specOk && maintOk;
      });

      if (isRepresentedInDocs) return false;

      // Jika finding memiliki specificDetail atau maintenanceName PM (dibuat dari form laporan PM),
      // dan akun bersangkutan sudah dikelola lewat dokumen PM, jangan munculkan sisa duplikatnya sebagai unit terpisah
      if (!f.manualAbnormal && (fSpec || (fMaint && fMaint !== 'temuanlapangan' && fMaint !== normalize(f.partName)))) {
        return false;
      }

      return true;
    });

  // Deduplikasi antarsesama standalone findings:
  // Jika ada 2 finding lepas dengan unit + maintenance + creator yang sama (misal terduplikasi akibat edit manual sebelumnya),
  // hanya pertahankan 1 temuan yang paling baru datanya, namun pertahankan waktu pembuatan awal (createdAt terlama)
  const standaloneMap = new Map<string, any>();
  rawStandaloneFindings.forEach(f => {
    const key = `${normalize(f.createdByEmail)}_${normalize(f.maintenanceName)}_${normalize(f.specificDetail || f.partName)}`;
    const existing = standaloneMap.get(key);
    if (!existing) {
      standaloneMap.set(key, f);
    } else {
      const timeExisting = existing.updatedAt?.toDate?.()?.getTime?.() || (existing.updatedAt instanceof Date ? existing.updatedAt.getTime() : 0) || existing.createdAt?.toDate?.()?.getTime?.() || (existing.createdAt instanceof Date ? existing.createdAt.getTime() : 0);
      const timeCurrent = f.updatedAt?.toDate?.()?.getTime?.() || (f.updatedAt instanceof Date ? f.updatedAt.getTime() : 0) || f.createdAt?.toDate?.()?.getTime?.() || (f.createdAt instanceof Date ? f.createdAt.getTime() : 0);
      const existingUploadTime = parseDocUploadDate(existing).getTime();
      const currentUploadTime = parseDocUploadDate(f).getTime();
      const earliestCreatedAt = (existingUploadTime > 0 && (currentUploadTime <= 0 || existingUploadTime <= currentUploadTime))
        ? existing.createdAt
        : (f.createdAt || existing.createdAt);

      if (timeCurrent > timeExisting) {
        standaloneMap.set(key, { ...f, createdAt: earliestCreatedAt });
      }
    }
  });

  const deduplicatedFindings = Array.from(standaloneMap.values());
  const standaloneFindings: AbnormalItem[] = deduplicatedFindings.map(f => {
    const createdAt = parseDocUploadDate(f);
    const photoB64 = (f.photos && f.photos[0]?.base64) || f.photoBase64 || '';
    return {
      id: `finding_${f.id}`,
      docId: f.id,
      findingId: f.id,
      collectionName: 'findings',
      documentType: 'pdf',
      fileName: `Temuan_${f.partName || 'Unit'}.pdf`,
      maintenanceName: f.maintenanceName || f.partName || 'Temuan Lapangan',
      maintenanceTime: f.findingDate || (f.findingMonth && f.findingYear ? `${f.findingYear}-${String(f.findingMonth).padStart(2, '0')}-01` : ''),
      specificDetail: f.specificDetail || f.partName || '',
      createdBy: (f.createdByEmail || 'engineer').toLowerCase().trim(),
      createdAt,
      hasAbnormal: true,
      partName: f.partName,
      partNumber: f.partNumber,
      brandName: f.brandName,
      quantity: f.quantity,
      predictiveEligible: f.predictiveEligible !== undefined ? f.predictiveEligible : undefined,
      predictiveEligibleUpdatedAt: f.predictiveEligibleUpdatedAt,
      predictiveEligibleUpdatedBy: f.predictiveEligibleUpdatedBy,
      abnormalFinding: {
        unitName: f.partName || f.specificDetail || 'Unit',
        description: f.remark || f.description || `Temuan abnormal pada: ${f.partName || 'Peralatan'}`,
        actionRecommendation: f.actionRecommendation || (f.partName ? `Perlu perbaikan / penggantian ${f.partName}${f.brandName ? ` (${f.brandName})` : ''}` : ''),
        photoBase64: photoB64 || undefined,
        photos: f.photos || (photoB64 ? [{ base64: photoB64, description: 'Bukti Temuan Abnormal' }] : []),
        reportedBy: f.createdByEmail || 'Engineer',
        reportedAt: f.findingDate || createdAt,
        partName: f.partName,
        partNumber: f.partNumber,
        brandName: f.brandName,
        quantity: f.quantity,
        findingId: f.id,
      }
    };
  });

  return [...enrichedPdf, ...enrichedExcel, ...enrichedHse, ...standaloneFindings];
}

// Foto bukti temuan (base64 / data URL / URL), maksimal `max` buah, tanpa duplikat
export function getAbnormalItemPhotos(item: AbnormalItem, max = 2): string[] {
  const af = item.abnormalFinding;
  const list = [
    ...(Array.isArray(af?.photos) ? af!.photos.map(p => p?.base64) : []),
    af?.photoBase64,
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  return Array.from(new Set(list)).slice(0, max);
}

/**
 * Ambil seluruh temuan abnormal (sekali fetch, bukan realtime) lalu saring ke
 * bulan tertentu memakai aturan bulan yang sama dengan Pusat Temuan Abnormal.
 */
export async function fetchAbnormalItemsForMonth(month: number, year: number): Promise<AbnormalItem[]> {
  const [pdfSnap, excelSnap, hseSnap, findingsSnap] = await Promise.all([
    getDocs(query(collection(db, 'pdf_documents'), where('hasAbnormal', '==', true))),
    getDocs(query(collection(db, 'excel_documents'), where('hasAbnormal', '==', true))),
    getDocs(query(collection(db, 'hse'), where('hasAbnormal', '==', true))),
    getDocs(query(collection(db, 'findings'))),
  ]);

  const items = mergeAbnormalSources(
    pdfSnap.docs.map(d => mapMaintenanceDocToAbnormalItem('pdf_documents', d.id, d.data())),
    excelSnap.docs.map(d => mapMaintenanceDocToAbnormalItem('excel_documents', d.id, d.data())),
    hseSnap.docs.map(d => mapHseDocToAbnormalItem(d.id, d.data())),
    findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  );

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return items.filter(it => getItemMonthData(it).key === monthKey);
}

// Peta id temuan -> foto. Foto tidak disimpan di data laporan (batas 1 MB dokumen Firestore arsip).
export function buildAbnormalPhotoMap(items: AbnormalItem[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  items.forEach(it => {
    const photos = getAbnormalItemPhotos(it);
    if (photos.length > 0) map[it.id] = photos;
  });
  return map;
}
