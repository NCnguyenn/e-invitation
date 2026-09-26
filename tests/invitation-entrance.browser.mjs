// Run against next dev: PLAYWRIGHT_MODULE may point at an existing Playwright module.
// BROWSER_EXECUTABLE is optional when Playwright has its own Chromium installed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const output = 'test-results/invitation-entrance';
await mkdir(output, { recursive: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', error => errors.push(error.message));
const previewUrl = `${base}/preview?guestName=${encodeURIComponent('Nguyễn Minh Anh')}`;

async function closed() {
  await page.locator('[data-stage="closed"]').waitFor();
  assert.equal(await page.locator('.invitation-template:visible').count(), 0);
  assert.equal(await page.getByRole('article').count(), 0, 'closed letter hidden from accessibility tree');
}

async function openLetter() {
  const started = performance.now();
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.locator('[data-stage="opened"]').waitFor();
  assert.ok(performance.now() - started < 1850, 'sequenced opening completes without an extra loading delay');
  assert.equal(await page.locator('.invitation-template:visible').count(), 0, 'opening letter does not reveal event');
  assert.equal(await page.getByRole('button', { name: 'Xem thư mời', exact: true }).count(), 1);
  assert.equal(await page.getByRole('article').evaluate(el => el === document.activeElement), true);
}

try {
  await page.goto(previewUrl);
  await closed();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/desktop-closed.png`, fullPage: true });
  await page.getByRole('button', { name: 'Mở thư', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-stage="opening"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[data-stage="opened"]').waitFor();
  assert.equal(await page.locator('.invitation-template:visible').count(), 0, 'double Enter cannot skip personal letter');
  await page.screenshot({ path: `${output}/desktop-open.png`, fullPage: true });

  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Xem thư mời', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.locator('.invitation-template:visible').waitFor();
  assert.equal(page.url(), previewUrl);
  assert.equal(await page.getByLabel('Nội dung thư mời', { exact: true }).evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('.guest-rsvp-form:visible').count(), 1);
  // Replaying the entrance must not discard an in-progress RSVP.
  const message = page.locator('.guest-rsvp-form textarea');
  await message.fill('Chúc mừng bạn!');
  // A silent WAV exercises actual HTMLAudioElement playback without requesting private audio.
  await page.locator('audio').evaluate(async audio => {
    const bytes = new Uint8Array(8044).fill(128);
    const view = new DataView(bytes.buffer);
    const text = (offset, value) => [...value].forEach((char, index) => bytes[offset + index] = char.charCodeAt(0));
    text(0, 'RIFF'); view.setUint32(4, 8036, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, 'data'); view.setUint32(40, 8000, true);
    audio.src = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
    await audio.play();
  });
  assert.equal(await page.locator('audio').evaluate(el => el.paused), false);
  await page.getByRole('button', { name: 'Xem lại phong thư' }).click();
  await closed();
  assert.equal(await page.locator('audio').evaluate(el => el.paused), true, 'replay pauses music while controls are hidden');
  await page.locator('audio').evaluate(async audio => { await audio.play().catch(() => {}); });
  await page.waitForFunction(() => document.querySelector('audio').paused);
  assert.equal(await page.getByRole('button', { name: 'Mở thư', exact: true }).evaluate(el => el === document.activeElement), true);
  await openLetter();
  const started = performance.now();
  await page.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await page.locator('.invitation-template:visible').waitFor();
  assert.ok(performance.now() - started < 650, 'invitation appears promptly after the second click');
  assert.equal(await message.inputValue(), 'Chúc mừng bạn!');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('invitation-viewed:')).length), 0);
  await page.reload();
  await closed();
  console.log('PASS: two clicks, keyboard focus, unchanged URL, RSVP preserved on replay, preview never persists');

  for (const [width, height] of [[390, 844], [320, 740], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await openLetter();
    const bounds = await page.evaluate(() => {
      const header = document.querySelector('[data-stage] header').getBoundingClientRect();
      const letter = document.querySelector('article').getBoundingClientRect();
      const button = document.querySelector('[data-stage] button').getBoundingClientRect();
      return { headerBottom: header.bottom, letterTop: letter.top, letterBottom: letter.bottom, buttonTop: button.top, buttonBottom: button.bottom, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.ok(bounds.letterTop >= bounds.headerBottom, `letter overlaps header at ${width}px`);
    assert.ok(bounds.buttonTop > bounds.letterBottom, `button overlaps letter at ${width}px`);
    assert.ok(bounds.scrollWidth <= width, `horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${output}/open-${width}.png`, fullPage: true });
    await page.reload();
    await closed();
  }
  console.log('PASS: 320px, 390px and tablet layouts, letter/header/button separation');

  // Exercise layout with the same maximum-length plain text the server accepts.
  const longNote = ('Cảm ơn bạn đã luôn đồng hành cùng mình. ').repeat(16).slice(0, 500);
  await page.setViewportSize({ width: 390, height: 844 });
  const longName = 'Nguyễn Minh Anh và gia đình '.repeat(10).slice(0, 255);
  await page.goto(`${base}/preview?guestName=${encodeURIComponent(longName)}`);
  await closed();
  await openLetter();
  const article = page.getByRole('article');
  await article.locator('p').filter({ hasText: 'Mong được gặp bạn trong ngày đặc biệt này!' }).evaluate((el, text) => { el.textContent = text; }, longNote);
  assert.ok((await article.textContent()).includes(longNote));
  assert.ok(await article.evaluate(el => el.scrollHeight > el.clientHeight));
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('article').scrollTop > 0, { timeout: 2000 });
  await article.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.screenshot({ path: `${output}/long-letter-end.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await page.locator('.invitation-template:visible').waitFor();
  console.log('PASS: 255-character name, 500-character note, keyboard scrolling, entry remains usable');

  const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const reducedPage = await reduced.newPage();
  reducedPage.on('pageerror', error => errors.push(error.message));
  await reducedPage.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } }));
  await reducedPage.goto(previewUrl);
  await reducedPage.locator('[data-stage="closed"]').waitFor();
  await reducedPage.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await reducedPage.locator('[data-stage="opened"]').waitFor();
  assert.equal(await reducedPage.locator('[data-envelope-part="paper"]').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await reducedPage.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await reducedPage.locator('.invitation-template:visible').waitFor();
  await reduced.close();
  assert.deepEqual(errors, []);
  console.log('PASS: reduced motion, storage denied, no browser exceptions');
} catch (error) {
  console.error('Browser errors:', errors);
  console.error('Page:', (await page.locator('body').innerText()).slice(0, 1600));
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
