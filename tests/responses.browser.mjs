// node tests/responses.browser.mjs
// Optional: PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE select an existing local runtime.
// Generates an isolated Next fixture under ignored test-results; never bypasses
// authentication or adds demo data/routes to the production application.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
let server;
let baseUrl = process.env.RESPONSES_TEST_URL;
let serverLog = '';
if (!baseUrl) {
  const fixture = 'test-results/response-ui-fixture';
  await mkdir(`${fixture}/app`, { recursive: true });
  await Promise.all([
    writeFile(`${fixture}/package.json`, JSON.stringify({ name: 'response-ui-fixture', private: true, type: 'module' })),
    writeFile(`${fixture}/tsconfig.json`, JSON.stringify({ extends: '../../tsconfig.json', compilerOptions: { paths: { '@/*': ['../../src/*'] } }, include: ['app/**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] })),
    writeFile(`${fixture}/app/layout.tsx`, `import '@/app/globals.css';\nimport '@/features/template/fonts.css';\nimport '@/features/events/dashboard.css';\nexport default function Layout({children}: {children: React.ReactNode}) { return <html lang="vi"><body>{children}</body></html>; }`),
    writeFile(`${fixture}/app/page.tsx`, `import { DashboardShell } from '@/features/events/DashboardShell';\nimport type { HostEvent } from '@/lib/contracts';\nexport default function Page() { return <DashboardShell event={{} as HostEvent} section="responses" />; }`),
  ]);
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  baseUrl = `http://localhost:${port}`;
  // Run the fixture in one process, avoiding the CLI's additional worker process
  // so cleanup also works on Windows without process-tree termination commands.
  const runner = `
    const http = require('node:http');
    const next = require('next');
    const app = next({ dev: true, dir: ${JSON.stringify(fixture)} });
    const handle = app.getRequestHandler();
    app.prepare().then(() => {
      http.createServer((req, res) => handle(req, res)).listen(${port}, () => console.log('FIXTURE_READY'));
    });
  `;
  server = spawn(process.execPath, ['-e', runner], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => { serverLog += data; });
  server.stderr.on('data', data => { serverLog += data; });
}
const out = 'test-results/responses';
await mkdir(out, { recursive: true });
const names = ['Minh Anh', 'Hoàng Nam', 'Thảo Nguyên', 'Gia Hân', 'Quang Huy', 'Ngọc Mai'];
const messages = [
  'Chúc hai bạn một đời bình yên bên nhau. Mong rằng mỗi ngày đều là một ngày thật đáng nhớ!',
  'Nhất định mình sẽ đến! Thật vui khi được cùng bạn lưu lại khoảnh khắc đặc biệt này.',
  'Tiếc là mình không thể có mặt. Gửi bạn thật nhiều yêu thương và những lời chúc tốt đẹp nhất.',
  'Mong ngày gặp lại, cùng nhau chụp một tấm hình và kể những câu chuyện thật vui.',
  'Chúc hành trình mới của bạn luôn ngập tràn tiếng cười, hạnh phúc và những điều dịu dàng.',
  'Cảm ơn vì đã để mình trở thành một phần trong ngày đặc biệt của bạn. Hẹn gặp nhé!',
];
let mode = 'normal';
let requests = 0;
const errors = [];
const items = names.map((name, i) => ({ id: String(i), guestName: name, guestEmail: `guest${i}@example.com`, status: i === 2 ? 'declined' : 'accepted', guestMessage: messages[i], respondedAt: '2026-09-26T09:17:00.000Z' }));
const extra = [{ ...items[0], id: '6', guestName: 'Khách chưa phản hồi', status: 'pending', guestMessage: null, respondedAt: null }, { ...items[1], id: '7', guestName: 'Khách không để lời nhắn', guestMessage: '  ' }];
const context = await browser.newContext({ viewport: { width: 1586, height: 1010 } });
async function setup(ctx) {
  await ctx.route('**/fonts/**', async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ body: await readFile(`public${path}`), contentType: 'font/woff2' });
  });
  await ctx.route('**/api/host/invitations?*', async route => {
    requests++;
    if (mode === 'error') return route.fulfill({ status: 500, json: { message: 'Không thể cập nhật phản hồi.' } });
    const url = new URL(route.request().url());
    let list = mode === 'empty' ? [] : [...items, ...extra];
    if (mode === 'long') list = [{ ...items[0], guestName: 'Nguyễn Hoàng Minh Anh và gia đình thương mến', guestEmail: 'verylongemailaddresswithoutspaces'.repeat(4) + '@example.com', guestMessage: messages.join('\n\n') + '\n' + 'LờiChúc'.repeat(60) }];
    const totals = { total: list.length, accepted: list.filter(x => x.status === 'accepted').length, declined: list.filter(x => x.status === 'declined').length, pending: list.filter(x => x.status === 'pending').length };
    if (url.searchParams.has('status')) list = list.filter(x => x.status === url.searchParams.get('status'));
    if (url.searchParams.has('query')) list = list.filter(x => (x.guestName + x.guestEmail).toLowerCase().includes(url.searchParams.get('query').toLowerCase()));
    const page = Math.min(Number(url.searchParams.get('page') || 1), Math.max(1, Math.ceil(list.length / 6)));
    await route.fulfill({ json: { items: list.slice((page - 1) * 6, page * 6), totals, filteredTotal: list.length, page, pageSize: 6 } });
  });
}
await setup(context);
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
async function settled() { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); }
async function load() {
  await page.goto(baseUrl);
  await page.locator('.response-guestbook').waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
}
try {
  if (server) {
    for (let attempt = 0; attempt < 120 && !serverLog.includes('FIXTURE_READY'); attempt++) {
      if (server.exitCode !== null) throw new Error(`Fixture server failed: ${serverLog}`);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(serverLog.includes('FIXTURE_READY'), `Fixture server did not start: ${serverLog}`);
  }
  await load();
  await page.getByRole('article').first().waitFor();
  await settled();
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  assert.equal(await page.getByRole('article').count(), 6);
  const paper = page.getByRole('article').nth(1);
  const before = await paper.boundingBox();
  await paper.hover(); await settled();
  const hover = await paper.boundingBox();
  assert.ok(Math.abs(hover.y - before.y + 4) < .5, 'hover lifts exactly 4px');
  await page.screenshot({ path: `${out}/desktop-hover.png`, fullPage: true });
  await paper.screenshot({ path: `${out}/paper-detail.png` });
  await page.mouse.down(); await settled();
  assert.equal(await paper.getAttribute('data-pressed'), 'true');
  assert.ok((await paper.boundingBox()).width < before.width, 'press shrinks slightly');
  await page.mouse.up(); await page.mouse.move(5, 5); await settled();
  assert.equal(await paper.getAttribute('data-pressed'), null);
  assert.ok(Math.abs((await paper.boundingBox()).y - before.y) < .5);
  console.log('PASS desktop hover, press and release');

  const tabs = page.getByRole('group', { name: 'Lọc theo phản hồi' });
  await tabs.getByRole('button', { name: /^Không tham dự/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 1);
  assert.match(await page.getByRole('article').innerText(), /Thảo Nguyên/);
  assert.equal(await tabs.getByRole('button', { name: /^Không tham dự/ }).getAttribute('aria-pressed'), 'true');
  await tabs.getByRole('button', { name: /^Tất cả/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 6);
  await page.getByRole('searchbox').fill('Hoàng Nam');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 1);
  assert.match(await page.getByRole('article').innerText(), /Hoàng Nam/);
  const count = requests;
  await page.getByRole('button', { name: 'Làm mới dữ liệu' }).click();
  await page.waitForTimeout(300);
  assert.ok(requests > count, 'refresh issues another request');
  await page.getByRole('searchbox').fill('nobody-exists');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.getByText('Không tìm thấy lời nhắn phù hợp').waitFor();
  await page.getByRole('button', { name: 'Xem toàn bộ sổ lưu bút' }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 6);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.pagination-current-page')?.textContent.trim() === '2 / 2', null, { timeout: 5000 });
  assert.equal(await page.getByRole('article').count(), 2);
  assert.match(await page.getByRole('article').last().innerText(), /Khách chưa để lại lời nhắn/);
  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 6);
  console.log('PASS filters, search, reset, refresh, pagination, missing-message fallback');

  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height }); await settled();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
    await page.screenshot({ path: `${out}/width-${width}.png`, fullPage: true });
  }
  mode = 'long'; await page.getByRole('button', { name: 'Làm mới dữ liệu' }).click();
  await page.getByText('Nguyễn Hoàng Minh Anh và gia đình thương mến', { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const contained = await page.getByRole('article').evaluate(el => {
    const b = el.getBoundingClientRect();
    return [...el.querySelectorAll('p,h3,time,.wish-guest-email')].every(child => { const c = child.getBoundingClientRect(); return c.left >= b.left && c.right <= b.right && c.bottom <= b.bottom; });
  });
  assert.ok(contained, 'long names and messages stay inside the paper');
  await page.screenshot({ path: `${out}/long-mobile.png`, fullPage: true });
  console.log('PASS responsive sizes and long content');

  mode = 'error'; await page.getByRole('button', { name: 'Làm mới dữ liệu' }).click();
  await page.locator('.response-guestbook [role="alert"]').waitFor(); assert.equal(await page.getByRole('article').count(), 1);
  await load(); await page.getByRole('button', { name: 'Thử lại' }).waitFor();
  mode = 'empty'; await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByText('Sổ lưu bút đang mở', { exact: true }).waitFor();
  mode = 'normal'; await page.getByRole('button', { name: 'Làm mới dữ liệu' }).click();
  await page.getByRole('article').first().waitFor();
  console.log('PASS stale, initial error, retry and empty states');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('article').first().hover();
  assert.equal(await page.getByRole('article').first().evaluate(el => getComputedStyle(el).transform), 'none');
  console.log('PASS reduced motion');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await setup(touchContext);
  const touch = await touchContext.newPage();
  touch.on('pageerror', e => errors.push(e.message));
  await touch.goto(baseUrl); await touch.getByRole('article').first().waitFor();
  const touchPaper = touch.getByRole('article').first(); await touchPaper.scrollIntoViewIfNeeded();
  const box = await touchPaper.boundingBox();
  const cdp = await touchContext.newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 40, y: box.y + 70 }] });
  await touch.waitForTimeout(250);
  assert.equal(await touchPaper.getAttribute('data-pressed'), 'true');
  await touch.screenshot({ path: `${out}/touch-pressed.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.waitForTimeout(250);
  assert.equal(await touchPaper.getAttribute('data-pressed'), null);
  assert.equal(await touchPaper.evaluate(el => getComputedStyle(el).transform), 'none', 'no sticky hover on touch');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 40, y: box.y + 70 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await touchPaper.getAttribute('data-pressed'), null);
  await touchContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS touch press/release/cancel without sticky hover; no browser errors');
} finally {
  await browser.close();
  if (server?.pid) {
    server.kill('SIGTERM');
  }
}
