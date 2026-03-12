import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE ERROR: ' + msg.text());
    } else {
      console.log('PAGE LOG [' + msg.type() + ']:', msg.text());
    }
  });
  page.on('pageerror', error => errors.push('PAGE ERROR: ' + error.message));

  console.log('Navigating to https://report-utt.web.app/...');
  try {
    await page.goto('https://report-utt.web.app/', { waitUntil: 'networkidle0', timeout: 30000 });
  } catch (err) {
    console.error('Navigation error:', err.message);
  }

  console.log('\n=== ALL ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors found!');
  }
  errors.forEach(e => console.log(e));
  
  const bodyText = await page.evaluate(() => document.body ? document.body.innerText : 'no body');
  console.log('\nBody text preview:', bodyText.substring(0, 200));

  await browser.close();
})();
