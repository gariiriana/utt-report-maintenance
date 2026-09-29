const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, getDoc, query, where } = require('firebase/firestore');

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

async function main() {
  const res = await fetch('https://dwimitrasystem.com/assets/firebase-CMOc2fMA.js');
  const text = await res.text();
  const apiKey = text.match(/apiKey:[\"']([^\"']+)[\"']/)[1];
  const projectId = text.match(/projectId:[\"']([^\"']+)[\"']/)[1];
  const authDomain = text.match(/authDomain:[\"']([^\"']+)[\"']/)[1];
  const appId = text.match(/appId:[\"']([^\"']+)[\"']/)[1];

  const app = initializeApp({ apiKey, projectId, authDomain, appId });
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, 'Qcdme@dme.com', 'Alhabra12345');

  console.log('--- Inspecting OU.BRAVO.AC-1 (64XpOh2U3q55WjjvpwSX) ---');
  const vrvSnap = await getDoc(doc(db, 'findings', '64XpOh2U3q55WjjvpwSX'));
  const vrvData = vrvSnap.data();
  console.log('VRV raw:', {
    findingDate: vrvData.findingDate,
    findingMonth: vrvData.findingMonth,
    findingYear: vrvData.findingYear,
    createdAt: vrvData.createdAt,
    abnormalFinding: vrvData.abnormalFinding
  });
  console.log('VRV getItemMonthData:', getItemMonthData(vrvData));

  console.log('\n--- Inspecting Lift Passenger campus 2 (BNuUofpmMdFUPvoDQyUR) ---');
  const liftSnap = await getDoc(doc(db, 'findings', 'BNuUofpmMdFUPvoDQyUR'));
  const liftData = liftSnap.data();
  console.log('Lift raw:', {
    findingDate: liftData.findingDate,
    findingMonth: liftData.findingMonth,
    findingYear: liftData.findingYear,
    createdAt: liftData.createdAt,
    abnormalFinding: liftData.abnormalFinding
  });
  console.log('Lift getItemMonthData:', getItemMonthData(liftData));

  // Check if Lift matches any PDF document
  const qPdf = query(collection(db, 'pdf_documents'), where('hasAbnormal', '==', true));
  const pdfSnap = await getDocs(qPdf);
  console.log('\n--- Inspecting 13 PDF Documents with hasAbnormal == true ---');
  pdfSnap.docs.forEach(d => {
    const p = d.data();
    const m = getItemMonthData(p);
    console.log(`PDF Doc ID: ${d.id}, fileName: ${p.fileName}, maintenanceName: ${p.maintenanceName}, specDetail: ${p.specificDetail}, maintenanceTime: ${p.maintenanceTime}, Month: ${m.key}, findingId: ${p.findingId}, abnormalFinding:`, {
      unitName: p.abnormalFinding?.unitName,
      reportedAt: p.abnormalFinding?.reportedAt,
      findingDate: p.abnormalFinding?.findingDate
    });
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
