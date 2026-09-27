// Production UI regression using real components and synthetic data only.
// PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE can select an existing local runtime.
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const output = path.join(root, 'test-results/invitation-performance');
const fixture = path.join(output, 'fixture');
await mkdir(path.join(fixture, 'app/dashboard'), { recursive: true });
await mkdir(path.join(fixture, 'app/guest'), { recursive: true });
await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ name: 'invitation-performance-fixture', private: true, type: 'module' }));
await writeFile(path.join(fixture, 'tsconfig.json'), JSON.stringify({ extends: '../../../tsconfig.json', compilerOptions: { paths: { '@/*': ['../../../src/*'] } }, include: ['next-env.d.ts', 'app/**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }));
await writeFile(path.join(fixture, 'next.config.mjs'), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await writeFile(path.join(fixture, 'app/layout.tsx'), `export {default} from '@/app/layout';`);
await writeFile(path.join(fixture, 'app/dashboard/page.tsx'), `import '@/features/template/fonts.css'; import '@/features/events/dashboard.css'; import {DashboardShell} from '@/features/events/DashboardShell'; import {previewInvitation} from '@/features/template/preview.fixture'; export default function Page(){return <DashboardShell event={{...previewInvitation.event,venueName:null,venueAddress:null,googleMapUrl:null,hasMusic:true}} section="event"/>;}`);
await writeFile(path.join(fixture, 'app/guest/page.tsx'), `import {InvitationEntrance} from '@/features/guest/InvitationEntrance'; import {InvitationTemplate} from '@/features/template/InvitationTemplate'; import {GuestResponse} from '@/features/guest/GuestResponse'; import {GuestAudioControl} from '@/features/guest/GuestAudioControl'; import {previewInvitation} from '@/features/template/preview.fixture'; export default function Page(){const invitation={...previewInvitation,event:{...previewInvitation.event,googleMapUrl:null}}; return <InvitationEntrance guestName={invitation.guestName} invitationNote={invitation.invitationNote} eventTitle={invitation.event.title}><InvitationTemplate mode="guest" invitation={invitation} responseArea={<GuestResponse invitation={invitation} token="synthetic-audit"/>} audioControl={<GuestAudioControl token="synthetic-audit" hasMusic={false}/>}/></InvitationEntrance>;}`);
try { await symlink(path.join(root, 'public'), path.join(fixture, 'public'), 'junction'); }
catch (error) { if (error.code !== 'EEXIST') throw error; }

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', chunk => { log += chunk; });
    child.stderr.on('data', chunk => { log += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(log) : reject(new Error(log)));
  });
}
await run(process.execPath, ['node_modules/next/dist/bin/next', 'build', fixture]);
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const runner = `const http=require('node:http');const next=require('next');const app=next({dev:false,dir:${JSON.stringify(fixture)}});app.prepare().then(()=>http.createServer(app.getRequestHandler()).listen(${port},'127.0.0.1',()=>console.log('READY')));`;
const server = spawn(process.execPath, ['-e', runner], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
const report = { scope: 'Local production fixture, synthetic data, no real API access', checks: [], measurements: {} };

async function check(name, fn) {
  try { await fn(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, message: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.waitForLoadState('networkidle');
}
async function imageBytes(page) {
  return page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\.(webp|png)(\?|$)/.test(e.name)).reduce((sum, e) => sum + e.encodedBodySize, 0));
}
async function reachable(locator) {
  return locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
}

try {
  const deadline = Date.now() + 30000;
  while (!serverLog.includes('READY')) {
    if (Date.now() > deadline || server.exitCode !== null) throw new Error(serverLog || 'Fixture failed to start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // Guard all external requests and mutations. This test never reaches Supabase.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { message: 'Synthetic test: API blocked' } });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  await page.locator('#event-title-input:enabled').waitFor();
  await page.locator('[data-testid="host-preview"] .hero-section').waitFor();
  await settle(page);
  report.measurements.dashboardImageBytes = await imageBytes(page);
  await page.screenshot({ path: path.join(output, 'dashboard.png'), fullPage: true });
  await check('dashboard cover mounts no hidden gallery, audio, RSVP or countdown', async () => {
    assert.equal(await page.locator('[data-testid="host-preview"] .gallery-section, [data-testid="host-preview"] audio, [data-testid="host-preview"] .guest-rsvp-form, [data-testid="host-preview"] [role="timer"]').count(), 0);
  });
  await check('dashboard cold image payload below 1 MB', () => assert.ok(report.measurements.dashboardImageBytes < 1_000_000, `${report.measurements.dashboardImageBytes} bytes`));
  await check('dashboard does not fetch gallery or marquee images', async () => {
    const files = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /gallery-|marquee-|story-|thank-you-/.test(n)));
    assert.deepEqual(files, []);
  });
  const originalTitle = await page.locator('#event-title-input').inputValue();
  const draftTitle = 'Lễ tốt nghiệp — bản nháp kiểm thử';
  await page.locator('#event-title-input').fill(draftTitle);
  await page.locator('#event-date-input').fill('2027-06-15');
  await page.locator('#event-time-input').fill('16:30');
  const draftVenue = 'Hội trường bản nháp';
  const draftAddress = '123 Đường kiểm thử, Hà Nội';
  await page.locator('#event-venue-input').fill(draftVenue);
  await page.locator('#event-address-input').fill(draftAddress);
  await check('saved cover stays independent of draft', async () => {
    assert.ok((await page.locator('[data-testid="host-preview"]').textContent()).includes(originalTitle));
    assert.ok(!(await page.locator('[data-testid="host-preview"]').textContent()).includes(draftTitle));
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'Xem trước thiệp', exact: true }).click();
    const modal = page.locator('.preview-modal-overlay');
    await modal.locator('.event-title').waitFor();
    await settle(page);
    await check(`preview draft and accessible controls at ${width}px`, async () => {
      assert.equal(await modal.locator('.event-title').textContent(), draftTitle);
      assert.equal(await modal.locator('.date-big-number').textContent(), '15');
      assert.match(await modal.locator('.event-datetime-header').textContent(), /16:30/);
      assert.equal(await modal.locator('.venue-name').textContent(), draftVenue);
      assert.equal(await modal.locator('.venue-address').textContent(), draftAddress);
      const guestName = await modal.locator('.guest-name').evaluate(el => ({
        text: el.textContent,
        whiteSpace: getComputedStyle(el).whiteSpace,
        clipped: el.scrollWidth > el.clientWidth + 1,
      }));
      assert.equal(guestName.text, 'Bạn và Người thương');
      assert.notEqual(guestName.whiteSpace, 'nowrap', 'Guest-table styles must not truncate the invitation name');
      assert.equal(guestName.clipped, false, 'Invitation guest name must remain fully readable');
      const close = page.getByRole('button', { name: 'Đóng xem trước', exact: true });
      assert.ok(await reachable(close), 'Close is covered by another element');
      assert.ok(await reachable(modal.locator('.float-btn')), 'Music control is outside the preview or covered');
      await modal.locator('.preview-modal-scroll-area').evaluate(el => { el.scrollTop = 700; });
      await settle(page);
      assert.ok(await reachable(modal.locator('.float-btn')), 'Music control is inaccessible after scrolling');
      await page.getByRole('button', { name: 'Máy tính', exact: false }).click();
      await settle(page);
      assert.ok(await reachable(close), 'Close is covered after scrolling/device switch');
      assert.ok(await reachable(modal.locator('.float-btn')), 'Music control is inaccessible after device switch');
      await modal.locator('.preview-modal-scroll-area').evaluate(el => { el.scrollTop = el.scrollHeight - el.clientHeight - 100; });
      await settle(page);
      assert.ok(await reachable(modal.locator('.float-btn')), 'Music control is inaccessible near the bottom');
      await modal.locator('.preview-modal-scroll-area').evaluate(el => { el.scrollTop = 700; });
      await page.screenshot({ path: path.join(output, `preview-${width}.png`) });
      await close.click({ timeout: 2000 });
      assert.equal(await modal.count(), 0);
      assert.ok(await page.getByRole('button', { name: 'Xem trước thiệp', exact: true }).evaluate(el => document.activeElement === el));
    });
    if (await modal.count()) await page.keyboard.press('Escape');
  }
  await check('preview Escape restores focus', async () => {
    await page.getByRole('button', { name: 'Xem trước thiệp', exact: true }).click();
    await page.locator('.preview-modal-overlay .event-title').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.preview-modal-overlay').count(), 0);
    assert.ok(await page.getByRole('button', { name: 'Xem trước thiệp', exact: true }).evaluate(el => document.activeElement === el));
  });
  await check('image and font URLs use immutable content-hashed build assets', async () => {
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\.(woff2|webp|png)(\?|$)/.test(e.name)).map(e => e.name));
    assert.ok(resources.length > 0);
    for (const url of new Set(resources)) {
      assert.ok(new URL(url).pathname.startsWith('/_next/static/'), `${url} is not versioned`);
      const res = await context.request.head(url);
      assert.match(res.headers()['cache-control'], /max-age=31536000.*immutable/);
    }
  });
  await context.close();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await guestContext.route('**/api/**', route => route.fulfill({ status: 503, json: { message: 'Synthetic test: API blocked' } }));
  const guest = await guestContext.newPage();
  guest.on('pageerror', e => errors.push(e.message));
  await guest.goto(`${base}/guest`, { waitUntil: 'networkidle' });
  await guest.locator('[data-stage="closed"]').waitFor();
  report.measurements.guestClosedImageBytes = await imageBytes(guest);
  await guest.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await guest.locator('[data-stage="opened"]').waitFor();
  await guest.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await guest.locator('.invitation-template:visible').waitFor();
  for (const selector of ['.marquee-section', '.story-section', '.gallery-section', '.rsvp-section', '.thank-you-section']) {
    await guest.locator(selector).scrollIntoViewIfNeeded();
    await settle(guest);
  }
  // Load every remaining lazy image to measure the full template, even if it
  // moved out of view during scrolling. A decode() on an unstarted lazy image
  // can wait forever, so use a bounded readiness check instead.
  await guest.locator('img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
  await guest.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
  await settle(guest);
  report.measurements.guestImageBytes = await imageBytes(guest);
  await check('guest full image payload below 2 MB', () => assert.ok(report.measurements.guestImageBytes < 2_000_000, `${report.measurements.guestImageBytes} bytes`));
  await check('all guest images decode; guest has RSVP and retained draft after replay', async () => {
    assert.equal(await guest.locator('img').evaluateAll(images => images.filter(img => !img.complete || !img.naturalWidth).length), 0);
    await guest.locator('[data-testid="rsvp-form"] textarea').fill('Chúc mừng bạn!');
    await guest.getByRole('button', { name: 'Xem lại phong thư' }).click();
    await guest.locator('[data-stage="closed"]').waitFor();
    await guest.getByRole('button', { name: 'Mở thư', exact: true }).click();
    await guest.locator('[data-stage="opened"]').waitFor();
    await guest.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
    await guest.locator('.invitation-template:visible').waitFor();
    assert.equal(await guest.locator('[data-testid="rsvp-form"] textarea').inputValue(), 'Chúc mừng bạn!');
    await guest.evaluate(() => window.scrollTo(0, 0));
    await settle(guest);
    await guest.screenshot({ path: path.join(output, 'guest-mobile.png'), fullPage: true });
  });
  await check('no browser exceptions', () => assert.deepEqual(errors, []));
  console.log(JSON.stringify(report.measurements));
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close();
  server.kill();
}
assert.ok(report.checks.every(check => check.passed), 'See test-results/invitation-performance/report.json for failed assertions');
