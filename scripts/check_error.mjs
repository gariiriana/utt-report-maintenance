// ============================================================================
// FILE: scripts/check_error.mjs
// Deskripsi: Script Pengujian Headless Browser Puppeteer untuk Audit Error Console.
//            Membuka URL aplikasi yang di-deploy (https://report-utt.web.app/)
//            dan memverifikasi apakah ada JavaScript runtime error atau asset crash.
// ============================================================================

import puppeteer from 'puppeteer';

(async () => {
  // 1. Jalankan instansi headless browser Chrome
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const errors = [];

  // 2. Tangkap log console error dari halaman web
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE ERROR: ' + msg.text());
    } else {
      console.log('PAGE LOG [' + msg.type() + ']:', msg.text());
    }
  });

  // 3. Tangkap uncaught exception pada halaman web
  page.on('pageerror', error => errors.push('PAGE ERROR: ' + error.message));

  console.log('Navigating to https://report-utt.web.app/...');
  try {
    // 4. Buka URL target dengan timeout 30 detik
    await page.goto('https://report-utt.web.app/', { waitUntil: 'networkidle0', timeout: 30000 });
  } catch (err) {
    console.error('Navigation error:', err.message);
  }

  // 5. Tampilkan ringkasan error yang ditemukan
  console.log('\n=== ALL ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors found!');
  }
  errors.forEach(e => console.log(e));

  // 6. Ambil preview teks body halaman
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText : 'no body');
  console.log('\nBody text preview:', bodyText.substring(0, 200));

  // 7. Tutup browser headless
  await browser.close();
})();
