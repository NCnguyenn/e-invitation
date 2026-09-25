import { randomBytes, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures, type HostFixture } from '../integration/fixtures';

let fx: AuthorizationFixtures;
test.beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
});
test.use({ trace: 'off' });
test.setTimeout(180_000);

async function login(page: Page, host: HostFixture) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(host.email);
  await page.getByLabel('Mật khẩu').fill(host.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('host edit through guest RSVP, automatic response, and other-host isolation', async ({ page: host, browser, request }) => {
  const suffix = randomBytes(4).toString('hex');
  const title = `Ngày vui trọn vẹn ${suffix}`;
  const address = `207 Giải Phóng, Hà Nội ${suffix}`;
  const guestName = `Lan Chi ${suffix}`;
  const guestEmail = `journey-${suffix}@example.com`;
  const guestMessage = `Hẹn gặp tại buổi lễ ${suffix}`;

  await login(host, fx.hostA);
  await host.getByLabel('Tiêu đề sự kiện').fill(title);
  await host.getByLabel('Ngày tổ chức', { exact: true }).fill('2027-01-02');
  await host.getByLabel('Giờ bắt đầu').fill('09:30');
  await host.getByLabel('Địa điểm', { exact: true }).fill('Hội trường kỷ niệm');
  await host.getByLabel('Địa chỉ', { exact: true }).fill(address);
  await host.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(host.getByRole('status')).toContainText('Đã lưu thay đổi');

  const music = host.locator('.music-uploader-card');
  await music.locator('#music-file-input').setInputFiles('music.mp3');
  const directUpload = host.waitForRequest(req =>
    req.method() === 'POST' && req.url().includes('/storage/v1/object/audio/'),
  );
  await music.getByRole('button', { name: 'Tải lên' }).click();
  await directUpload;
  await expect(music.getByRole('status')).toContainText('lưu nhạc thành công', { timeout: 20_000 });
  await expect(music.locator('.badge')).toHaveText('Đã có nhạc nền');
  await host.reload();
  await expect(host.getByLabel('Tiêu đề sự kiện')).toHaveValue(title);
  await expect(host.getByLabel('Địa chỉ', { exact: true })).toHaveValue(address);
  await expect(host.locator('.music-uploader-card .badge')).toHaveText('Đã có nhạc nền');

  const savedEvent = await fx.admin.from('events')
    .select('title, event_date, venue_address, music_path').eq('id', fx.hostA.eventId!).single();
  expect(savedEvent.error).toBeNull();
  expect(savedEvent.data).toMatchObject({ title, venue_address: address });
  expect(Date.parse(savedEvent.data!.event_date)).toBe(Date.parse('2027-01-02T02:30:00Z'));
  expect(savedEvent.data!.music_path).toBe(`${fx.hostA.id}/${fx.hostA.eventId}/music.mp3`);

  await host.getByRole('link', { name: 'Khách mời' }).click();
  await host.getByLabel('Tên khách').fill(guestName);
  await host.getByLabel('Email').fill(guestEmail);
  await host.getByLabel('Lời mời riêng').fill('Mong gặp bạn trong ngày vui');
  await host.locator('form').getByRole('button', { name: 'Gửi lời mời', exact: true }).click();
  await expect(host.locator('form .editor-feedback').getByRole('status'))
    .toContainText('Brevo đã tiếp nhận', { timeout: 20_000 });

  const localLink = await host.getByTestId('invite-link').inputValue();
  const localUrl = new URL(localLink);
  expect(localUrl.origin).toBe('http://127.0.0.1:3100');
  expect(localUrl.pathname).toMatch(/^\/invite\/[0-9a-f]{64}$/);
  const token = localUrl.pathname.split('/').pop()!;
  const invitation = await fx.admin.from('invitations')
    .select('id, event_id, token, status, guest_email').eq('token', token).single();
  expect(invitation.error).toBeNull();
  expect(invitation.data).toMatchObject({ event_id: fx.hostA.eventId, token, status: 'pending', guest_email: guestEmail });
  const invitationId = invitation.data!.id as string;

  const sent = await fx.admin.from('email_send_attempts')
    .select('status, provider_message_id, payload_snapshot').eq('invitation_id', invitationId).single();
  expect(sent.error).toBeNull();
  expect(sent.data!.status).toBe('accepted');
  expect(sent.data!.provider_message_id).toMatch(/^<stub-/);
  const payload = sent.data!.payload_snapshot as {
    inviteUrl: string; token: string; guestEmail: string; eventTitle: string;
    venueAddress: string; htmlContent: string; textContent: string;
  };
  expect(payload.token).toBe(token);
  expect(payload.guestEmail).toBe(guestEmail);
  expect(payload.eventTitle).toBe(title);
  expect(payload.venueAddress).toBe(address);
  expect(payload.inviteUrl).toBe(`https://invitation-test.example/invite/${token}`);
  expect(new URL(payload.inviteUrl).pathname).toBe(localUrl.pathname);
  expect(payload.htmlContent).toContain(payload.inviteUrl);
  expect(payload.textContent).toContain(payload.inviteUrl);

  const invitePage = await request.get(localUrl.pathname);
  expect(invitePage.status()).toBe(200);
  expect(invitePage.headers()['cache-control']).toMatch(/no-store|no-cache/);
  expect(invitePage.headers()['referrer-policy']).toBe('no-referrer');
  expect(invitePage.headers()['x-robots-tag']).toContain('noindex');

  await host.getByRole('link', { name: 'Phản hồi' }).click();
  await host.getByLabel('Tìm kiếm khách mời').fill(guestName);
  await host.getByRole('button', { name: 'Tìm' }).click();
  const responseRow = host.locator('tbody tr').filter({ hasText: guestName });
  await expect(responseRow).toContainText('Chưa phản hồi');

  const guestContext = await browser.newContext();
  try {
    const guest = await guestContext.newPage();
    const networkUrls: string[] = [];
    guest.on('request', req => networkUrls.push(req.url()));
    await guest.goto(localUrl.pathname);
    await expect(guest.locator('.guest-name')).toHaveText(guestName);
    await expect(guest.locator('.event-title')).toHaveText(title);
    await expect(guest.locator('audio')).toHaveAttribute('preload', 'none');
    expect(await guest.locator('audio').getAttribute('src')).toBeNull();
    expect(networkUrls.filter(url => url.includes(`/api/guest/${token}/audio`) || url.includes('.mp3'))).toHaveLength(0);

    const audioResponse = guest.waitForResponse(res => res.url().includes(`/api/guest/${token}/audio`));
    await guest.locator('.float-btn').click();
    expect((await audioResponse).status()).toBe(200);
    await expect.poll(() => guest.locator('audio').getAttribute('src')).toContain('token=');

    await guest.getByRole('radio', { name: 'Tôi sẽ tham gia' }).check();
    await guest.getByLabel('Ghi chú / lời nhắn').fill(guestMessage);
    await guest.getByRole('button', { name: 'Gửi xác nhận' }).click();
    await expect(guest.getByTestId('rsvp-receipt')).toContainText('Đã xác nhận tham gia');

    // The host page stays open: this change must arrive through its normal polling.
    await expect(responseRow.locator('.badge-accepted')).toHaveText('Đồng ý', { timeout: 25_000 });
    await expect(responseRow).toContainText(guestMessage);
  } finally {
    await guestContext.close();
  }

  const freshGuestContext = await browser.newContext();
  try {
    const returningGuest = await freshGuestContext.newPage();
    await returningGuest.goto(localUrl.pathname);
    await expect(returningGuest.getByTestId('rsvp-receipt')).toContainText(guestMessage);
    await expect(returningGuest.getByTestId('rsvp-form')).toHaveCount(0);
    await expect(returningGuest.getByRole('button', { name: 'Gửi xác nhận' })).toHaveCount(0);
  } finally {
    await freshGuestContext.close();
  }

  const hostBContext = await browser.newContext();
  try {
    const otherHost = await hostBContext.newPage();
    await login(otherHost, fx.hostB);
    await otherHost.goto(`/dashboard?eventId=${fx.hostA.eventId}`);
    await expect(otherHost.getByLabel('Tiêu đề sự kiện')).toHaveValue('MVP Step2 Event B');
    await expect(otherHost.getByTestId('host-preview').locator('.event-title')).toHaveText('MVP Step2 Event B');

    const eventGet = await otherHost.request.get(`/api/host/event?eventId=${fx.hostA.eventId}`);
    expect(eventGet.status()).toBe(200);
    expect(eventGet.headers()['cache-control']).toContain('no-store');
    expect((await eventGet.json()).event.id).toBe(fx.hostB.eventId);
    const guestsGet = await otherHost.request.get(`/api/host/invitations?eventId=${fx.hostA.eventId}`);
    expect(guestsGet.status()).toBe(200);
    expect(guestsGet.headers()['cache-control']).toContain('no-store');
    expect(JSON.stringify(await guestsGet.json())).not.toContain(guestEmail);

    const origin = 'http://127.0.0.1:3100';
    const eventPatch = await otherHost.request.patch('/api/host/event', {
      headers: { origin },
      data: {
        eventId: fx.hostA.eventId, title: 'Forbidden title',
        eventDate: '2027-01-02T02:30:00Z', venueName: null,
        venueAddress: null, googleMapUrl: null,
      },
    });
    expect(eventPatch.status()).toBe(422);
    const guestPatch = await otherHost.request.patch(`/api/host/invitations/${invitationId}`, {
      headers: { origin },
      data: { guestName: 'Forbidden edit', guestEmail, invitationNote: null },
    });
    expect(guestPatch.status()).toBe(404);
    const send = await otherHost.request.post(`/api/host/invitations/${invitationId}/send`, {
      headers: { origin }, data: { requestId: randomUUID() },
    });
    expect(send.status()).toBe(404);
    const unchanged = await fx.admin.from('invitations')
      .select('guest_name, status, guest_message').eq('id', invitationId).single();
    expect(unchanged.data).toMatchObject({ guest_name: guestName, status: 'accepted', guest_message: guestMessage });
  } finally {
    await hostBContext.close();
  }
});
