const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('../firebase-service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateCollection(colName) {
  console.log(`\nChecking collection: ${colName}...`);
  const snapshot = await db.collection(colName).get();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const updatePayload = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.includes('Agil Zakia Amanda')) {
        const newValue = value.replace(/Agil Zakia Amanda/g, 'Agil Zakia Rahman');
        updatePayload[key] = newValue;
        needsUpdate = true;
        console.log(`[${colName}/${doc.id}] Field "${key}": "${value}" -> "${newValue}"`);
      }
    }

    if (needsUpdate) {
      await doc.ref.update(updatePayload);
      updatedCount++;
    }
  }

  console.log(`Collection ${colName}: Updated ${updatedCount} / ${snapshot.size} documents.`);
  return updatedCount;
}

async function run() {
  const collections = [
    'corrective_reports',
    'findings',
    'excel_documents',
    'pdf_documents',
    'users',
    'hse'
  ];

  let totalUpdated = 0;
  for (const col of collections) {
    totalUpdated += await migrateCollection(col);
  }

  console.log(`\n========================================`);
  console.log(`MIGRATION FINISHED: Total ${totalUpdated} documents updated.`);
  console.log(`========================================\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
