import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), false);
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3200';
const target = new URL(base);
if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid SMOKE_BASE_URL');
const failures = [];
function check(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
}
const secrets = ['SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY']
  .map(name => ({ name, value: process.env[name] })).filter(item => item.value?.length > 10);
check(secrets.length === 2, 'both private keys are available locally for comparison (values never logged)');
function noSecrets(content) { return secrets.every(item => !content.includes(item.value)); }
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(js|json|map|html)$/.test(path)) {
      if (!noSecrets(await readFile(path, 'utf8'))) failures.push('Private key present in a public build asset');
    }
  }
}
await scan('.next/static');
check(!failures.length, 'public build assets contain no configured private keys');
for (const [path, expected] of [
  ['/login', 200], ['/preview', 404], ['/dashboard', 307],
  ['/api/host/event', 401], ['/api/host/invitations', 401],
  [`/api/guest/${'0'.repeat(64)}`, 404], [`/invite/${'0'.repeat(64)}`, 404],
]) {
  const response = await fetch(new URL(path, target), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  // A loading boundary can flush HTTP 200 before the authenticated page
  // redirects. Next then emits the redirect in the streamed HTML instead.
  const streamedLoginRedirect = path === '/dashboard' && response.status === 200
    && body.includes('id="__next-page-redirect"')
    && /http-equiv="refresh" content="\d+;url=\/login"/.test(body);
  check(response.status === expected || streamedLoginRedirect, `${path.startsWith('/invite/') || path.startsWith('/api/guest/') ? 'invalid guest token' : path} HTTP ${response.status}${streamedLoginRedirect ? ' (streamed login redirect)' : ` (expected ${expected})`}`);
  check(noSecrets(body), 'response contains no configured private keys');
  if (path !== '/preview') {
    check(/no-store|no-cache/.test(response.headers.get('cache-control') ?? ''), 'private response bypasses cache');
    check(response.headers.get('referrer-policy') === 'no-referrer', 'referrer-policy');
    check((response.headers.get('x-robots-tag') ?? '').includes('noindex'), 'noindex');
  }
}
check((await fetch(new URL('/api/auth/logout', target), { signal: AbortSignal.timeout(20000) })).status === 405, 'GET cannot log out');
if (failures.length) {
  console.error(`${failures.length} production checks failed. No authenticated actions or email were performed.`);
  process.exitCode = 1;
} else console.log('Production read-only smoke passed. Authenticated full journey and real inbox delivery remain separate checks.');
