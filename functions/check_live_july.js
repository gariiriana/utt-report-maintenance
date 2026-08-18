const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAkhsPf9KzIq9B7L_P33g-6wN3M7QHXCbs",
  authDomain: "report-utt.firebaseapp.com",
  projectId: "report-utt",
  storageBucket: "report-utt.firebasestorage.app",
  messagingSenderId: "596883644201",
  appId: "1:596883644201:web:51912abf37c85e1136e138"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkJulyData() {
  const collections = [
    'excel_documents',
    'pdf_documents',
    'findings',
    'cm_reports',
    'corrective_reports',
    'sla_reports',
    'mop_workflows',
    'absen_tbm',
    'pm_schedules',
    'ptw_documents'
  ];

  console.log('=== INSPECTING LIVE FIRESTORE DATA FOR JULY 2026 ===\n');

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      const julyDocs = [];
      const sampleDates = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        const str = JSON.stringify(data).toLowerCase();

        let dVal = data.date || data.createdAt || data.workDate || data.tanggal || data.reportedAt;
        if (dVal && typeof dVal.toDate === 'function') {
          dVal = dVal.toDate().toISOString();
        }
        if (dVal && sampleDates.length < 3) {
          sampleDates.push(String(dVal).substring(0, 10));
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
            id: docSnap.id,
            user: data.createdBy || data.createdByEmail || data.author || data.email || data.userEmail || 'Unknown',
            title: data.title || data.fileName || data.equipment || data.partName || data.scope || data.ticketName || data.activity || docSnap.id,
            date: dVal
          });
        }
      });

      console.log(`📂 [${colName}]: Total ${snap.size} docs`);
      console.log(`   Sample Dates: ${sampleDates.join(', ') || 'N/A'}`);
      console.log(`   July 2026 Items: ${julyDocs.length}`);
      if (julyDocs.length > 0) {
        julyDocs.slice(0, 5).forEach((d, i) => {
          console.log(`     ${i+1}. [${d.user}] - ${d.title} (${d.date})`);
        });
      }
    } catch (e) {
      console.log(`Error reading ${colName}:`, e.message);
    }
  }
}

checkJulyData().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
