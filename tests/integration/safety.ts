/** These guards run before any admin client or remote fixture mutation. */
export function assertSupabaseTestTarget(url: string, target: string | undefined, pinnedUrl: string): void {
  if (target !== 'test' || !pinnedUrl) {
    throw new Error('Test writes require SUPABASE_TARGET=test and a pinned test project.');
  }
  const actual = new URL(url);
  const pinned = new URL(pinnedUrl);
  const local = ['localhost', '127.0.0.1'].includes(actual.hostname);
  if (
    actual.origin !== pinned.origin || actual.username || actual.password ||
    actual.pathname !== '/' || actual.search || actual.hash ||
    (actual.protocol !== 'https:' && !(local && actual.protocol === 'http:')) ||
    (!local && !/^[a-z0-9-]+\.supabase\.co$/.test(actual.hostname))
  ) {
    throw new Error('Refusing writes: Supabase URL does not match the designated test project.');
  }
}

export function assertFixtureEmail(actual: string, expected: string): void {
  if (actual !== expected) {
    throw new Error('Fixture email must belong to this project\'s reserved mvp-step2 namespace.');
  }
}
