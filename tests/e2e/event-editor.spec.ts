import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';
let fx: AuthorizationFixtures;
test.beforeAll(async () => { fx = await setupAuthorizationFixtures(); });
test.setTimeout(90000);
async function login(page: Page, host = fx.hostA) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(host.email);
  await page.getByLabel('Mật khẩu').fill(host.password);
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
}
test('saves real event information, previews dates and persists across sessions', async ({ page, browser }) => {
  await login(page);
  const title = `Ngày đặc biệt ${Date.now()}`;
  await page.getByLabel('Tiêu đề sự kiện').fill(title);
  await page.getByLabel('Ngày tổ chức', { exact: true }).fill('2027-01-02');
  await page.getByLabel('Giờ bắt đầu').fill('00:15');
  await page.getByLabel('Địa điểm', { exact: true }).fill('Hội trường kỷ niệm');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('207 Giải Phóng, Hà Nội');
  await page.getByLabel('Liên kết Google Maps').fill('https://www.google.com/maps/place/Hanoi');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  const preview = page.getByTestId('host-preview');
  await expect(preview.locator('.event-title')).toHaveText(title);
  await expect(preview.locator('.calendar-header')).toHaveText('THÁNG 1 - 2027');
  await expect(preview.locator('.event-datetime-header')).toContainText('00:15');
  await expect(preview.getByRole('button', { name: 'Gửi xác nhận' })).toBeDisabled();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu thay đổi');
  await page.reload();
  await expect(page.getByLabel('Tiêu đề sự kiện')).toHaveValue(title);
  const context = await browser.newContext();
  try {
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:3100/login');
    await second.getByLabel('Email').fill(fx.hostA.email);
    await second.getByLabel('Mật khẩu').fill(fx.hostA.password);
    const loginResponse = second.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
    await second.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    expect((await loginResponse).status()).toBe(200);
    await expect(second.getByLabel('Tiêu đề sự kiện')).toHaveValue(title);
  } finally { await context.close(); }
  await expect.poll(async () => {
    const result = await fx.hostA.client.from('events').select('event_date').eq('id', fx.hostA.eventId).single();
    return Date.parse(result.data?.event_date ?? '');
  }).toBe(Date.parse('2027-01-01T17:15:00Z'));
  await page.screenshot({ path: `test-results/event-editor-${test.info().project.name}.png`, fullPage: true });
});
test('rejects invalid input and keeps edited fields when saving fails', async ({ page }) => {
  await login(page);
  await page.getByLabel('Tiêu đề sự kiện').fill('Thông tin chưa lưu');
  await page.getByLabel('Liên kết Google Maps').fill('https://google.com.evil.example/maps');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.locator('.editor-error[role=alert]')).toContainText('Google Maps');
  await page.getByLabel('Liên kết Google Maps').fill('');
  // Only this error UX case intercepts the request. Persistence tests use real DB.
  await page.route('**/api/host/event', route => route.abort());
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.locator('.editor-error[role=alert]')).toContainText('kết nối');
  await expect(page.getByLabel('Tiêu đề sự kiện')).toHaveValue('Thông tin chưa lưu');
});
test('uses the session owner for API and preview, rejects ownership input and anonymous access', async ({ page, request }) => {
  expect((await request.get('/api/host/event')).status()).toBe(401);
  await login(page, fx.hostB);
  await page.goto(`/dashboard?eventId=${fx.hostA.eventId}`);
  await expect(page.getByLabel('Tiêu đề sự kiện')).toHaveValue('MVP Step2 Event B');
  await expect(page.getByTestId('host-preview').locator('.event-title')).toHaveText('MVP Step2 Event B');
  const own = await page.request.get(`/api/host/event?eventId=${fx.hostA.eventId}`);
  expect((await own.json()).event.id).toBe(fx.hostB.eventId);
  expect(own.headers()['cache-control']).toContain('no-store');
  const input = { title: 'Not allowed', eventDate: '2027-01-01T00:00:00Z', venueName: null, venueAddress: null, googleMapUrl: null };
  const invalid = await page.request.patch('/api/host/event', { headers: { origin: 'http://127.0.0.1:3100' }, data: { ...input, eventId: fx.hostA.eventId } });
  expect(invalid.status()).toBe(422);
  const crossOrigin = await page.request.patch('/api/host/event', { headers: { origin: 'https://evil.example' }, data: input });
  expect(crossOrigin.status()).toBe(403);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
