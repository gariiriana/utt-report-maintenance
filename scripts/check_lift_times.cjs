// Kredensial dari environment (jangan hardcode password di repo).
function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Set env ${name} dulu.`); process.exit(1); }
  return v;
}

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

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
  await signInWithEmailAndPassword(auth, requireEnv('DWIMITRA_SCRIPT_EMAIL'), requireEnv('DWIMITRA_SCRIPT_PASSWORD'));

  for (const id of ['BNuUofpmMdFUPvoDQyUR', 't8UePrYavb1FJJ3mdskj', 'gYlprA64NYHBwewKMfDB']) {
    const s = await getDoc(doc(db, 'findings', id));
    const d = s.data();
    console.log(id, {
      findingDate: d.findingDate,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      specificDetail: d.specificDetail,
      partName: d.partName,
      createdByEmail: d.createdByEmail
    });
  }
  process.exit(0);
}
main();
