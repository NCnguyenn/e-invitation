import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { requireSupabaseTestEnv } from './env';
import { setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';

let fx: AuthorizationFixtures;

beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
}, 120_000);

describe('auth session', () => {
  it('refreshes a valid host session and rejects an invalid access token', async () => {
    const env = requireSupabaseTestEnv();
    const client = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await client.auth.signInWithPassword({
      email: fx.hostA.email,
      password: fx.hostA.password,
    });
    expect(signedIn.error).toBeNull();
    const refreshed = await client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.user?.id).toBe(fx.hostA.id);

    const invalid = await client.auth.getUser('not-a-jwt');
    expect(invalid.data.user).toBeNull();
    expect(invalid.error).toBeTruthy();
  });

  it('reports whether public signup is disabled without creating an account', async () => {
    const env = requireSupabaseTestEnv();
    const response = await fetch(new URL('/auth/v1/settings', env.url), {
      headers: { apikey: env.anonKey },
    });
    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { disable_signup?: boolean };
    expect(settings.disable_signup).toBe(true);
  });
});
