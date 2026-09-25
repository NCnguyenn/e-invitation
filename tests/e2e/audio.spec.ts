import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';

let fx: AuthorizationFixtures;
test.beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
});
test.setTimeout(120_000);

async function login(page: Page, host = fx.hostA) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(host.email);
  await page.getByLabel('Mật khẩu').fill(host.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function guestEmail() {
  return `e2e-audio-${randomBytes(4).toString('hex')}@example.com`;
}

test('audio network isolation: no initial audio requests or signed URLs in HTML before user interaction', async ({
  browser,
  request,
}) => {
  // Ensure host event has music set
  const expectedPath = `${fx.hostA.id}/${fx.hostA.eventId}/music.mp3`;
  await fx.admin.from('events').update({ music_path: expectedPath }).eq('id', fx.hostA.eventId!);

  // Create an invitation
  const token = randomBytes(32).toString('hex');
  const { data: inv } = await fx.admin
    .from('invitations')
    .insert({
      event_id: fx.hostA.eventId!,
      guest_name: 'Khach Kiem Tra Mang',
      guest_email: guestEmail(),
      token,
      status: 'pending',
    })
    .select('id')
    .single();

  const inviteUrl = `/invite/${token}`;

  // 1. Check SSR HTML directly: must NOT contain signed URL or mp3 src
  const initialHtmlResponse = await request.get(inviteUrl);
  expect(initialHtmlResponse.status()).toBe(200);
  const html = await initialHtmlResponse.text();
  expect(html).not.toContain('.mp3');
  expect(html).not.toContain('token=');
  expect(html).not.toContain('/api/guest/');

  // 2. Open page in browser and record all network traffic before interaction
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkUrls: string[] = [];
  page.on('request', (req) => networkUrls.push(req.url()));

  await page.goto(inviteUrl);
  await expect(page.locator('.guest-name')).toHaveText('Khach Kiem Tra Mang');

  // Verify <audio> tag has preload="none" and NO src attribute
  const audioTag = page.locator('audio');
  await expect(audioTag).toHaveAttribute('preload', 'none');
  const initialSrc = await audioTag.getAttribute('src');
  expect(initialSrc).toBeNull();

  // Verify NO audio requests were made on initial page load
  const audioRequestsBeforeClick = networkUrls.filter(
    (url) => url.includes('/audio') || url.includes('.mp3'),
  );
  expect(audioRequestsBeforeClick).toHaveLength(0);

  // 3. Click the play button -> now an audio URL request is made
  const playButton = page.locator('.float-btn');
  await expect(playButton).toBeVisible();
  await playButton.click();

  // Wait for the audio API request to be made
  await page.waitForResponse((res) => res.url().includes(`/api/guest/${token}/audio`));

  // Audio tag should now receive a signed URL
  await expect(async () => {
    const src = await audioTag.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain('token=');
  }).toPass({ timeout: 5000 });

  // Cleanup
  await fx.admin.from('invitations').delete().eq('id', inv!.id);
  await context.close();
});

test('host uploads MP3 directly to storage, finalizes, previews, and reloads with persistent state', async ({
  page,
  browser,
}) => {
  await login(page);

  // Reset music_path on host event to test initial upload
  await fx.admin.from('events').update({ music_path: null }).eq('id', fx.hostA.eventId!);
  await page.reload();

  // Verify initial state shows "Chưa có nhạc nền"
  const musicSection = page.locator('.music-uploader-card');
  await expect(musicSection).toBeVisible();
  await expect(musicSection.locator('.badge')).toHaveText('Chưa có nhạc nền');

  // Track upload network request to prove direct upload to Storage (not via Next.js server route)
  let storageDirectUploadObserved = false;
  page.on('request', (req) => {
    if (req.url().includes('/storage/v1/object/audio/') && req.method() === 'POST') {
      storageDirectUploadObserved = true;
    }
  });

  // Select file
  const fileInput = musicSection.locator('#music-file-input');
  await fileInput.setInputFiles('music.mp3');

  // Click "Tải lên"
  const uploadButton = musicSection.getByRole('button', { name: 'Tải lên' });
  await uploadButton.click();

  // Wait for success status
  await expect(musicSection.getByRole('status')).toContainText('lưu nhạc thành công', {
    timeout: 15000,
  });
  expect(storageDirectUploadObserved).toBe(true);

  // Badge should now show "Đã có nhạc nền"
  await expect(musicSection.locator('.badge')).toHaveText('Đã có nhạc nền');

  // "Nghe thử" button should be visible
  const previewBtn = musicSection.getByRole('button', { name: /Nghe thử/ });
  await expect(previewBtn).toBeVisible();
  await previewBtn.click();

  // Reload page to verify persistence
  await page.reload();
  await expect(page.locator('.music-uploader-card .badge')).toHaveText('Đã có nhạc nền');

  // Create a guest invitation to verify guest can open and play
  const token = randomBytes(32).toString('hex');
  const { data: inv } = await fx.admin
    .from('invitations')
    .insert({
      event_id: fx.hostA.eventId!,
      guest_name: 'Khach Thu Nhac',
      guest_email: guestEmail(),
      token,
      status: 'pending',
    })
    .select('id')
    .single();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/invite/${token}`);

  const guestPlayBtn = guestPage.locator('.float-btn');
  await expect(guestPlayBtn).toBeVisible();
  await guestPlayBtn.click();

  await expect(async () => {
    const src = await guestPage.locator('audio').getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain('token=');
  }).toPass({ timeout: 5000 });

  // Cleanup
  await fx.admin.from('invitations').delete().eq('id', inv!.id);
  await guestContext.close();
});

test('guest can RSVP normally even if event has no music or audio encounters errors', async ({
  page,
}) => {
  // Ensure host event has no music
  await fx.admin.from('events').update({ music_path: null }).eq('id', fx.hostA.eventId!);

  const token = randomBytes(32).toString('hex');
  const { data: inv } = await fx.admin
    .from('invitations')
    .insert({
      event_id: fx.hostA.eventId!,
      guest_name: 'Khach Khong Co Nhac',
      guest_email: guestEmail(),
      token,
      status: 'pending',
    })
    .select('id')
    .single();

  await page.goto(`/invite/${token}`);

  // Float button is disabled because there is no music
  const playButton = page.locator('.float-btn');
  await expect(playButton).toBeDisabled();

  // Guest can still submit RSVP without any issues
  await page.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
  await page.getByLabel('Ghi chú / lời nhắn').fill('Chắc chắn đến!');
  await page.getByRole('button', { name: 'Gửi xác nhận' }).click();

  // Thank-you message appears
  const receipt = page.getByTestId('rsvp-receipt');
  await expect(receipt).toContainText('Cảm ơn bạn đã phản hồi');
  await expect(receipt).toContainText('Đã xác nhận tham gia');

  // Cleanup
  await fx.admin.from('invitations').delete().eq('id', inv!.id);
});
