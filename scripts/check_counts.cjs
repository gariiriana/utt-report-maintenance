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

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, 'Qcdme@dme.com', 'Alhabra12345');
  console.log('Signed in successfully.');

  console.log('Fetching findings...');
  const findingsSnap = await getDocs(collection(db, 'findings'));
  console.log('Total findings in DB:', findingsSnap.docs.length);

  console.log('Fetching pdf_documents...');
  const pdfSnap = await getDocs(collection(db, 'pdf_documents'));
  console.log('Total pdf_documents in DB:', pdfSnap.docs.length);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
