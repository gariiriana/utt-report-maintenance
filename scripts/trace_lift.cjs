const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, getDoc, query, where } = require('firebase/firestore');

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

  const findingsSnap = await getDocs(collection(db, 'findings'));
  const findingsList = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const liftFinding = findingsList.find(f => f.id === 'BNuUofpmMdFUPvoDQyUR');
  console.log('liftFinding in findingsList:', !!liftFinding);

  // Check if any other lift finding exists in findingsList!
  const allLifts = findingsList.filter(f => normalize(f.maintenanceName).includes('lift') || normalize(f.specificDetail).includes('lift') || normalize(f.partName).includes('lift'));
  console.log('all lifts in findingsList:', allLifts.map(f => ({ id: f.id, partName: f.partName, specificDetail: f.specificDetail, maintenanceName: f.maintenanceName, createdByEmail: f.createdByEmail, findingDate: f.findingDate })));

  // Check how standaloneMap keys are generated:
  // key = `${normalize(f.createdByEmail)}_${normalize(f.maintenanceName)}_${normalize(f.specificDetail || f.partName)}`;
  allLifts.forEach(f => {
    const key = `${normalize(f.createdByEmail)}_${normalize(f.maintenanceName)}_${normalize(f.specificDetail || f.partName)}`;
    console.log(`Lift ${f.id} key: "${key}"`);
  });

  process.exit(0);
}

main().catch(console.error);
