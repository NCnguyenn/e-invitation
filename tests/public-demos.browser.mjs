// Run against next start or production. This suite uses anonymous sample pages only.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const base = process.env.TEST_BASE_URL || 'http://localhost:3210';
const output = 'test-results/public-demos';
await mkdir(output, { recursive: true });

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation =>
    animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
}

try {
  for (const [key, title, editorial] of [
    ['graduation-floral-01', 'Mẫu 1 · Tốt nghiệp Floral', false],
    ['graduation-editorial-01', 'Mẫu 2 · Thanh xuân sang trang', true],
  ]) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const apiRequests = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const isAsset = url => /\.(js|css|woff2?|webp|png|jpe?g)(\?|$)/.test(url);
      page.on('requestfailed', request => {
        const errorText = request.failure()?.errorText;
        if (isAsset(request.url()) && errorText !== 'net::ERR_ABORTED') {
          errors.push(`Asset failed: ${request.url()} (${errorText})`);
        }
      });
      page.on('response', response => {
        if (response.status() >= 400 && isAsset(response.url())) errors.push(`Asset HTTP ${response.status()}: ${response.url()}`);
      });
      if (process.env.TEST_NETLIFY_ATTRIBUTION === '1') {
        // Reproduce the exact extra text node observed in Netlify's HTML response.
        await page.route(`${base}/demo/**`, async route => {
          const response = await route.fetch();
          const body = (await response.text()).replace(/(<meta charset="utf-8"\s*\/?\s*>)/i,
            '$1\n<!-- This site is hosted on Netlify. Anyone can build and deploy a site like this one for free: https://netlify.new/ -->');
          await route.fulfill({ response, body });
        });
      }
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
      });
      const query = width === 1440 ? '?template=graduation-private-client&guestName=PRIVATE_QUERY_GUEST&token=invalid' : '';
      const response = await page.goto(`${base}/demo/${key}${query}`);
      assert.equal(response.status(), 200, `Anonymous ${key} is available`);
      assert.equal(await page.title(), title);
      assert.match(response.headers()['x-robots-tag'] || '', /noindex/);
      assert.equal(response.headers()['referrer-policy'], 'no-referrer');
      assert.equal(response.headers()['set-cookie'], undefined, 'Demo does not create an authenticated session');
      await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
      await page.locator('[data-stage="opened"]').waitFor();
      await page.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
      await page.locator('.invitation-template').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.invitation-template img:not([loading="lazy"])').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await settled(page);
      assert.equal(await page.locator('.graduation-editorial-template').count(), Number(editorial));
      if (!editorial) assert.equal(await page.locator('.hero-badge-title').textContent(), 'GRADUATION');
      assert.equal(await page.getByText('PRIVATE_QUERY_GUEST').count(), 0, 'Query parameters cannot substitute demo data');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.screenshot({ path: `${output}/${key}-${width}.png` });

      const photo = page.getByRole('button', { name: 'Xem ảnh 1', exact: true });
      await photo.scrollIntoViewIfNeeded();
      await photo.locator('img').evaluate(image => image.decode());
      await settled(page);
      await photo.click();
      await page.getByRole('dialog', { name: 'Album kỷ niệm' }).waitFor();
      await page.keyboard.press('Escape');

      for (const choice of ['Tôi sẽ tham gia', 'Tôi không thể tham gia']) {
        await page.getByRole('radio', { name: choice, exact: true }).check();
        await page.getByRole('textbox', { name: 'Ghi chú / lời nhắn' }).fill('Lời chúc thử của khách xem mẫu.');
        await page.getByRole('button', { name: 'Gửi xác nhận (Xem trước)', exact: true }).click();
        await page.getByTestId('rsvp-receipt').waitFor();
        assert.match(await page.getByTestId('rsvp-receipt').textContent(), /Lời chúc thử của khách xem mẫu/);
        assert.match(await page.locator('.preview-receipt-footer').textContent(), /không lưu vào hệ thống/);
        await page.getByRole('button', { name: /Thử lại phản hồi khác/ }).click();
      }
      assert.deepEqual(apiRequests, [], 'Samples never call host, guest or RSVP APIs');
      assert.deepEqual(errors, [], 'No runtime errors in the sample');
      await page.close();
      console.log(`PASS ${key} at ${width}px: anonymous access, template, gallery and simulated responses without API calls`);
    }
  }

  const context = await browser.newContext();
  for (const path of ['/demo/not-a-template', '/demo/wedding-floral-01', '/demo/graduation-private-client', '/preview?template=graduation-editorial-01', '/preview?template=wedding-floral-01']) {
    const response = await context.request.get(base + path);
    assert.equal(response.status(), 404, `Unapproved or private path remains unavailable: ${path}`);
  }
  await context.close();
  console.log('PASS public allowlist and private preview isolation');
} finally {
  await browser.close();
}
