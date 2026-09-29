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

  // Let's check how many total findings are in Firestore
  const s = await getDocs(collection(db, 'findings'));
  console.log('Total findings in Firestore:', s.size);
  const byMonth = {};
  s.forEach(doc => {
    const d = doc.data();
    const date = d.findingDate || 'no-date';
    const m = date.slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  console.log('Firestore findings by findingDate month:', byMonth);
  process.exit(0);
}
main();
