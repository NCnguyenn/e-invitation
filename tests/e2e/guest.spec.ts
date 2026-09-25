import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';

let fx: AuthorizationFixtures;
test.beforeAll(async () => { fx = await setupAuthorizationFixtures(); });
test.setTimeout(120_000);

async function login(page: Page, host = fx.hostA) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(host.email);
  await page.getByLabel('Mật khẩu').fill(host.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function guestEmail() {
  return `e2e-${randomBytes(4).toString('hex')}@example.com`;
}

test('host creates a personal link and the guest can respond only once', async ({ page, browser, request }) => {
  await login(page);
  await page.getByRole('link', { name: 'Khách mời' }).click();
  await expect(page).toHaveURL(/section=guests/);
  const email = guestEmail();
  await page.getByLabel('Tên khách').fill('Lan Chi');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lời mời riêng').fill('Rất mong gặp bạn');
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();
  const status = page.getByRole('status');
  await expect(status).toContainText('Brevo đã tiếp nhận', { timeout: 20_000 });
  await expect(status).toContainText('không có nghĩa thư đã vào hộp thư');
  const link = await page.getByTestId('invite-link').inputValue();
  expect(link).toMatch(/\/invite\/[0-9a-f]{64}$/);
  const token = link.split('/').pop()!;
  await page.screenshot({ path: `test-results/host-guests-${test.info().project.name}.png`, fullPage: true });
  const before = await fx.admin.from('invitations').select('status, responded_at, guest_email').eq('token', token).single();
  expect(before.data).toMatchObject({ status: 'pending', responded_at: null, guest_email: email });

  const preview = await request.get(link, { headers: { 'user-agent': 'facebookexternalhit/1.1' } });
  expect(preview.status()).toBe(200);
  expect(preview.headers()['referrer-policy']).toBe('no-referrer');
  expect(preview.headers()['x-robots-tag']).toContain('noindex');
  expect(preview.headers()['cache-control']).toMatch(/no-store|no-cache/);
  expect(preview.headers()['cache-control']).not.toContain('public');
  const guestApi = await request.get(`/api/guest/${token}`);
  expect(guestApi.status()).toBe(200);
  expect(guestApi.headers()['cache-control']).toContain('no-store');
  expect(guestApi.headers()['referrer-policy']).toBe('no-referrer');
  expect(JSON.stringify(await guestApi.json())).not.toContain(email);
  const stillPending = await fx.admin.from('invitations').select('status, responded_at').eq('token', token).single();
  expect(stillPending.data).toMatchObject({ status: 'pending', responded_at: null });

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(link);
  await expect(guest.locator('.guest-name')).toHaveText('Lan Chi');
  await expect(guest.locator('.invitation-note')).toHaveText('Rất mong gặp bạn');
  await expect(guest).toHaveTitle(/.+/);
  expect(await guest.title()).not.toContain(token);
  const description = await guest.locator('meta[name="description"]').getAttribute('content');
  expect(description ?? '').not.toContain(token);
  expect(description ?? '').not.toContain('Rất mong gặp bạn');
  await expect(guest.getByRole('radio', { name: 'Tôi sẽ tham gia' })).not.toBeChecked();
  await expect(guest.getByLabel('Ghi chú / lời nhắn')).toHaveValue('');
  await guest.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
  await guest.getByLabel('Ghi chú / lời nhắn').fill('Tôi sẽ đến');
  await guest.screenshot({ path: `test-results/guest-${test.info().project.name}.png`, fullPage: true });
  await guest.getByRole('button', { name: 'Gửi xác nhận' }).click();
  const receipt = guest.getByTestId('rsvp-receipt');
  await expect(receipt).toContainText('Cảm ơn bạn đã phản hồi');
  await expect(receipt).toContainText('Đã xác nhận tham gia');
  await expect(receipt).toContainText('Tôi sẽ đến');
  await expect(guest.getByRole('button', { name: 'Gửi xác nhận' })).toHaveCount(0);
  await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await guest.screenshot({ path: `test-results/guest-${test.info().project.name}.png`, fullPage: true });
  await guestContext.close();

  const again = await browser.newContext();
  const second = await again.newPage();
  await second.goto(link);
  await expect(second.getByTestId('rsvp-receipt')).toContainText('Tôi sẽ đến');
  await expect(second.getByRole('button', { name: 'Gửi xác nhận' })).toHaveCount(0);
  const repeat = await second.request.post(`/api/guest/${token}/rsvp`, {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { decision: 'declined', guestMessage: 'Đổi ý' },
  });
  expect(repeat.status()).toBe(409);
  const body = await repeat.json();
  expect(body.kind).toBe('already_responded');
  expect(body.receipt.guestMessage).toBe('Tôi sẽ đến');
  expect(body.receipt.status).toBe('accepted');
  await again.close();
  await page.screenshot({ path: `test-results/host-guests-${test.info().project.name}.png`, fullPage: true });
});

test('keeps the form when the network fails before saving and recovers a lost saved response', async ({ page, browser }) => {
  await login(page);
  const email = guestEmail();
  const created = await page.request.post('/api/host/invitations', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { guestName: 'Minh An', guestEmail: email, invitationNote: null },
  });
  expect(created.status()).toBe(201);
  const { invitePath } = await created.json();
  const lostEmail = guestEmail();
  const lost = await page.request.post('/api/host/invitations', {
    headers: { origin: 'http://127.0.0.1:3100' },
    data: { guestName: 'Ha My', guestEmail: lostEmail, invitationNote: null },
  });
  expect(lost.status()).toBe(201);
  const lostPath = (await lost.json()).invitePath as string;

  const context = await browser.newContext();
  const guest = await context.newPage();
  let posts = 0;
  await guest.route('**/api/guest/*/rsvp', route => { posts += 1; return route.abort(); });
  await guest.goto(`http://127.0.0.1:3100${invitePath}`);
  await guest.getByRole('radio', { name: 'Tôi không thể tham gia' }).check();
  await guest.getByLabel('Ghi chú / lời nhắn').fill('Giữ lại ghi chú');
  await guest.getByRole('button', { name: 'Gửi xác nhận' }).click();
  await expect(guest.locator('.rsvp-error')).toContainText('Chưa lưu được phản hồi');
  await expect(guest.getByTestId('rsvp-receipt')).toHaveCount(0);
  await expect(guest.getByLabel('Ghi chú / lời nhắn')).toHaveValue('Giữ lại ghi chú');
  expect(posts).toBe(1);
  const token = invitePath.split('/').pop();
  const stored = await fx.admin.from('invitations').select('status').eq('token', token).single();
  expect(stored.data?.status).toBe('pending');

  const recovered = await context.newPage();
  await recovered.route('**/api/guest/*/rsvp', async route => { await route.fetch(); await route.abort(); });
  await recovered.goto(`http://127.0.0.1:3100${lostPath}`);
  await recovered.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
  await recovered.getByLabel('Ghi chú / lời nhắn').fill('Đã lưu dù mất phản hồi');
  await recovered.getByRole('button', { name: 'Gửi xác nhận' }).click();
  await expect(recovered.getByTestId('rsvp-receipt')).toContainText('Đã lưu dù mất phản hồi');
  await context.close();
});

test('host preview does not record an RSVP and a bad token is not found', async ({ page, request }) => {
  await login(page);
  let rsvpPosts = 0;
  page.on('request', req => { if (req.url().includes('/api/guest/') && req.url().endsWith('/rsvp')) rsvpPosts += 1; });
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByTestId('host-preview').getByRole('button', { name: 'Gửi xác nhận' })).toBeDisabled();
  expect(rsvpPosts).toBe(0);
  const missing = await request.get('/invite/not-a-token');
  expect(missing.status()).toBe(404);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
