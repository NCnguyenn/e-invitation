import { describe, expect, it } from 'vitest';
import { assertSupabaseTestTarget, assertFixtureEmail } from '../integration/safety';

const pinned = 'https://designated-test.supabase.co';
describe('integration test write safeguards', () => {
  it('requires an explicit test declaration', () => {
    for (const target of [undefined, '', 'production', 'staging']) {
      expect(() => assertSupabaseTestTarget(pinned, target, pinned)).toThrow();
    }
  });
  it('rejects a different Supabase project even when marked test', () => {
    expect(() => assertSupabaseTestTarget('https://other.supabase.co', 'test', pinned)).toThrow();
  });
  it('rejects credentials, paths, insecure URLs and missing target pins', () => {
    for (const url of ['http://designated-test.supabase.co', `${pinned}/rest/v1`, 'https://user:pass@designated-test.supabase.co']) {
      expect(() => assertSupabaseTestTarget(url, 'test', pinned)).toThrow();
    }
    expect(() => assertSupabaseTestTarget(pinned, 'test', '')).toThrow();
  });
  it('accepts only the pinned test origin', () => {
    expect(() => assertSupabaseTestTarget(`${pinned}/`, 'test', pinned)).not.toThrow();
  });
  it('does not allow a fixture override to reset an unrelated account', () => {
    const expected = 'mvp-step2-host-a.designated-test@example.com';
    expect(() => assertFixtureEmail('customer@example.com', expected)).toThrow();
    expect(() => assertFixtureEmail(expected, expected)).not.toThrow();
  });
});
