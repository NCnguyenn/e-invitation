import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const playwrightUrl = pathToFileURL(process.env.PLAYWRIGHT_MODULE).href;
const { chromium } = await import(playwrightUrl);

const server = spawn('node', ['./node_modules/next/dist/bin/next', 'start', '-p', '3210'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});

await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    if (data.toString().includes('Ready')) resolve();
  });
});

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE,
});

try {
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  await page.goto('http://localhost:3210/demo/graduation-editorial-01');

  // Step 1: Open envelope
  console.log('1. Clicking Mở thư...');
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.locator('[data-stage="opened"]').waitFor();

  // Step 2: Click Xem thư mời
  console.log('2. Clicking Xem thư mời...');
  await page.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await page.locator('.invitation-template').waitFor();

  // Wait 600ms for invitation entrance and autoPlay transition
  await page.waitForTimeout(800);

  // Step 3: Check audio button and state
  const audioInfo = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    const btn = document.querySelector('.editorial-audio-control .float-btn');
    const container = document.querySelector('.editorial-audio-control');
    const rect = container ? container.getBoundingClientRect() : null;
    const cs = container ? getComputedStyle(container) : null;
    const btnCs = btn ? getComputedStyle(btn) : null;
    return {
      audioExists: Boolean(audio),
      audioSrc: audio?.src,
      audioPaused: audio?.paused,
      audioDuration: audio?.duration,
      btnDisabled: btn?.disabled,
      btnAriaPressed: btn?.getAttribute('aria-pressed'),
      btnClasses: btn?.className,
      containerPosition: cs?.position,
      containerTop: cs?.top,
      containerRight: cs?.right,
      containerZIndex: cs?.zIndex,
      rect: rect ? { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } : null,
      animationName: btnCs?.animationName,
      animationPlayState: btnCs?.animationPlayState,
    };
  });

  console.log('Audio & Disc Status:', JSON.stringify(audioInfo, null, 2));

  // Step 4: Scroll down and verify floating position
  console.log('3. Scrolling down to 1500px...');
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  await page.waitForTimeout(200);

  const scrolledRect = await page.evaluate(() => {
    const container = document.querySelector('.editorial-audio-control');
    const rect = container?.getBoundingClientRect();
    return {
      top: rect?.top,
      right: rect?.right,
      windowScrollY: window.scrollY,
    };
  });
  console.log('Scrolled state:', scrolledRect);

  assert.equal(scrolledRect.top < 100, true, 'Audio control must stay at the top of the viewport when scrolled');

  // Step 5: Test clicking disc button to toggle
  console.log('4. Clicking disc to toggle pause/play...');
  const discBtn = page.locator('.editorial-audio-control .float-btn');
  await discBtn.click();
  await page.waitForTimeout(300);

  const afterClick1 = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    const btn = document.querySelector('.editorial-audio-control .float-btn');
    return { paused: audio?.paused, ariaPressed: btn?.getAttribute('aria-pressed') };
  });
  console.log('After click 1:', afterClick1);

  await discBtn.click();
  await page.waitForTimeout(300);
  const afterClick2 = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    const btn = document.querySelector('.editorial-audio-control .float-btn');
    return { paused: audio?.paused, ariaPressed: btn?.getAttribute('aria-pressed') };
  });
  console.log('After click 2:', afterClick2);

  console.log('SUCCESS! All tests passed.');
} finally {
  await browser.close();
  server.kill();
}
