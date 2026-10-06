// Kredensial dari environment (jangan hardcode password di repo).
function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Set env ${name} dulu.`); process.exit(1); }
  return v;
}

const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, query, where, doc, getDoc } = require('firebase/firestore');

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDocUploadDate(data) {
  if (data?.uploadedAt?.toDate) return data.uploadedAt.toDate();
  if (data?.uploadedAt) {
    const d = new Date(data.uploadedAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (data?.createdAt?.toDate) return data.createdAt.toDate();
  if (data?.createdAt) {
    const d = new Date(data.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

function getItemMonthData(item) {
  let targetDate = item.createdAt ? (item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt)) : new Date(0);

  if (item.abnormalFinding?.findingDate || item.findingDate) {
    const raw = String(item.abnormalFinding?.findingDate || item.findingDate).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) targetDate = d;
  } else if (item.maintenanceTime) {
    const raw = String(item.maintenanceTime).trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) targetDate = d;
  }

  const key = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  return { key, targetDate };
}

const datesCompatible = (d1, d2) => {
  if (!d1 || !d2) return true;
  if (d1 === d2) return true;

  const y1 = d1.match(/\b(20\d\d)\b/)?.[1];
  const y2 = d2.match(/\b(20\d\d)\b/)?.[1];
  if (y1 && y2 && y1 !== y2) return false;

  const getMonthNum = (str) => {
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

async function main() {
  const mdContent = fs.readFileSync('D:/Users/Documents/Obsidian Vault/powerfull/Monthly Report August 2026 - Operational Status Not Good Condition.md', 'utf8');

  const res = await fetch('https://dwimitrasystem.com/assets/firebase-CMOc2fMA.js');
  const text = await res.text();
  const apiKey = text.match(/apiKey:[\"']([^\"']+)[\"']/)[1];
  const projectId = text.match(/projectId:[\"']([^\"']+)[\"']/)[1];
  const authDomain = text.match(/authDomain:[\"']([^\"']+)[\"']/)[1];
  const appId = text.match(/appId:[\"']([^\"']+)[\"']/)[1];

  const app = initializeApp({ apiKey, projectId, authDomain, appId });
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, requireEnv('DWIMITRA_SCRIPT_EMAIL'), requireEnv('DWIMITRA_SCRIPT_PASSWORD'));

  const qPdf = query(collection(db, 'pdf_documents'), where('hasAbnormal', '==', true));
  const pdfSnap = await getDocs(qPdf);
  const pdfList = pdfSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const findingsSnap = await getDocs(collection(db, 'findings'));
  const findingsList = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Replicate frontend EXACTLY
  const matchedFindingIds = new Set();
  const enrichItemWithFinding = (it) => {
    const sCreated = normalize(it.createdBy);
    const sSpec = normalize(it.specificDetail);
    const sMaint = normalize(it.maintenanceName);

    const matchingCandidates = findingsList.filter(f => {
      if (!f || matchedFindingIds.has(f.id)) return false;
      if (it.findingId && f.id && it.findingId === f.id) return true;
      if (it.docId && f.docId && it.docId === f.docId) return true;
      if (it.docId && f.reportId && it.docId === f.reportId) return true;
      if (it.docId && f.id && it.docId === f.id) return true;

      const fCreated = normalize(f.createdByEmail);
      const creatorMatch = sCreated && fCreated && (
        sCreated === fCreated ||
        sCreated.includes(fCreated) ||
        fCreated.includes(sCreated) ||
        (sCreated.replace(/@.*$/, '') === fCreated.replace(/@.*$/, ''))
      );
      if (!creatorMatch) return false;
      if (!datesCompatible(it.maintenanceTime, f.findingDate)) return false;

      const fSpec = normalize(f.specificDetail);
      const fPart = normalize(f.partName);
      if (sSpec && fSpec && (sSpec === fSpec || sSpec.includes(fSpec) || fSpec.includes(sSpec))) return true;
      if (sSpec && fPart && (sSpec === fPart || sSpec.includes(fPart) || fPart.includes(sSpec))) return true;

      const fMaint = normalize(f.maintenanceName);
      if (sMaint && fMaint && (sMaint === fMaint || sMaint.includes(fMaint) || fMaint.includes(sMaint))) {
        if (sSpec && fSpec && sSpec !== fSpec && !sSpec.includes(fSpec) && !fSpec.includes(sSpec)) {
          return false;
        }
        return true;
      }
      return false;
    });

    matchingCandidates.forEach(cand => matchedFindingIds.add(cand.id));
    const matched = matchingCandidates[0] || null;
    if (matched) {
      return {
        ...it,
        findingId: matched.id,
        abnormalFinding: {
          ...it.abnormalFinding,
          unitName: it.abnormalFinding?.unitName || matched.specificDetail || matched.partName || it.specificDetail || it.maintenanceName,
          description: matched.remark || matched.description || it.abnormalFinding?.description,
          reportedAt: it.abnormalFinding?.reportedAt || matched.findingDate || it.maintenanceTime,
        }
      };
    }
    return it;
  };

  const enrichedPdf = pdfList.map(enrichItemWithFinding);
  const rawStandaloneFindings = findingsList.filter(f => !matchedFindingIds.has(f.id));

  const standaloneMap = new Map();
  const swallowedMap = new Map(); // swallowed -> kept
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
        swallowedMap.set(existing.id, f);
        standaloneMap.set(key, { ...f, createdAt: earliestCreatedAt });
      } else {
        swallowedMap.set(f.id, existing);
      }
    }
  });

  const standaloneFindings = Array.from(standaloneMap.values()).map(f => {
    const createdAt = parseDocUploadDate(f);
    return {
      id: `finding_${f.id}`,
      docId: f.id,
      findingId: f.id,
      collectionName: 'findings',
      documentType: 'pdf',
      fileName: `Temuan_${f.partName || 'Unit'}.pdf`,
      maintenanceName: f.maintenanceName || f.partName || 'Temuan Lapangan',
      maintenanceTime: f.findingDate || '',
      specificDetail: f.specificDetail || f.partName || '',
      createdBy: (f.createdByEmail || 'engineer').toLowerCase().trim(),
      createdAt,
      hasAbnormal: true,
      abnormalFinding: {
        unitName: f.partName || f.specificDetail || 'Unit',
        description: f.remark || f.description || '',
        reportedAt: f.findingDate || createdAt,
        findingDate: f.findingDate
      }
    };
  });

  const combined = [...enrichedPdf, ...standaloneFindings];
  const augustItemsInUI = combined.filter(it => getItemMonthData(it).key === '2026-08');

  console.log('Total items in August 2026 UI:', augustItemsInUI.length);

  // Check the 86 items from report
  // Let's parse each table row from the markdown
  const lines = mdContent.split('\n');
  const reportItems = [];
  let currentSystem = '';
  lines.forEach(line => {
    if (line.startsWith('### ')) {
      currentSystem = line.replace('### ', '').trim();
    }
    if (line.startsWith('|') && line.includes('Not Good')) {
      const parts = line.split('|').map(p => p.trim());
      // Table cols: | No | Class Name / Unit | Item Pekerjaan / Temuan Lapangan | Remark / Rekomendasi | Status |
      if (parts.length >= 6) {
        reportItems.push({
          system: currentSystem,
          no: parts[1],
          unit: parts[2],
          finding: parts[3],
          remark: parts[4]
        });
      }
    }
  });

  console.log(`Total Not Good Condition items parsed from Report: ${reportItems.length}`);

  // Trace which of the 86 items are NOT in augustItemsInUI
  console.log('\n--- MATCHING 86 REPORT ITEMS TO AUGUST UI ITEMS ---');
  let matchedCount = 0;
  let missingItems = [];

  reportItems.forEach(rep => {
    const normUnit = normalize(rep.unit);
    // Find in augustItemsInUI
    const found = augustItemsInUI.find(ui => {
      const uiUnit = normalize(ui.specificDetail || ui.abnormalFinding?.unitName || '');
      return uiUnit.includes(normUnit) || normUnit.includes(uiUnit);
    });

    if (found) {
      matchedCount++;
    } else {
      missingItems.push(rep);
    }
  });

  console.log(`Matched to August UI: ${matchedCount} / ${reportItems.length}`);
  console.log(`Missing from August UI (${missingItems.length} items):`);
  missingItems.forEach(m => {
    console.log(`- [${m.system}] Unit: ${m.unit} | Finding: ${m.finding}`);
  });

  process.exit(0);
}

main().catch(console.error);
