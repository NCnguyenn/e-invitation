import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBrevoMetrics } from '../src/features/admin/metrics/brevo.ts';
import { fetchSupabaseMgmtMetrics } from '../src/features/admin/metrics/supabase-mgmt.ts';
import { PUBLISHED_REFERENCE_LIMITS, DIRECT_DASHBOARD_LINKS } from '../src/features/admin/metrics/reference.ts';
import { mergeMetricSnapshots } from '../src/features/admin/metrics/snapshot-merge.ts';
import { summarizeProviderMeasurements } from '../src/features/admin/metrics/measurement-status.ts';

function snapshot(overrides = {}) {
  return {
    provider: 'supabase',
    scope_type: 'project',
    scope_id: 'project-a',
    metric_key: 'supabase-disk-fs-used',
    display_name: 'Supabase DB Filesystem Used',
    environment: 'production',
    value: 42,
    unit: 'byte',
    limit_value: 100,
    remaining_value: 58,
    period_start: null,
    period_end: null,
    period_timezone: null,
    provider_updated_at: null,
    fetched_at: '2026-09-27T10:00:00.000Z',
    source_kind: 'api',
    source_url: 'https://supabase.com/docs/reference/api/v1-get-disk-utilization',
    endpoint: 'GET /v1/projects/{ref}/config/disk/util',
    field_path: 'metrics.fs_used_bytes',
    status: 'fresh',
    last_attempt_at: '2026-09-27T10:00:00.000Z',
    error_code: null,
    mapping_version: '1.0',
    source_checked_at: '2026-09-27',
    ...overrides,
  };
}

test('failed refresh preserves the last successful provider measurement', () => {
  const previous = snapshot();
  const failed = snapshot({
    value: null,
    limit_value: null,
    remaining_value: null,
    fetched_at: '2026-09-27T10:05:00.000Z',
    last_attempt_at: '2026-09-27T10:05:00.000Z',
    status: 'unavailable',
    error_code: 'TIMEOUT',
  });

  const [merged] = mergeMetricSnapshots([previous], [failed]);

  assert.equal(merged.value, 42);
  assert.equal(merged.limit_value, 100);
  assert.equal(merged.remaining_value, 58);
  assert.equal(merged.fetched_at, previous.fetched_at);
  assert.equal(merged.status, 'stale');
  assert.equal(merged.last_attempt_at, failed.last_attempt_at);
  assert.equal(merged.error_code, 'TIMEOUT');
});

test('partial provider measurements never qualify as fully healthy', () => {
  const measured = snapshot({ metric_key: 'brevo-credits', provider: 'brevo', value: 12, status: 'fresh' });
  const unavailable = snapshot({ metric_key: 'brevo-smtp-requests', provider: 'brevo', value: null, status: 'unavailable' });

  const summary = summarizeProviderMeasurements([measured, unavailable], Date.parse('2026-09-27T10:01:00.000Z'));

  assert.equal(summary.allFresh, false);
  assert.equal(summary.freshCount, 1);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.unavailableCount, 1);
});

test('Brevo adapter returns not_connected when API key is missing', async () => {
  const snapshots = await fetchBrevoMetrics('');
  assert.equal(snapshots.length, 4);

  for (const s of snapshots) {
    assert.equal(s.provider, 'brevo');
    assert.equal(s.status, 'not_connected');
    assert.equal(s.value, null);
    assert.equal(s.error_code, 'MISSING_API_KEY');
    assert.ok(s.endpoint);
    assert.ok(s.field_path);
  }
});

test('Brevo adapter parses valid API responses correctly with mock fetch', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/account')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: 'admin@example.com',
            plan: [{ type: 'free', creditsType: 'sendLimit', credits: 285 }],
          }),
        };
      }
      if (urlStr.includes('/smtp/statistics/aggregatedReport')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            range: '2026-09-27',
            requests: 15,
            delivered: 14,
            hardBounces: 1,
            softBounces: 0,
          }),
        };
      }
      return { ok: false, status: 404 };
    };

    const snapshots = await fetchBrevoMetrics('test-mock-key');
    assert.equal(snapshots.length, 4);

    const credits = snapshots.find(s => s.metric_key === 'brevo-credits');
    assert.ok(credits);
    assert.equal(credits.value, 285);
    assert.equal(credits.unit, 'credit');
    assert.equal(credits.status, 'fresh');

    const requests = snapshots.find(s => s.metric_key === 'brevo-smtp-requests');
    assert.ok(requests);
    assert.equal(requests.value, 15);
    assert.equal(requests.unit, 'count');
    assert.equal(requests.status, 'fresh');

    const delivered = snapshots.find(s => s.metric_key === 'brevo-smtp-delivered');
    assert.ok(delivered);
    assert.equal(delivered.value, 14);

    const bounces = snapshots.find(s => s.metric_key === 'brevo-smtp-bounces');
    assert.ok(bounces);
    assert.equal(bounces.value, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Brevo adapter handles 401/403 forbidden and never defaults to 0', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Key not found' }),
    });

    const snapshots = await fetchBrevoMetrics('invalid-key');
    for (const s of snapshots) {
      assert.equal(s.status, 'forbidden');
      assert.equal(s.value, null);
      assert.notEqual(s.value, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Brevo adapter handles 429 rate limit correctly', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Rate limit exceeded' }),
    });

    const snapshots = await fetchBrevoMetrics('test-key');
    for (const s of snapshots) {
      assert.equal(s.status, 'rate_limited');
      assert.equal(s.value, null);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Supabase Management adapter returns not_connected when token or ref is missing', async () => {
  const snapshots = await fetchSupabaseMgmtMetrics('', '');
  assert.equal(snapshots.length, 7);

  for (const s of snapshots) {
    assert.equal(s.provider, 'supabase');
    assert.equal(s.status, 'not_connected');
    assert.equal(s.value, null);
    assert.equal(s.error_code, 'MISSING_MANAGEMENT_CREDENTIALS');
  }
});

test('Supabase Management adapter parses disk util and api counts with mock fetch', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/config/disk/util')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            metrics: {
              fs_size_bytes: 10737418240, // 10 GiB
              fs_used_bytes: 1048576000,  // ~1000 MiB
              fs_avail_bytes: 9688842240,
            },
          }),
        };
      }
      if (urlStr.includes('/analytics/endpoints/usage.api-counts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: [
              {
                total_auth_requests: 42,
                total_rest_requests: 120,
                total_storage_requests: 5,
                total_realtime_requests: 18,
              },
            ],
          }),
        };
      }
      return { ok: false, status: 404 };
    };

    const snapshots = await fetchSupabaseMgmtMetrics('mock-mgmt-token', 'mock-project-ref');
    assert.equal(snapshots.length, 7);

    const fsSize = snapshots.find(s => s.metric_key === 'supabase-disk-fs-size');
    assert.ok(fsSize);
    assert.equal(fsSize.value, 10737418240);
    assert.equal(fsSize.unit, 'byte');
    assert.equal(fsSize.status, 'fresh');

    const fsUsed = snapshots.find(s => s.metric_key === 'supabase-disk-fs-used');
    assert.ok(fsUsed);
    assert.equal(fsUsed.value, 1048576000);
    assert.equal(fsUsed.limit_value, 10737418240);

    const authCount = snapshots.find(s => s.metric_key === 'supabase-api-auth');
    assert.ok(authCount);
    assert.equal(authCount.value, 42);
    assert.equal(authCount.unit, 'count');

    const restCount = snapshots.find(s => s.metric_key === 'supabase-api-rest');
    assert.ok(restCount);
    assert.equal(restCount.value, 120);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Supabase Management adapter flags invalid_response when payload missing fields', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    });

    const snapshots = await fetchSupabaseMgmtMetrics('mock-token', 'mock-ref');
    for (const s of snapshots) {
      assert.equal(s.status, 'invalid_response');
      assert.equal(s.value, null);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Published reference limits and direct dashboard links comply with spec', () => {
  assert.ok(PUBLISHED_REFERENCE_LIMITS.length >= 14);
  const providers = new Set(PUBLISHED_REFERENCE_LIMITS.map(l => l.provider));
  assert.ok(providers.has('netlify'));
  assert.ok(providers.has('supabase'));
  assert.ok(providers.has('brevo'));
  assert.ok(providers.has('github'));

  for (const l of PUBLISHED_REFERENCE_LIMITS) {
    assert.equal(l.checkedAt, '2026-09-27');
    assert.ok(l.sourceUrl.startsWith('https://'));
    assert.ok(l.publishedLimit.length > 0);
  }

  const expectedIds = [
    'netlify-credits',
    'netlify-credit-rates',
    'supabase-database',
    'supabase-storage',
    'supabase-egress-uncached',
    'supabase-egress-cached',
    'supabase-mau',
    'supabase-realtime-messages',
    'supabase-realtime-connections',
    'brevo-daily-emails',
    'brevo-contacts',
    'brevo-free-branding',
    'github-actions',
    'github-actions-cache',
  ];
  for (const id of expectedIds) assert.ok(PUBLISHED_REFERENCE_LIMITS.some((item) => item.id === id), `missing ${id}`);

  assert.equal(DIRECT_DASHBOARD_LINKS.length, 4);
  for (const d of DIRECT_DASHBOARD_LINKS) {
    assert.ok(d.url.startsWith('https://'));
    assert.ok(d.name.length > 0);
  }
});
