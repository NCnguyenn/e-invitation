// Records the real browser animation and checks the order of its moving layers.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
const output = 'test-results/entrance-appearance';
await mkdir(output, { recursive: true });
const url = `${process.env.TEST_BASE_URL || 'http://localhost:3000'}/preview?guestName=${encodeURIComponent('Nguyễn Minh Anh')}`;

async function prepare() {
  await page.goto(url);
  await page.locator('[data-stage="closed"]').waitFor();
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('article p').nth(1).evaluate(el => {
    el.textContent = 'Cảm ơn bạn đã đồng hành cùng mình. Sự hiện diện của bạn sẽ khiến ngày này trở nên thật đáng nhớ.';
  });
}

try {
  await prepare();
  // Freeze CSS transitions on their own clocks to inspect intermediate frames.
  await page.getByRole('button', { name: 'Mở thư', exact: true }).click();
  await page.evaluate(() => {
    window.entranceAnimations = document.querySelector('[data-stage]').getAnimations({ subtree: true });
    window.entranceAnimations.forEach(animation => animation.pause());
  });
  const samples = [];
  for (const time of [0, 240, 420, 640, 900, 1260]) {
    const sample = await page.evaluate(async time => {
      window.entranceAnimations.forEach(animation => animation.currentTime = time);
      await new Promise(requestAnimationFrame);
      const part = name => document.querySelector(`[data-envelope-part="${name}"]`);
      return {
        time,
        paperY: new DOMMatrixReadOnly(getComputedStyle(part('paper')).transform).m42,
        flap: getComputedStyle(part('flap')).transform,
        sealOpacity: Number(getComputedStyle(part('seal')).opacity),
        buttonY: document.querySelector('[data-stage] button').getBoundingClientRect().y,
      };
    }, time);
    samples.push(sample);
    await page.screenshot({ path: `${output}/motion-${time}.png` });
  }
  assert.ok(samples[1].sealOpacity < .2, 'seal lifts away before the paper moves');
  assert.ok(samples[1].flap !== samples[0].flap, 'flap starts rotating first');
  assert.ok(Math.abs(samples[2].paperY - samples[0].paperY) < 1, 'paper waits until the lid clears it');
  assert.ok(samples[3].paperY < samples[2].paperY - 10, 'paper then slides out');
  assert.ok(Math.abs(samples.at(-1).paperY) < 1, 'paper settles at its final position');
  assert.ok(samples.every(sample => Math.abs(sample.buttonY - samples[0].buttonY) < 1), 'controls stay still throughout the animation');
  console.log('PASS: seal, flap and paper move in sequence; controls do not jump');

  // Chrome's native MediaRecorder encodes a local screencast; no external video
  // dependencies or guest data are needed. This records actual running frames.
  await prepare();
  const recorder = await browser.newPage();
  await recorder.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 1000;
    const stream = canvas.captureStream(0);
    const chunks = [];
    const media = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 3500000 });
    media.ondataavailable = event => chunks.push(event.data);
    window.capture = { canvas, stream, media, chunks };
    media.start();
  });
  const session = await page.context().newCDPSession(page);
  let frames = Promise.resolve();
  session.on('Page.screencastFrame', ({ data, sessionId }) => {
    void session.send('Page.screencastFrameAck', { sessionId });
    frames = frames.then(() => recorder.evaluate(async data => {
      const image = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob());
      window.capture.canvas.getContext('2d').drawImage(image, 0, 0, 900, 1000);
      image.close();
      window.capture.stream.getVideoTracks()[0].requestFrame();
    }, data));
  });
  await session.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 900, maxHeight: 1000, everyNthFrame: 1 });
  await page.waitForTimeout(450);
  const timing = await page.evaluate(async () => {
    const started = performance.now();
    const frames = [];
    document.querySelector('[data-stage] button').click();
    await new Promise(resolve => {
      function sample(now) {
        frames.push(now);
        if (document.querySelector('[data-stage="opened"]')) resolve();
        else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const gaps = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b);
    return { duration: Math.round(performance.now() - started), frames: frames.length, p95FrameMs: Math.round(gaps[Math.floor(gaps.length * .95)]), maxFrameMs: Math.round(gaps.at(-1)) };
  });
  assert.ok(timing.frames > 20, 'animation produces intermediate frames');
  assert.ok(timing.duration < 1800, 'animation finishes promptly');
  await page.waitForTimeout(850);
  await session.send('Page.stopScreencast');
  await frames;
  const video = await recorder.evaluate(async () => {
    const { media, chunks, stream } = window.capture;
    stream.getVideoTracks()[0].requestFrame();
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => { media.onstop = resolve; media.stop(); });
    stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
  });
  await writeFile(`${output}/envelope-opening.webm`, Buffer.from(video));
  console.log('Live motion:', JSON.stringify(timing));
  console.log(`Video: ${output}/envelope-opening.webm`);
} finally {
  await browser.close();
}
