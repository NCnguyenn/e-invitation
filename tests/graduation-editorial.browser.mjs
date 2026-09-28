// Run against next dev. PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE can select an installed runtime.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const output = 'test-results/graduation-editorial';
await mkdir(output, { recursive: true });
const failures = [];
const writes = [];

async function enter(page, key = 'graduation-editorial-01') {
  page.on('pageerror', error => failures.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && /\/rsvp/.test(request.url())) writes.push(request.url());
  });
  await page.goto(`${base}/preview?template=${key}`);
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.locator('[data-stage="opened"]').waitFor();
  await page.getByRole('button', { name: 'Xem thư mời', exact: true }).click();
  await page.locator('[aria-label="Nội dung thư mời"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
}

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation =>
    animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
}

try {
  for (const width of [390, 320, 430, 620, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await enter(page);
    await settled(page);
    const layout = await page.locator('.editorial-hero').evaluate(hero => {
      const heading = hero.querySelector('h1').getBoundingClientRect();
      const letters = [...hero.querySelectorAll('h1 span')].map(node => node.getBoundingClientRect());
      const year = hero.querySelector('.editorial-hero-year').getBoundingClientRect();
      const image = hero.querySelector('.editorial-hero-portrait img');
      const photo = image.getBoundingClientRect();
      const imageStyle = getComputedStyle(image);
      const scale = imageStyle.objectFit === 'contain'
        ? Math.min(photo.width / image.naturalWidth, photo.height / image.naturalHeight)
        : Math.max(photo.width / image.naturalWidth, photo.height / image.naturalHeight);
      const alignment = parseFloat(imageStyle.objectPosition.split(' ')[1]) / 100;
      const portraitTop = photo.top + Math.max(0, photo.height - image.naturalHeight * scale) * alignment;
      const bounds = hero.getBoundingClientRect();
      return {
        besideHeading: portraitTop <= heading.top + heading.height / 3 && photo.bottom > heading.top
          && photo.left + photo.width / 2 > heading.left + heading.width / 2,
        textOverlap: letters.some(rect => rect.right > year.left && rect.left < year.right
          && rect.bottom > year.top && rect.top < year.bottom),
        textClipped: [...letters, year].some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(layout.besideHeading, true, `Portrait must stay beside the title at ${width}px`);
    assert.equal(layout.textOverlap, false, `The title must not overlap the year at ${width}px`);
    assert.equal(layout.textClipped, false, `Hero text must stay inside the page at ${width}px`);
    assert.equal(layout.overflow, false, `Horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${output}/hero-${width}.png` });

    await page.getByRole('link', { name: /Mở câu chuyện/ }).click();
    await page.waitForFunction(() => document.activeElement?.matches('[data-editorial-chapter]'));
    const memories = page.locator('.editorial-memory-section');
    await memories.scrollIntoViewIfNeeded();
    await memories.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await settled(page);
    await memories.screenshot({ path: `${output}/memories-${width}.png` });
    await page.locator('.editorial-gallery-intro').scrollIntoViewIfNeeded();
    const photos = page.locator('.gallery-item img');
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await photo.evaluate(image => image.decode());
      assert.ok(await photo.evaluate(image => {
        const rect = image.getBoundingClientRect();
        return Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight) < .03;
      }), 'Gallery must preserve the full photograph, including faces');
    }
    const opener = page.getByRole('button', { name: 'Xem ảnh 1', exact: true });
    await opener.click();
    await page.getByRole('dialog', { name: 'Album kỷ niệm' }).waitFor();
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.photo-dialog figcaption').textContent(), /^2\//);
    await page.keyboard.press('Escape');
    assert.equal(await opener.evaluate(node => node === document.activeElement), true);

    const rsvp = page.locator('.editorial-rsvp-section');
    await rsvp.scrollIntoViewIfNeeded();
    const accept = rsvp.getByRole('radio', { name: 'Tôi sẽ tham gia', exact: true });
    const decline = rsvp.getByRole('radio', { name: 'Tôi không thể tham gia', exact: true });
    const submit = rsvp.getByRole('button', { name: 'Gửi xác nhận (Xem trước)', exact: true });
    assert.equal(await submit.isDisabled(), true);
    await accept.check();
    await accept.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await decline.isChecked(), true);
    await settled(page);
    const selectedColor = await decline.evaluate(node => getComputedStyle(node.closest('label')).backgroundColor);
    const otherColor = await accept.evaluate(node => getComputedStyle(node.closest('label')).backgroundColor);
    assert.notEqual(selectedColor, otherColor, 'Chosen response needs a visible state');
    for (const choice of await rsvp.locator('.radio-card').all()) assert.ok((await choice.boundingBox()).height >= 48);
    await rsvp.getByRole('textbox').fill('Chúc mừng Mai Hoa!');
    await submit.click();
    await rsvp.getByTestId('rsvp-receipt').waitFor();
    assert.match(await rsvp.textContent(), /Đã xác nhận không tham gia/);
    assert.match(await rsvp.textContent(), /Chúc mừng Mai Hoa!/);
    assert.match(await rsvp.textContent(), /không lưu vào hệ thống/);
    await rsvp.getByRole('button', { name: /Thử lại phản hồi khác/ }).click();
    await accept.check();
    await settled(page);
    await rsvp.screenshot({ path: `${output}/rsvp-${width}.png` });
    await submit.click();
    await rsvp.getByTestId('rsvp-receipt').waitFor();
    assert.match(await rsvp.textContent(), /Đã xác nhận tham gia/);

    // Scroll through the page normally and inspect the actual finished result.
    for (const section of await page.locator('[data-reveal]').all()) {
      await section.scrollIntoViewIfNeeded();
      await settled(page);
    }
    assert.equal(await page.locator('.editorial-container').evaluate(root =>
      [...root.querySelectorAll('section')].some(section => getComputedStyle(section).opacity === '0')), false);
    await page.screenshot({ path: `${output}/full-${width}.png`, fullPage: true });
    await page.close();
    console.log(`PASS ${width}px: portrait alignment, separate title/year, gallery, keyboard and both preview responses`);
  }

  const reduced = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  await enter(reduced);
  await reduced.locator('.editorial-rsvp-section').scrollIntoViewIfNeeded();
  await settled(reduced);
  assert.equal(await reduced.locator('.editorial-container').evaluate(root =>
    root.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')), false);
  assert.equal(await reduced.locator('.editorial-rsvp-section').evaluate(node => getComputedStyle(node).opacity), '1');
  await reduced.close();

  const legacy = await browser.newPage();
  await enter(legacy, 'wedding-floral-01');
  assert.equal(await legacy.locator('.graduation-editorial-template').count(), 0);
  assert.equal(await legacy.locator('.hero-badge-title').textContent(), 'GRADUATION');
  await legacy.close();
  assert.deepEqual(writes, [], 'Preview must never post a real RSVP');
  assert.deepEqual(failures, [], 'No browser errors');
  console.log('PASS: reduced motion, legacy template isolation and no preview writes');
} finally {
  await browser.close();
}
