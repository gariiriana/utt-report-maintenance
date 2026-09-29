const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

  const findingsSnap = await getDocs(collection(db, 'findings'));
  const findingsList = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const augFindings = findingsList.filter(f => {
    const d = f.findingDate || (f.abnormalFinding && f.abnormalFinding.findingDate);
    return d && d.startsWith('2026-08');
  });

  console.log('Total findings in Firestore with findingDate 2026-08:', augFindings.length);

  // Check what the 86 report items are:
  // Are all 86 report items in augFindings?
  console.log('Sample findingDates in augFindings:');
  const dates = {};
  augFindings.forEach(f => {
    const d = f.findingDate;
    dates[d] = (dates[d] || 0) + 1;
  });
  console.log(dates);

  process.exit(0);
}
main();
