import { expect, test } from '@playwright/test';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from '../integration/fixtures';
import { readSession, writeSession, replaceSessionCookie } from './session-cookies';

test.setTimeout(180_000);

test('cannot leak credentials through a native GET before hydration', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3100/login');
    await expect(page.locator('form')).toHaveAttribute('method', 'post');
    await expect(page.getByLabel('Email')).toBeDisabled();
    await expect(page.getByLabel('Mật khẩu')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeDisabled();
  } finally { await context.close(); }
});

test('rejects a mutation with a foreign Origin', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    headers: { origin: 'https://evil.example' },
    data: { email: 'person@example.com', password: 'not-a-real-password' },
  });
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.message).toBe('Yêu cầu không hợp lệ.');
  expect(JSON.stringify(body)).not.toContain('not-a-real-password');
});

test('does not change the session through GET', async ({ request }) => {
  const response = await request.get('/api/auth/logout');
  expect(response.status()).toBe(405);
});

test('sends an anonymous dashboard visitor to login', async ({ page }) => {
  const response = await page.goto('/dashboard');
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByText('Liên hệ người cung cấp để được cấp hoặc đặt lại mật khẩu.')).toBeVisible();
  await expect(page.getByRole('link', { name: /đăng ký|quên mật khẩu/i })).toHaveCount(0);
});

test.describe('authenticated host', () => {
  let fx: AuthorizationFixtures;

  test.beforeAll(async () => {
    fx = await setupAuthorizationFixtures();
  });

  test('rejects corruption of the real project session after a successful login', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(Boolean((await readSession(context)).access_token)).toBe(true);
    await replaceSessionCookie(context, 'base64-bm90LWpzb24');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('refreshes through the application proxy and persists renewed cookies', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const before = await readSession(context);
    // Force the SDK's persisted-session expiry check; keep real signed tokens.
    // This exercises real refresh HTTP and Set-Cookie, without mocking Auth.
    await writeSession(context, { ...before, expires_at: 1, expires_in: 0 });
    const response = await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByLabel('Tiêu đề sự kiện')).toHaveValue('MVP Step2 Event A');
    const after = await readSession(context);
    expect((after.expires_at ?? 0) > Math.floor(Date.now() / 1000)).toBe(true);
    expect(after.refresh_token !== before.refresh_token).toBe(true);
    expect((await response!.headersArray()).some(header => header.name.toLowerCase() === 'set-cookie')).toBe(true);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('returns to login when an expired session cannot refresh', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const session = await readSession(context);
    await writeSession(context, { ...session, expires_at: 1, expires_in: 0, refresh_token: 'invalid-test-refresh-token' });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows a generic error for the wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill('wrong-password');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.locator('.auth-error')).toHaveText('Email hoặc mật khẩu không đúng.');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/không tồn tại|user not found/i)).toHaveCount(0);
  });

  test('logs Host A in and does not show Host B data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByLabel('Tiêu đề sự kiện')).toHaveValue('MVP Step2 Event A');
    await expect(page.getByText('MVP Step2 Event B')).toHaveCount(0);
    await expect(page.getByText(fx.hostB.email)).toHaveCount(0);
  });

  test('logs out and blocks the dashboard afterwards', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostA.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostA.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows the empty-event message for a host without an event', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fx.hostNone.email);
    await page.getByLabel('Mật khẩu').fill(fx.hostNone.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.')).toBeVisible();
    await expect(page.getByText('MVP Step2 Event A')).toHaveCount(0);
  });
});
