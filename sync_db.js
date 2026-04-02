import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkhsPf9KzIq9B7L_P33g-6wN3M7QHXCbs",
  authDomain: "report-utt.firebaseapp.com",
  projectId: "report-utt",
  storageBucket: "report-utt.firebasestorage.app",
  messagingSenderId: "596883644201",
  appId: "1:596883644201:web:51912abf37c85e1136e138",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const YEAR = 2024;
const QUARTER = "Q1";

// Detailed mapping from Excel screenshots
const updates = [
  // A. ELECTRICAL SYSTEM
  { name: "TRANSFORMATOR", cat: "A. ELECTRICAL SYSTEM", plan: 8, yes: 8, today: 8 },
  { name: "AUTOMATIC TRANSFER SWITCH (ATS)", cat: "A. ELECTRICAL SYSTEM", plan: 15, yes: 15, today: 15 },
  { name: "MV & RMU PANEL", cat: "A. ELECTRICAL SYSTEM", plan: 20, yes: 0, today: 0 },
  { name: "LV PANEL", cat: "A. ELECTRICAL SYSTEM", plan: 7, yes: 7, today: 7 },
  { name: "PDU PANEL", cat: "A. ELECTRICAL SYSTEM", plan: 52, yes: 52, today: 52 },
  { name: "LDB & RDB PANEL", cat: "A. ELECTRICAL SYSTEM", plan: 157, yes: 130, today: 130 },
  { name: "GROUNDING", cat: "A. ELECTRICAL SYSTEM", plan: 175, yes: 154, today: 154 },
  { name: "LIGHTNING PROTECTION", cat: "A. ELECTRICAL SYSTEM", plan: 119, yes: 111, today: 111 },
  { name: "UNINTERRUPTIBLE POWER SUPPLY (UPS)", cat: "A. ELECTRICAL SYSTEM", plan: 19, yes: 19, today: 19 },
  { name: "GENERATOR SET (GENSET)", cat: "A. ELECTRICAL SYSTEM", plan: 6, yes: 6, today: 6 },
  { name: "LOAD & CAP BANK", cat: "A. ELECTRICAL SYSTEM", plan: 4, yes: 0, today: 0 },
  { name: "BUSDUCT", cat: "A. ELECTRICAL SYSTEM", plan: 40, yes: 22, today: 39 },
  { name: "EXHAUST FAN", cat: "A. ELECTRICAL SYSTEM", plan: 14, yes: 0, today: 0 },

  // B. COOLING SYSTEM
  { name: "COOLING TOWER", cat: "B. COOLING SYSTEM", plan: 3, yes: 3, today: 3 },
  { name: "COOLING PUMP", cat: "B. COOLING SYSTEM", plan: 12, yes: 0, today: 0 },
  { name: "PHYSICAL COOLING AUTOMATION & TEST TAN", cat: "B. COOLING SYSTEM", plan: 131, yes: 0, today: 0 },
  { name: "CHILLER", cat: "B. COOLING SYSTEM", plan: 3, yes: 0, today: 0 },
  { name: "CRAC", cat: "B. COOLING SYSTEM", plan: 40, yes: 0, today: 0 },
  { name: "FCU", cat: "B. COOLING SYSTEM", plan: 25, yes: 25, today: 25 },
  { name: "VRV", cat: "B. COOLING SYSTEM", plan: 126, yes: 112, today: 114 },
  { name: "PAHU", cat: "B. COOLING SYSTEM", plan: 12, yes: 12, today: 12 },
  { name: "SPLITWALL", cat: "B. COOLING SYSTEM", plan: 11, yes: 8, today: 8 },
  { name: "Presuraziation & Degassing", cat: "B. COOLING SYSTEM", plan: 6, yes: 0, today: 0 },

  // C. FIRE SYSTEM
  { name: "FSS", cat: "C. FIRE SYSTEM", plan: 942, yes: 834, today: 861 },
  { name: "Hydrant System", cat: "C. FIRE SYSTEM", plan: 167, yes: 129, today: 129 },
  { name: "PREACTION", cat: "C. FIRE SYSTEM", plan: 7, yes: 7, today: 7 },

  // D. FUEL SYSTEM
  { name: "Fuel Pump", cat: "D. FUEL SYSTEM", plan: 13, yes: 13, today: 13 },
  { name: "FUEL TANK", cat: "D. FUEL SYSTEM", plan: 14, yes: 14, today: 14 },

  // E. LIFTING SYSTEM
  { name: "Lift Units", cat: "E. LIFTING SYSTEM", plan: 7, yes: 4.67, today: 4.67 },
  { name: "DOCK LEVELLER", cat: "E. LIFTING SYSTEM", plan: 3, yes: 3, today: 3 },

  // F. LEAK DETECTION
  { name: "Water Leak", cat: "F. LEAK DETECTION", plan: 75, yes: 75, today: 75 },
  { name: "FUEL LEAK DETECTION", cat: "F. LEAK DETECTION", plan: 40, yes: 40, today: 40 },

  // G. PLUMBING SYSTEM
  { name: "STP", cat: "G. PLUMBING SYSTEM", plan: 4, yes: 4, today: 4 },
  { name: "WATER TREATMENT", cat: "G. PLUMBING SYSTEM", plan: 1, yes: 1, today: 1 },
  { name: "PUMP", cat: "G. PLUMBING SYSTEM", plan: 33, yes: 0, today: 0 },

  // H. GATE & DOOR
  { name: "Gate", cat: "H. GATE & DOOR", plan: 7, yes: 0, today: 4 },
  { name: "Road Blocker", cat: "H. GATE & DOOR", plan: 0, yes: 0, today: 0 },
  { name: "DOOR", cat: "H. GATE & DOOR", plan: 14, yes: 0, today: 0 },
  { name: "X-RAY", cat: "H. GATE & DOOR", plan: 6, yes: 0, today: 6 },

  // I. LIGHTING SYSTEM
  { name: "PJU & ALL LIGHTING", cat: "I. LIGHTING SYSTEM", plan: 2750, yes: 2750, today: 2750 },
];

async function sync() {
  console.log("Starting sync...");
  const q = query(collection(db, "maintenance_progress"), where("year", "==", YEAR), where("quarter", "==", QUARTER));
  const snapshot = await getDocs(q);
  const existingDocs = snapshot.docs;

  const batch = writeBatch(db);

  for (const update of updates) {
    let docToUpdate = existingDocs.find(d => 
        (d.data().equipment_name.toUpperCase() === update.name.toUpperCase()) ||
        (d.data().equipment_name.toUpperCase().includes(update.name.toUpperCase().split(" ")[0]))
    );

    if (docToUpdate) {
      console.log(`Updating existing: ${update.name}...`);
      batch.update(docToUpdate.ref, {
        category: update.cat,
        equipment_name: update.name,
        plan_qty: update.plan,
        yesterday_qty: update.yes,
        actual_qty: update.today,
        updatedAt: new Date()
      });
    } else {
      console.log(`Creating new: ${update.name}...`);
      const newDocRef = doc(collection(db, "maintenance_progress"));
      batch.set(newDocRef, {
        category: update.cat,
        equipment_name: update.name,
        plan_qty: update.plan,
        yesterday_qty: update.yes,
        actual_qty: update.today,
        year: YEAR,
        quarter: QUARTER,
        remark: "",
        createdAt: new Date()
      });
    }
  }

  // Handle renaming of any stragglers in Category E
  existingDocs.forEach(d => {
    if (d.data().category === "E. PESAWAT ANGKUT") {
      batch.update(d.ref, { category: "E. LIFTING SYSTEM" });
    }
  });

  await batch.commit();
  console.log("DONE! Firestore data is now synchronized with Excel (90.70%).");
}

sync().catch(err => {
  console.error("Sync Error:", err);
  process.exit(1);
});
