import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBrevoMetrics } from '../src/features/admin/metrics/brevo.ts';
import { fetchSupabaseMgmtMetrics } from '../src/features/admin/metrics/supabase-mgmt.ts';
import { PUBLISHED_REFERENCE_LIMITS, DIRECT_DASHBOARD_LINKS } from '../src/features/admin/metrics/reference.ts';

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
  assert.ok(PUBLISHED_REFERENCE_LIMITS.length >= 6);
  const providers = new Set(PUBLISHED_REFERENCE_LIMITS.map(l => l.provider));
  assert.ok(providers.has('netlify'));
  assert.ok(providers.has('supabase'));
  assert.ok(providers.has('brevo'));
  assert.ok(providers.has('github'));

  for (const l of PUBLISHED_REFERENCE_LIMITS) {
    assert.equal(l.checkedAt, '2026-09-24');
    assert.ok(l.sourceUrl.startsWith('https://'));
    assert.ok(l.publishedLimit.length > 0);
  }

  assert.equal(DIRECT_DASHBOARD_LINKS.length, 4);
  for (const d of DIRECT_DASHBOARD_LINKS) {
    assert.ok(d.url.startsWith('https://'));
    assert.ok(d.name.length > 0);
  }
});
