import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyBrevoResponse, postBrevoOnce } from '../../src/features/email/brevo';
import { readEmailConfig } from '../../src/features/email/config';
import { emailStatusLabel, EMAIL_UNKNOWN_HELP } from '../../src/features/email/labels';
import { buildInviteUrl, formatVietnamEventDate, renderInvitationEmail } from '../../src/features/email/render';
import { parseSendInvitation, ValidationError } from '../../src/lib/validation';
import testProject from '../../supabase/test-project.json';

const TOKEN = 'ab'.repeat(32);
const SITE = 'https://invitation.example';

describe('invitation email rendering', () => {
  it('escapes dynamic HTML and does not treat host text as markup', () => {
    const rendered = renderInvitationEmail({
      guestName: 'Lan <script>',
      eventTitle: 'Lễ & "cưới"',
      eventDateIso: '2026-12-20T03:00:00.000Z',
      venueName: 'Nhà <b>hàng</b>',
      venueAddress: '1 Nguyễn Huệ & Quận 1',
      invitationNote: 'Gặp nhau <img src=x onerror=alert(1)>',
      inviteUrl: `${SITE}/invite/${TOKEN}`,
    });

    expect(rendered.subject).toBe('Thư mời: Lễ & "cưới"');
    expect(rendered.html).toContain('Lan &lt;script&gt;');
    expect(rendered.html).toContain('Lễ &amp; &quot;cưới&quot;');
    expect(rendered.html).toContain('Nhà &lt;b&gt;hàng&lt;/b&gt;');
    expect(rendered.html).toContain('1 Nguyễn Huệ &amp; Quận 1');
    expect(rendered.html).toContain('Gặp nhau &lt;img src=x onerror=alert(1)&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).not.toContain('<form');
    expect(rendered.html).not.toContain('tracking');
    expect(rendered.html).toContain('Xem thư mời');
    expect(rendered.html).toContain(`href="${SITE}/invite/${TOKEN}"`);
    expect(rendered.text).toContain('Lan <script>');
    expect(rendered.text).toContain(`${SITE}/invite/${TOKEN}`);
    expect(rendered.text).not.toContain('&lt;');
  });

  it('formats the event instant in Vietnam time, not UTC', () => {
    expect(formatVietnamEventDate('2026-12-20T03:00:00.000Z')).toContain('20/12/2026');
    expect(formatVietnamEventDate('2026-12-20T03:00:00.000Z')).toContain('10:00');
    expect(formatVietnamEventDate('2026-09-26T16:59:59.000Z')).toContain('26/09/2026');
    expect(formatVietnamEventDate('2026-09-26T16:59:59.000Z')).toContain('23:59');
    expect(formatVietnamEventDate('2026-09-26T17:00:00.000Z')).toContain('27/09/2026');
    expect(formatVietnamEventDate('2026-09-26T17:00:00.000Z')).toContain('00:00');
    expect(formatVietnamEventDate('2026-12-20T03:00:00.000Z')).not.toContain('03:00');
  });

  it('builds the invite link only from the configured SITE_URL', () => {
    expect(buildInviteUrl(SITE, TOKEN)).toBe(`${SITE}/invite/${TOKEN}`);
    expect(buildInviteUrl(`${SITE}/`, TOKEN)).toBe(`${SITE}/invite/${TOKEN}`);
    expect(() => buildInviteUrl('http://invitation.example', TOKEN)).toThrow(/SITE_URL/);
    expect(() => buildInviteUrl('https://localhost:3000', TOKEN)).toThrow(/SITE_URL/);
    expect(() => buildInviteUrl('https://127.0.0.1', TOKEN)).toThrow(/SITE_URL/);
    expect(() => buildInviteUrl('https://user:secret@invitation.example', TOKEN)).toThrow(/SITE_URL/);
    expect(() => buildInviteUrl(SITE, 'not-a-token')).toThrow(/token/);
  });

  it('omits an empty personal note and strips newlines from the subject', () => {
    const rendered = renderInvitationEmail({
      guestName: 'An',
      eventTitle: 'Tiệc\r\nriêng',
      eventDateIso: '2026-12-20T03:00:00.000Z',
      venueName: null,
      venueAddress: null,
      invitationNote: '   ',
      inviteUrl: `${SITE}/invite/${TOKEN}`,
    });
    expect(rendered.subject).toBe('Thư mời: Tiệc riêng');
    expect(rendered.subject).not.toMatch(/[\r\n]/);
    expect(rendered.html).not.toContain('Lời mời riêng');
    expect(rendered.text).not.toContain('Lời mời riêng');
  });
});

describe('email status labels', () => {
  it('does not collapse failed or unknown into chưa gửi', () => {
    expect(emailStatusLabel('pending')).toBe('Chưa gửi');
    expect(emailStatusLabel('sending')).toBe('Đang xử lý');
    expect(emailStatusLabel('sent')).toBe('Brevo đã tiếp nhận');
    expect(emailStatusLabel('failed')).toBe('Gửi thất bại');
    expect(emailStatusLabel('unknown')).toBe('Chưa xác định kết quả');
    expect(emailStatusLabel('failed')).not.toBe('Chưa gửi');
    expect(EMAIL_UNKNOWN_HELP).toBe('Chưa xác định kết quả, cần kiểm tra trước khi gửi lại.');
  });
});

describe('send request validation', () => {
  it('accepts only a requestId UUID', () => {
    expect(parseSendInvitation({ requestId: '550E8400-E29B-41D4-A716-446655440000' })).toEqual({
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(() => parseSendInvitation({ requestId: 'nope', recipient: 'a@b.c' })).toThrow(ValidationError);
    expect(() => parseSendInvitation({ requestId: TOKEN })).toThrow(ValidationError);
  });
});

describe('email configuration', () => {
  const configured = {
    NODE_ENV: 'test' as const,
    BREVO_API_KEY: 'unit-key', BREVO_SENDER_EMAIL: 'sender@example.com',
    BREVO_SENDER_NAME: 'Test', SITE_URL: SITE,
  };
  it('fails closed for stub email in production or a hosted deployment', () => {
    for (const deployment of [{ NODE_ENV: 'production' }, { NODE_ENV: 'development', NETLIFY: 'true' }, { NODE_ENV: 'test', CONTEXT: 'deploy-preview' }] as const) {
      const result = readEmailConfig({ ...configured, ...deployment, EMAIL_TRANSPORT: 'stub', SUPABASE_TARGET: 'test' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.missing).toContain('EMAIL_TRANSPORT');
    }
  });
  it('rejects unknown transport modes and stub against an unpinned project', () => {
    expect(readEmailConfig({ ...configured, EMAIL_TRANSPORT: 'typo' }).ok).toBe(false);
    expect(readEmailConfig({ ...configured, NODE_ENV: 'test', EMAIL_TRANSPORT: 'stub', SUPABASE_TARGET: 'test', NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }).ok).toBe(false);
  });
  it('accepts exact local stub mode but rejects whitespace that could select real transport', () => {
    const local = { ...configured, SUPABASE_TARGET: 'test', NEXT_PUBLIC_SUPABASE_URL: testProject.url };
    expect(readEmailConfig({ ...local, EMAIL_TRANSPORT: 'stub' }).ok).toBe(true);
    expect(readEmailConfig({ ...local, EMAIL_TRANSPORT: ' stub ' }).ok).toBe(false);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('names the missing variable and does not echo the API key', () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-super-secret');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'host@invitation.example');
    vi.stubEnv('BREVO_SENDER_NAME', 'Nhà trai');
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('APP_BASE_URL', 'https://should-not-be-used.example');
    const missing = readEmailConfig();
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.missing).toContain('SITE_URL');
    expect(missing.message).not.toContain('xkeysib-super-secret');
    expect(missing.message).not.toContain('should-not-be-used');
  });

  it('rejects localhost and ignores APP_BASE_URL', () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'host@invitation.example');
    vi.stubEnv('BREVO_SENDER_NAME', 'Nhà trai');
    vi.stubEnv('SITE_URL', 'http://localhost:3000');
    vi.stubEnv('APP_BASE_URL', 'https://public.example');
    const result = readEmailConfig();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain('SITE_URL');
  });

  it('accepts a public HTTPS SITE_URL without a trailing slash', () => {
    vi.stubEnv('BREVO_API_KEY', 'xkeysib-test');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'Host@Invitation.Example');
    vi.stubEnv('BREVO_SENDER_NAME', 'Nhà trai');
    vi.stubEnv('SITE_URL', 'https://invitation.example/');
    const result = readEmailConfig();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.siteUrl).toBe('https://invitation.example');
    expect(result.config.senderEmail).toBe('host@invitation.example');
    expect(result.config.apiKey).toBe('xkeysib-test');
  });
});

describe('Brevo response classification', () => {
  it('accepts only HTTP 201 with a single messageId', () => {
    expect(classifyBrevoResponse(201, { messageId: '<abc@relay.example>' })).toEqual({
      outcome: 'accepted',
      messageId: '<abc@relay.example>',
    });
    expect(classifyBrevoResponse(201, { messageIds: ['<batch@relay.example>'] }).outcome).toBe('unknown');
    expect(classifyBrevoResponse(201, {}).outcome).toBe('unknown');
    expect(classifyBrevoResponse(202, { messageId: '<scheduled@relay.example>' }).outcome).toBe('unknown');
  });

  it('rejects only documented certain refusals and leaves unclear results unknown', () => {
    expect(classifyBrevoResponse(400, { code: 'invalid_parameter', message: 'bad email user@secret.example' })).toEqual({
      outcome: 'rejected',
      errorCode: 'invalid_parameter',
    });
    expect(classifyBrevoResponse(400, { code: 'Insufficient credits', message: 'stop' })).toEqual({
      outcome: 'rejected',
      errorCode: 'insufficient_credits',
    });
    expect(classifyBrevoResponse(400, { code: 'duplicate_request', message: 'again' }).outcome).toBe('unknown');
    expect(classifyBrevoResponse(400, { code: 'Request already processed', message: 'again' }).outcome).toBe('unknown');
    expect(classifyBrevoResponse(500, { code: 'invalid_parameter', message: 'maybe sent' }).outcome).toBe('unknown');
    expect(classifyBrevoResponse(401, { code: 'unauthorized', message: 'no' }).outcome).toBe('unknown');
    expect(classifyBrevoResponse(400, { message: 'missing code' }).outcome).toBe('unknown');
    const rejected = classifyBrevoResponse(400, { code: 'invalid_parameter', message: 'user@secret.example' });
    expect(JSON.stringify(rejected)).not.toContain('user@secret.example');
  });
});

describe('Brevo transport', () => {
  it('posts once to the transactional endpoint and does not send an idempotency key', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ messageId: '<one@relay.example>' }), { status: 201 });
    });
    const result = await postBrevoOnce({
      apiKey: 'xkeysib-do-not-log',
      payload: {
        sender: { email: 'host@invitation.example', name: 'Nhà trai' },
        to: [{ email: 'guest@example.com', name: 'Lan' }],
        subject: 'Thư mời: Tiệc',
        htmlContent: '<p>secret-html</p>',
        textContent: 'secret-text',
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 50,
    });
    expect(result).toEqual({ status: 201, body: { messageId: '<one@relay.example>' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get('api-key')).toBe('xkeysib-do-not-log');
    expect(headers.get('Idempotency-Key')).toBeNull();
    expect(calls[0]?.init.redirect).toBe('error');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.headers).toBeUndefined();
    expect(body.idempotencyKey).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('Idempotency-Key');
    expect(JSON.stringify(body)).not.toContain('idempotencyKey');
  });

  it('does not retry a failed post and does not leak the API key', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down xkeysib-do-not-log secret-html');
    });
    const result = await postBrevoOnce({
      apiKey: 'xkeysib-do-not-log',
      payload: {
        sender: { email: 'host@invitation.example', name: 'Nhà trai' },
        to: [{ email: 'guest@example.com', name: 'Lan' }],
        subject: 'Thư mời: Tiệc',
        htmlContent: '<p>secret-html</p>',
        textContent: 'plain',
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 20,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 0, body: null, transportError: 'transport_unreachable' });
    expect(JSON.stringify(result)).not.toContain('xkeysib-do-not-log');
    expect(JSON.stringify(result)).not.toContain('secret-html');
  });
});
