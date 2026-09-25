import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedMutationOrigin } from '../../src/lib/origin';

function requestWithOrigin(url: string, origin?: string, extra?: Record<string, string>) {
  const headers = new Headers(extra);
  if (origin !== undefined) headers.set('origin', origin);
  return new Request(url, { method: 'POST', headers });
}

describe('isAllowedMutationOrigin', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('rejects production mutations when SITE_URL is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SITE_URL', '');
    expect(isAllowedMutationOrigin(requestWithOrigin('https://invite.example/api/auth/login', 'https://invite.example'))).toBe(false);
  });
  it('uses the configured site in production, not attacker-supplied forwarded headers', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SITE_URL', 'https://invite.example');
    expect(isAllowedMutationOrigin(requestWithOrigin('https://invite.example/api/auth/login', 'https://evil.example', {
      'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'https',
    }))).toBe(false);
    expect(isAllowedMutationOrigin(requestWithOrigin('http://internal/api/auth/login', 'https://invite.example'))).toBe(true);
  });
  it('accepts the same origin as the request URL', () => {
    expect(
      isAllowedMutationOrigin(
        requestWithOrigin('http://127.0.0.1:3100/api/auth/login', 'http://127.0.0.1:3100'),
      ),
    ).toBe(true);
  });

  it('rejects a missing Origin header', () => {
    expect(isAllowedMutationOrigin(requestWithOrigin('http://127.0.0.1:3100/api/auth/login'))).toBe(
      false,
    );
  });

  it('rejects a different origin', () => {
    expect(
      isAllowedMutationOrigin(
        requestWithOrigin('http://127.0.0.1:3100/api/auth/login', 'https://evil.example'),
      ),
    ).toBe(false);
  });

  it('accepts Origin that matches Host when the request URL origin differs', () => {
    expect(
      isAllowedMutationOrigin(
        requestWithOrigin('http://localhost:3100/api/auth/login', 'http://127.0.0.1:3100', {
          host: '127.0.0.1:3100',
        }),
      ),
    ).toBe(true);
  });

  it('rejects a foreign Origin even when Host matches the app', () => {
    expect(
      isAllowedMutationOrigin(
        requestWithOrigin('http://127.0.0.1:3100/api/auth/login', 'https://evil.example', {
          host: '127.0.0.1:3100',
        }),
      ),
    ).toBe(false);
  });
});
