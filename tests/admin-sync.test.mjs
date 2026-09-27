import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { mergeMetricSnapshots, newestFetchedAt } from '../src/features/admin/metrics/snapshot-merge.ts';
import { brevoMetricScope } from '../src/features/admin/metrics/context.ts';

process.env.METRICS_ENVIRONMENT = 'local';
process.env.BREVO_API_KEY = 'current-key';
process.env.SUPABASE_PROJECT_REF = 'current-project';
process.env.SUPABASE_MANAGEMENT_TOKEN = 'current-token';
const sample = (extra = {}) => ({
  provider: 'brevo', scope_type: 'account', scope_id: brevoMetricScope('current-key'),
  metric_key: 'brevo-credits', display_name: 'Brevo Email Credits', environment: 'local',
  value: 0, unit: 'credit', limit_value: null, remaining_value: null,
  period_start: null, period_end: null, period_timezone: null, provider_updated_at: null,
  fetched_at: new Date().toISOString(), source_kind: 'api', source_url: 'https://developers.brevo.com/reference',
  endpoint: 'GET /v3/account', field_path: 'plan[].credits', status: 'fresh',
  last_attempt_at: new Date().toISOString(), error_code: null, mapping_version: '2.0',
  source_checked_at: '2026-09-27', ...extra,
});

// Execute the actual sync module. Only network/database boundaries are substituted;
// TypeScript stripping and import rewriting leave its pipeline unchanged.
async function pipeline({ rows = [], lease = { acquired: true, lease_token: 'lease-a' },
  brevo = async () => [], supabase = async () => [], commitError = null, commitData = true } = {}) {
  const calls = [];
  const db = {
    from: () => ({ select: async () => ({ data: rows, error: null }),
      upsert: async () => { calls.push(['unsafe-upsert']); return { error: null }; } }),
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'acquire_provider_sync_lease') return { data: lease, error: null };
      if (name === 'persist_provider_metric_snapshots') return { data: commitData, error: commitError };
      return { data: true, error: null };
    },
  };
  const key = `sync_test_${Math.random()}`;
  globalThis[key] = { createAdminSupabaseClient: () => db,
    fetchBrevoMetrics: async () => { calls.push(['brevo']); return brevo(); },
    fetchSupabaseMgmtMetrics: async () => { calls.push(['supabase']); return supabase(); },
    fetchInternalActivityMetrics: async () => ({ status: 'unavailable' }) };
  const file = new URL('../src/features/admin/metrics/sync.ts', import.meta.url);
  let source = stripTypeScriptTypes(await readFile(file, 'utf8'));
  source = source.replace(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g, (line, names, path) => {
    if (path.includes('/admin') || /\/(brevo|supabase-mgmt|internal)(\.ts)?$/.test(path)) {
      return `const {${names}} = globalThis[${JSON.stringify(key)}];`;
    }
    const resolved = new URL(path.endsWith('.ts') ? path : `${path}.ts`, file).href;
    return `import {${names}} from ${JSON.stringify(resolved)};`;
  });
  const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  return { calls, run: (force = true) => module.getOrSyncMetrics(force) };
}

test('merge never borrows another environment or an incompatible mapping', () => {
  const previous = sample();
  const failed = sample({ value: null, status: 'unavailable', environment: 'production' });
  assert.equal(mergeMetricSnapshots([previous], [failed]).length, 2);
  for (const extra of [{ unit: 'count' }, { field_path: 'different' }, { mapping_version: '3.0' }]) {
    const result = mergeMetricSnapshots([previous], [sample({ ...extra, value: null, status: 'unavailable' })]);
    assert.equal(result[0].value, null);
  }
});
test('failed and nonfinite measurements cannot advance successful fetch time', () => {
  assert.equal(newestFetchedAt([sample({ value: null, status: 'unavailable' })]), null);
  assert.equal(newestFetchedAt([sample({ value: Infinity })]), null);
});
test('locked response expires cached measurements and strips payload', async () => {
  const p = await pipeline({ rows: [sample({ fetched_at: '2020-01-01T00:00:00Z', raw_payload: { secret: true } })], lease: { acquired: false, reason: 'locked' } });
  const r = await p.run();
  assert.equal(r.snapshots[0].status, 'stale');
  assert.equal(r.snapshots.length, 11, 'blocked sync includes unavailable rows, so one cached measurement cannot look complete');
  assert.equal('raw_payload' in r.snapshots[0], false);
  assert.equal(p.calls.some(([name]) => name === 'brevo' || name.includes('persist') || name === 'unsafe-upsert'), false);
});
test('filter old credential, project, environment and mapping snapshots', async () => {
  const rows = [sample({ scope_id: 'old-key' }), sample({ environment: 'production' }),
    sample({ mapping_version: '1.0' }), sample({ provider: 'supabase', scope_id: 'old-project' })];
  const p = await pipeline({ rows, lease: { acquired: false } });
  assert.equal((await p.run()).snapshots.some(s => s.value !== null), false);
});
test('timeouts preserve last measured zero, error and timestamp; commits are fenced', async () => {
  const previous = sample({ fetched_at: '2020-01-01T00:00:00Z' });
  const p = await pipeline({ rows: [previous], brevo: async () => { throw new DOMException('timeout', 'TimeoutError'); } });
  const r = await p.run();
  const s = r.snapshots.find(s => s.metric_key === previous.metric_key);
  assert.equal(s.value, 0); assert.equal(s.status, 'stale');
  assert.equal(s.fetched_at, previous.fetched_at); assert.equal(s.error_code, 'TIMEOUT');
  assert.equal(r.snapshots.length, 11);
  assert.equal(r.lastSyncedAt, previous.fetched_at);
  assert.ok(p.calls.some(([name]) => name === 'persist_provider_metric_snapshots'));
  assert.ok(!p.calls.some(([name]) => name === 'unsafe-upsert'));
  assert.equal(p.calls.find(([name]) => name === 'release_provider_sync_lease')[1].p_cooldown_seconds, 60);
});
test('persistence failures and rejected late holders are surfaced, never fallback upsert', async () => {
  for (const options of [{ commitError: { message: 'migration missing' } }, { commitData: false }]) {
    const p = await pipeline({ ...options, brevo: async () => [sample()] });
    const r = await p.run();
    assert.equal(r.syncBlockedReason, 'persistence_failed');
    assert.equal(r.lastSyncedAt, null);
    assert.ok(!p.calls.some(([name]) => name === 'unsafe-upsert'));
  }
});
test('partial cached rows and ended reporting periods cannot skip refresh', async () => {
  for (const extra of [{}, { period_end: '2020-01-01T00:00:00Z' }]) {
    const p = await pipeline({ rows: [sample(extra)], lease: { acquired: false, reason: 'cooldown' } });
    const r = await p.run(false);
    assert.equal(r.syncBlockedReason, 'cooldown');
    if (extra.period_end) assert.equal(r.snapshots[0].status, 'stale');
  }
});
