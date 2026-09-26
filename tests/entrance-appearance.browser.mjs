// node tests/entrance-appearance.browser.mjs (against next dev).
// PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE may select an existing local browser runtime.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const page = await browser.newPage();
const output = 'test-results/entrance-appearance';
await mkdir(output, { recursive: true });
const failures = [];
page.on('pageerror', error => failures.push(error.message));

try {
  for (const [width, height] of [[1440, 1000], [1920, 1080], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${process.env.TEST_BASE_URL || 'http://localhost:3000'}/preview?guestName=${encodeURIComponent('Nguyễn Minh Anh')}`);
    await page.locator('[data-stage="closed"]').waitFor();
    await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('article p').nth(1).evaluate(el => {
      el.textContent = 'Cảm ơn bạn đã đồng hành cùng mình. Sự hiện diện của bạn sẽ khiến ngày này trở nên thật đáng nhớ.';
    });
    const button = page.getByRole('button', { name: 'Mở thư', exact: true });
    const before = await button.boundingBox();
    await page.screenshot({ path: `${output}/closed-${width}.png`, fullPage: true });
    await button.click();
    await page.locator('[data-stage="opened"]').waitFor();
    await page.screenshot({ path: `${output}/opened-${width}.png`, fullPage: true });
    const geometry = await page.getByRole('article').evaluate(letter => {
      const box = letter.getBoundingClientRect();
      const samples = [...letter.querySelectorAll('h2, p')].map(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const visible = [...range.getClientRects()].every(rect =>
          [rect.left + 2, rect.left + rect.width / 2, rect.right - 2].every(x => {
            const hit = document.elementFromPoint(x, rect.top + rect.height / 2);
            return !!hit && letter.contains(hit) && rect.bottom <= box.bottom;
          }));
        return { text: el.textContent, visible };
      });
      return { samples, width: document.documentElement.scrollWidth,
        aboveHeader: box.top < document.querySelector('[data-stage] header').getBoundingClientRect().bottom };
    });
    console.log(width, JSON.stringify(geometry));
    assert.ok(geometry.samples.every(sample => sample.visible), `Letter text is covered by the envelope at ${width}px`);
    assert.ok(!geometry.aboveHeader, `Letter overlaps heading at ${width}px`);
    assert.ok(geometry.width <= width, `Horizontal overflow at ${width}px`);
    const after = await page.getByRole('button', { name: 'Xem thư mời', exact: true }).boundingBox();
    assert.ok(Math.abs(before.y - after.y) < 2, 'Opening the envelope must not jump the button');
  }
  assert.deepEqual(failures, []);
  console.log('PASS: visible letter content, responsive sizes and stable button placement');
} finally {
  await browser.close();
}
