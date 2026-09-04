import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim();
    env[k] = v;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'reports'));
  console.log('Total reports:', snap.size);
  const reports = [];
  snap.forEach(d => {
    const data = d.data();
    reports.push({ id: d.id, ...data });
  });

  const cms = reports.filter(r => r.reportType !== 'SLA' && r.reportType !== 'PIR');
  const slas = reports.filter(r => r.reportType === 'SLA');

  console.log(`Total CM: ${cms.length}, Total SLA: ${slas.length}`);

  console.log('\n--- SLAS Terkait Genset atau 27 Agustus atau GWT (3 September) ---');
  slas.filter(s => {
    const txt = `${s.ticketName || ''} ${s.issue || ''} ${s.remark || ''} ${s.cmReportId || ''}`.toLowerCase();
    return txt.includes('genset') || txt.includes('gwt') || (s.incidentDate && s.incidentDate.includes('27')) || (s.incidentDate && s.incidentDate.includes('3'));
  }).forEach(s => {
    console.log(`SLA ID: ${s.id} | ticketName: ${s.ticketName} | issue: ${s.issue} | date: ${s.incidentDate} | timeOrder: ${s.timeOrder} | cmReportId: ${s.cmReportId}`);
  });

  console.log('\n--- CMS Terkait Genset atau 27 Agustus atau GWT (3 September) ---');
  cms.filter(c => {
    const txt = `${c.incidentName || ''} ${c.equipmentName || ''} ${c.issue || ''}`.toLowerCase();
    return txt.includes('genset') || txt.includes('gwt') || (c.incidentDate && c.incidentDate.includes('27')) || (c.incidentDate && c.incidentDate.includes('3'));
  }).forEach(c => {
    console.log(`CM ID: ${c.id} | incidentName: ${c.incidentName} | eq: ${c.equipmentName} | issue: ${c.issue} | date: ${c.incidentDate} | type: ${c.troubleshootType} | isSparepart: ${c.isSparepartReplacement}`);
  });
}

run().catch(console.error);
