const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../firebase-service-account.json'), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspectJuly() {
  const collections = [
    'excel_documents',
    'pdf_documents',
    'findings',
    'cm_reports',
    'corrective_reports',
    'sla_reports',
    'mop_workflows',
    'absen_tbm',
    'absen_induction',
    'pm_schedules',
    'ptw_documents'
  ];

  console.log('=== INSPECTION OF FIRESTORE FOR JULY 2026 ===\n');

  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      const julyDocs = [];
      const datesSample = [];

      snap.forEach(doc => {
        const data = doc.data();
        const str = JSON.stringify(data).toLowerCase();
        
        let dVal = data.date || data.createdAt || data.workDate || data.tanggal || data.reportedAt;
        if (dVal && typeof dVal.toDate === 'function') {
          dVal = dVal.toDate().toISOString();
        }
        if (dVal && datesSample.length < 3) {
          datesSample.push(String(dVal).substring(0, 10));
        }

        const isJuly = 
          str.includes('2026-07') ||
          str.includes('juli 2026') ||
          str.includes('july 2026') ||
          str.includes('07/2026') ||
          str.includes('/07/2026') ||
          (typeof dVal === 'string' && dVal.includes('2026-07'));

        if (isJuly) {
          julyDocs.push({
            id: doc.id,
            user: data.createdBy || data.createdByEmail || data.author || data.email || data.userEmail || 'Unknown',
            title: data.title || data.fileName || data.equipment || data.partName || data.scope || data.ticketName || data.activity || data.id,
            date: dVal
          });
        }
      });

      console.log(`\n📂 [${col}] (Total: ${snap.size} docs)`);
      console.log(`   Sample Dates in DB: ${datesSample.join(', ') || 'none'}`);
      console.log(`   July 2026 matches: ${julyDocs.length}`);
      if (julyDocs.length > 0) {
        julyDocs.forEach((d, idx) => {
          console.log(`   ${idx + 1}. [${d.user}] - ${d.title} (Date: ${d.date})`);
        });
      }
    } catch (err) {
      console.log(`Error reading ${col}:`, err.message);
    }
  }
}

inspectJuly().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
