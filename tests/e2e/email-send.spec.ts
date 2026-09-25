import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';

let fx: AuthorizationFixtures;
test.beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
});
test.setTimeout(180_000);

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(fx.hostA.email);
  await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('host send shows Brevo acceptance, double-submit stays one attempt, and resend keeps the link', async ({ page, browser }) => {
  await login(page);
  await page.getByRole('link', { name: 'Khách mời' }).click();
  const email = `send-${randomBytes(3).toString('hex')}@example.com`;
  await page.getByLabel('Tên khách').fill('Mai Lan');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lời mời riêng').fill('Mong gặp bạn');
  await page.locator('form').getByRole('button', { name: 'Gửi lời mời', exact: true }).click();
  await expect(page.locator('form .editor-feedback').getByRole('status')).toContainText('Brevo đã tiếp nhận', { timeout: 20_000 });
  const link = await page.getByTestId('invite-link').inputValue();
  const token = link.split('/').pop()!;
  const created = await fx.admin.from('invitations').select('id, token, status').eq('token', token).single();
  expect(created.data?.token).toBe(token);

  const stored = await fx.admin.from('email_send_attempts').select('request_id').eq('invitation_id', created.data?.id);
  expect(stored.data).toHaveLength(1);
  const sameRequestId = stored.data?.[0]?.request_id;
  const replay = await Promise.all([
    page.request.post(`/api/host/invitations/${created.data?.id}/send`, {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: { requestId: sameRequestId },
    }),
    page.request.post(`/api/host/invitations/${created.data?.id}/send`, {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: { requestId: sameRequestId },
    }),
  ]);
  expect(replay.map((item) => item.status()).sort()).toEqual([200, 200]);
  const freshRequestId = randomUUID();
  const cooled = await Promise.all([
    page.request.post(`/api/host/invitations/${created.data?.id}/send`, {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: { requestId: freshRequestId },
    }),
    page.request.post(`/api/host/invitations/${created.data?.id}/send`, {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: { requestId: freshRequestId },
    }),
  ]);
  expect(cooled.map((item) => item.status()).sort()).toEqual([429, 429]);
  const rows = await fx.admin.from('email_send_attempts').select('id').eq('invitation_id', created.data?.id);
  expect(rows.data).toHaveLength(1);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(link);
  await guest.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
  await guest.getByLabel('Ghi chú / lời nhắn').fill('Giữ nguyên phản hồi');
  await guest.getByRole('button', { name: 'Gửi xác nhận' }).click();
  await expect(guest.getByTestId('rsvp-receipt')).toContainText('Đã xác nhận tham gia');

  await fx.admin.from('invitations').update({
    last_send_attempt_at: new Date(Date.now() - 120_000).toISOString(),
  }).eq('id', created.data?.id);
  await page.getByLabel('Tìm kiếm trong danh sách khách').fill(email);
  await page.locator('.table-controls').getByRole('button', { name: 'Tìm' }).click();
  const row = page.getByTestId(`guest-row-${created.data?.id}`);
  await expect(row).toContainText('Brevo đã tiếp nhận');
  const resend = row.getByRole('button', { name: /Gửi lại/ });
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect.poll(async () => {
    const again = await fx.admin.from('email_send_attempts').select('id').eq('invitation_id', created.data?.id);
    return again.data?.length ?? 0;
  }).toBe(2);
  await expect(row).toContainText('Brevo đã tiếp nhận');
  const after = await fx.admin.from('invitations').select('token, status, guest_message').eq('id', created.data?.id).single();
  expect(after.data).toMatchObject({ token, status: 'accepted', guest_message: 'Giữ nguyên phản hồi' });
  await guest.reload();
  await expect(guest.getByTestId('rsvp-receipt')).toContainText('Giữ nguyên phản hồi');
  await expect(guest.getByRole('button', { name: 'Gửi xác nhận' })).toHaveCount(0);
  await guestContext.close();
  await page.screenshot({ path: `test-results/email-send-${test.info().project.name}.png`, fullPage: true });
});

test('timeout, rejection, unknown and cooldown are shown without claiming success', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Khách mời' }).click();

  async function send(prefix: string) {
    const email = `${prefix}-${randomBytes(3).toString('hex')}@example.com`;
    await page.getByLabel('Tên khách').fill(prefix);
    await page.getByLabel('Email').fill(email);
    await page.locator('form').getByRole('button', { name: 'Gửi lời mời', exact: true }).click();
    return email;
  }

  const feedback = page.locator('form .editor-feedback');
  await send('timeout');
  await expect(feedback.getByRole('alert')).toContainText('Chưa xác định kết quả', { timeout: 20_000 });
  const rejectedEmail = await send('reject');
  await expect(feedback.getByRole('status')).toContainText('từ chối', { timeout: 20_000 });
  await send('unknown');
  await expect(feedback.getByRole('alert')).toContainText('Chưa xác định kết quả, cần kiểm tra trước khi gửi lại', { timeout: 20_000 });

  await page.getByLabel('Tìm kiếm trong danh sách khách').fill(rejectedEmail);
  await page.locator('.table-controls').getByRole('button', { name: 'Tìm' }).click();
  const row = page.locator('tbody tr').filter({ hasText: rejectedEmail });
  await expect(row).toContainText('Gửi thất bại');
  const sendAgain = row.getByRole('button', { name: /Gửi lại|Chờ/ });
  await expect(sendAgain).toBeVisible();
  if ((await sendAgain.innerText()).includes('Gửi lại')) await sendAgain.click();
  await expect(row).toContainText('Cần chờ');
  await expect(row.getByRole('button', { name: /Chờ/ })).toBeDisabled();
});
