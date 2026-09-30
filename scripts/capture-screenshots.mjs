import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/CHI NGUYEN/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/CHI NGUYEN/.gemini/antigravity/brain/63433a45-c2aa-4727-8b63-4d3bde9c6587';
const LOCAL_DIR = path.resolve('screenshots');

if (!fs.existsSync(LOCAL_DIR)) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
}

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });

  try {
    // 1. Mobile View (Mobile-first invitation)
    console.log('Capturing mobile view...');
    const mobileContext = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3000/preview?template=graduation-editorial-01', { waitUntil: 'networkidle' });

    // Screenshot Entrance - Closed Envelope
    const mobileClosedPath = path.join(LOCAL_DIR, '01_mobile_entrance_closed.png');
    await mobilePage.screenshot({ path: mobileClosedPath });
    fs.copyFileSync(mobileClosedPath, path.join(ARTIFACT_DIR, '01_mobile_entrance_closed.png'));
    console.log('Captured 01_mobile_entrance_closed.png');

    // Click "Mở thư"
    const openBtn = mobilePage.getByRole('button', { name: 'Mở thư', exact: true });
    if (await openBtn.count() > 0) {
      await openBtn.click();
      await mobilePage.locator('[data-stage="opened"]').waitFor({ timeout: 5000 }).catch(() => {});
      await mobilePage.waitForTimeout(600);

      // Screenshot Entrance - Opened
      const mobileOpenedPath = path.join(LOCAL_DIR, '02_mobile_entrance_opened.png');
      await mobilePage.screenshot({ path: mobileOpenedPath });
      fs.copyFileSync(mobileOpenedPath, path.join(ARTIFACT_DIR, '02_mobile_entrance_opened.png'));
      console.log('Captured 02_mobile_entrance_opened.png');
    }

    // Click "Xem thư mời"
    const viewBtn = mobilePage.getByRole('button', { name: 'Xem thư mời', exact: true });
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await mobilePage.locator('.invitation-template').waitFor({ timeout: 5000 }).catch(() => {});
      await mobilePage.waitForTimeout(1500);
    }

    await mobilePage.evaluate(() => document.fonts.ready);
    await mobilePage.waitForTimeout(1000);

    // Full page screenshot mobile
    const mobileFullPath = path.join(LOCAL_DIR, '03_mobile_invitation_full.png');
    await mobilePage.screenshot({ path: mobileFullPath, fullPage: true });
    fs.copyFileSync(mobileFullPath, path.join(ARTIFACT_DIR, '03_mobile_invitation_full.png'));
    console.log('Captured 03_mobile_invitation_full.png (Full page)');

    await mobileContext.close();

    // 2. Desktop View
    console.log('Capturing desktop view...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:3000/preview?template=graduation-editorial-01', { waitUntil: 'networkidle' });

    const deskOpenBtn = desktopPage.getByRole('button', { name: 'Mở thư', exact: true });
    if (await deskOpenBtn.count() > 0) {
      await deskOpenBtn.click();
      await desktopPage.locator('[data-stage="opened"]').waitFor({ timeout: 5000 }).catch(() => {});
      await desktopPage.waitForTimeout(600);
    }

    const deskViewBtn = desktopPage.getByRole('button', { name: 'Xem thư mời', exact: true });
    if (await deskViewBtn.count() > 0) {
      await deskViewBtn.click();
      await desktopPage.locator('.invitation-template').waitFor({ timeout: 5000 }).catch(() => {});
      await desktopPage.waitForTimeout(1500);
    }

    await desktopPage.evaluate(() => document.fonts.ready);
    await desktopPage.waitForTimeout(1000);

    // Full page screenshot desktop
    const desktopFullPath = path.join(LOCAL_DIR, '04_desktop_invitation_full.png');
    await desktopPage.screenshot({ path: desktopFullPath, fullPage: true });
    fs.copyFileSync(desktopFullPath, path.join(ARTIFACT_DIR, '04_desktop_invitation_full.png'));
    console.log('Captured 04_desktop_invitation_full.png (Full page)');

    await desktopContext.close();

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
