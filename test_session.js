import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const scratchDir = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\57449464-4824-426d-b205-6952bcfe5898';

// Chrome or Edge profile directory
const chromeUserData = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';
const edgeUserData = 'C:\\Users\\User\\AppData\\Local\\Microsoft\\Edge\\User Data';
const userDataDir = fs.existsSync(chromeUserData) ? chromeUserData : edgeUserData;

async function run() {
  console.log('Using browser:', executablePath);
  console.log('Using UserDataDir:', userDataDir);

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir,
    args: ['--profile-directory=Default', '--no-first-run'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  await page.goto('https://dwimitrasystem.com/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: path.join(scratchDir, 'test_logged_in.png') });
  console.log('Test screenshot saved!');

  await browser.close();
}

run().catch(err => {
  console.error('Session test error:', err);
  process.exit(1);
});
