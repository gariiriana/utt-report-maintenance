/**
 * Script: Create 6 Standby Engineer accounts via Firebase Auth REST API
 * Run with: node scripts/create-standby-users.mjs
 * 
 * Uses Firebase Auth REST API (signUp endpoint) - no admin SDK needed.
 */

const API_KEY = 'AIzaSyAkhsPf9KzIq9B7L_P33g-6wN3M7QHXCbs';
const SIGN_UP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

const users = [
  { email: 'agil@utt.com', password: 'agilutt@#2002', displayName: 'Agil' },
  { email: 'krishna@utt.com', password: 'krishna&4638@', displayName: 'Krishna' },
  { email: 'asep@utt.com', password: 'asep%3627@', displayName: 'Asep' },
  { email: 'salman@utt.com', password: 'salman$@3483', displayName: 'Salman' },
  { email: 'gilang@utt.com', password: 'gilang89*00%', displayName: 'Gilang' },
  { email: 'dison@utt.com', password: 'dison%64738@', displayName: 'Dison' },
];

async function createUser(u) {
  try {
    const res = await fetch(SIGN_UP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
        returnSecureToken: true,
      }),
    });

    const data = await res.json();

    if (data.error) {
      if (data.error.message === 'EMAIL_EXISTS') {
        console.log(`✅ ${u.email} already exists`);
      } else {
        console.error(`❌ ${u.email}: ${data.error.message}`);
      }
    } else {
      console.log(`✅ Created ${u.email} → uid: ${data.localId}`);
    }
  } catch (err) {
    console.error(`❌ ${u.email}: ${err.message}`);
  }
}

async function main() {
  console.log('🔧 Creating 6 Standby Engineer accounts...\n');
  
  for (const u of users) {
    await createUser(u);
  }

  console.log('\n🎉 Done! All standby engineer accounts are ready.');
}

main();
