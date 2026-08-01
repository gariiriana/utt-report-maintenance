import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edgeUserData = 'C:\\Users\\User\\AppData\\Local\\Microsoft\\Edge\\User Data';
const tempUserData = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\57449464-4824-426d-b205-6952bcfe5898\\temp_edge_profile';

const scratchDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\57449464-4824-426d-b205-6952bcfe5898';

async function run() {
  console.log('Using Edge:', edgePath);

  const browser = await puppeteer.launch({
    executablePath: edgePath,
    headless: false,
    userDataDir: tempUserData,
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  console.log('Navigating to dwimitrasystem.com...');
  await page.goto('https://dwimitrasystem.com/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // Type Login Credentials
  const emailSelector = 'input[type="email"]';
  const passSelector = 'input[type="password"]';
  
  if (await page.$(emailSelector)) {
    await page.type(emailSelector, 'standby@dwimitra.co.id');
    await page.type(passSelector, 'Dwimitra@2013');
    
    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else await page.keyboard.press('Enter');

    console.log('Submitted login in Edge...');
    await new Promise(r => setTimeout(r, 4000));
  }

  await page.screenshot({ path: path.join(scratchDir, 'edge_check.png') });
  console.log('Edge screenshot saved to edge_check.png');

  // Keep open or inspect title
  const title = await page.title();
  console.log('Page title:', title);

  await browser.close();
}

run().catch(err => {
  console.error('Edge test error:', err);
  process.exit(1);
});
