const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('../firebase-service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log('Searching for dummy SLA reports in corrective_reports...');
  const snapshot = await db.collection('corrective_reports').get();

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (
      (data.ticketName && data.ticketName.includes('WO-2025-07-00')) ||
      data.reportedBy === 'dummy_seed'
    ) {
      console.log(`Deleting dummy doc: ${doc.id} - ${data.ticketName}`);
      await doc.ref.delete();
      count++;
    }
  }

  console.log(`\nSUCCESS: Deleted ${count} dummy SLA reports.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
