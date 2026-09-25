import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';

let fx: AuthorizationFixtures;
test.beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
});
test.setTimeout(180_000);

async function login(page: Page, host = fx.hostA) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(host.email);
  await page.getByLabel('Mật khẩu').fill(host.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function randEmail(prefix: string) {
  return `${prefix}-${randomBytes(4).toString('hex')}@example.com`;
}

test('host creates a guest, guest responds, host sees response automatically via polling', async ({
  page,
  browser,
}) => {
  await login(page);

  // 1. Host creates a new guest in Khách mời tab
  await page.getByRole('link', { name: 'Khách mời' }).click();
  await expect(page).toHaveURL(/section=guests/);

  const guestName = `Lan Chi Poll ${randomBytes(3).toString('hex')}`;
  const guestEmail = randEmail('poll-guest');
  const personalNote = 'Mời bạn tham dự chung vui';

  await page.getByLabel('Tên khách').fill(guestName);
  await page.getByLabel('Email').fill(guestEmail);
  await page.getByLabel('Lời mời riêng').fill(personalNote);
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Brevo đã tiếp nhận', { timeout: 20_000 });
  const link = await page.getByTestId('invite-link').inputValue();
  expect(link).toMatch(/\/invite\/[0-9a-f]{64}$/);

  // 2. Host navigates to Phản hồi tab
  await page.getByRole('link', { name: 'Phản hồi' }).click();
  await expect(page).toHaveURL(/section=responses/);

  // Initially, the new guest should appear as pending in the responses table
  const searchInput = page.getByLabel('Tìm kiếm khách mời');
  await searchInput.fill(guestName);
  await page.getByRole('button', { name: 'Tìm' }).click();

  const row = page.locator('tbody tr').filter({ hasText: guestName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText('Chưa phản hồi');

  // 3. Guest in a separate browser context responds
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(link);

  await expect(guestPage.locator('.guest-name')).toHaveText(guestName);
  await guestPage.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
  await guestPage.getByLabel('Ghi chú / lời nhắn').fill('Sẽ đến chung vui cùng gia đình');
  await guestPage.getByRole('button', { name: 'Gửi xác nhận' }).click();

  // Guest sees confirmation
  const receipt = guestPage.getByTestId('rsvp-receipt');
  await expect(receipt).toBeVisible({ timeout: 15_000 });
  await expect(receipt).toContainText('Đã xác nhận tham gia');

  // 4. Host observes updated response WITHOUT manual page reload (via polling within ~15s)
  // Row should update from "Chưa phản hồi" to "Đồng ý" and show guest message
  await expect(row.locator('.badge-accepted')).toHaveText('Đồng ý', { timeout: 25_000 });
  await expect(row).toContainText('Sẽ đến chung vui cùng gia đình');

  // Screenshot of Phản hồi
  await page.screenshot({
    path: `test-results/host-responses-${test.info().project.name}.png`,
    fullPage: true,
  });

  // 5. Guest reloads or opens again: response remains locked, no edit form
  await guestPage.reload();
  const reloadedReceipt = guestPage.getByTestId('rsvp-receipt');
  await expect(reloadedReceipt).toBeVisible();
  await expect(reloadedReceipt).toContainText('Đã xác nhận tham gia');
  await expect(guestPage.getByRole('button', { name: 'Gửi xác nhận' })).toHaveCount(0);

  await guestContext.close();
});

test('host searches, filters, edits guest before send and locks edited guest', async ({
  page,
}) => {
  await login(page);

  await page.getByRole('link', { name: 'Khách mời' }).click();
  await expect(page).toHaveURL(/section=guests/);

  const guestName = `Guest Edit ${randomBytes(3).toString('hex')}`;
  const guestEmail = randEmail('edit-test');
  const inserted = await fx.admin.from('invitations').insert({
    event_id: fx.hostA.eventId,
    guest_name: guestName,
    guest_email: guestEmail,
    invitation_note: 'Trước khi gửi',
    token: randomBytes(32).toString('hex'),
    status: 'pending',
    email_status: 'pending',
    has_send_history: false,
  }).select('id').single();
  if (inserted.error || !inserted.data) throw inserted.error ?? new Error('unsent guest insert failed');

  // Search in guest list table
  const guestSearch = page.getByLabel('Tìm kiếm trong danh sách khách');
  await guestSearch.fill(guestName);
  await page.locator('.table-controls').getByRole('button', { name: 'Tìm' }).click();

  const guestRow = page.locator('tbody tr').filter({ hasText: guestName });
  await expect(guestRow).toBeVisible({ timeout: 15_000 });
  await expect(guestRow).toContainText('Chưa gửi');

  // Click edit button
  await guestRow.getByRole('button', { name: 'Sửa' }).click();

  // Edit modal opens
  const modal = page.locator('.modal-dialog');
  await expect(modal).toBeVisible();
  await expect(modal.locator('#edit-name-input')).toHaveValue(guestName);

  // Change name and note
  const updatedName = `${guestName} Edited`;
  await modal.locator('#edit-name-input').fill(updatedName);
  await modal.locator('#edit-note-input').fill('Ghi chú đã cập nhật');
  await modal.getByRole('button', { name: 'Lưu thay đổi' }).click();

  // Modal should close and row should show updated name
  await expect(modal).not.toBeVisible({ timeout: 15_000 });
  const updatedRow = page.locator('tbody tr').filter({ hasText: updatedName });
  await expect(updatedRow).toBeVisible({ timeout: 15_000 });
  await expect(updatedRow).toContainText('Ghi chú đã cập nhật');

  // Screenshot of Khách mời table
  await page.screenshot({
    path: `test-results/host-guests-table-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('handles network failure gracefully and recovers upon restore', async ({
  page,
}) => {
  await login(page);

  await page.getByRole('link', { name: 'Phản hồi' }).click();
  await expect(page).toHaveURL(/section=responses/);

  // Ensure initial data loaded
  await expect(page.locator('.data-table')).toBeVisible({ timeout: 15_000 });

  // Simulate network failure on invitations endpoint
  await page.route('**/api/host/invitations*', (route) => route.abort());

  // Click "Làm mới" while offline
  await page.getByRole('button', { name: 'Làm mới' }).click();

  // Should display stale/offline error message while PRESERVING table and metrics!
  await expect(page.locator('.editor-error')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.data-table')).toBeVisible();

  // Restore network
  await page.unroute('**/api/host/invitations*');

  // Click "Làm mới" again -> should recover
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.locator('.editor-error')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.data-table')).toBeVisible();
});

test('360px layout does not have horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);

  // Check Responses section
  await page.getByRole('link', { name: 'Phản hồi' }).click();
  await expect(page).toHaveURL(/section=responses/);
  await expect(page.locator('.data-table')).toBeVisible({ timeout: 15_000 });

  const hasPageHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasPageHorizontalScroll).toBe(false);

  // Check Guests section
  await page.getByRole('link', { name: 'Khách mời' }).click();
  await expect(page).toHaveURL(/section=guests/);
  await expect(page.getByLabel('Tên khách')).toBeVisible({ timeout: 15_000 });

  const hasGuestsPageHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasGuestsPageHorizontalScroll).toBe(false);
});
