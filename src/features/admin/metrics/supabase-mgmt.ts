import type { MetricSnapshot } from '../contracts';

const SUPABASE_MGMT_BASE = 'https://api.supabase.com';
const MAPPING_VERSION = '1.0';
const SOURCE_CHECKED_AT = '2026-09-24';

export async function fetchSupabaseMgmtMetrics(
  token?: string,
  projectRef?: string,
): Promise<MetricSnapshot[]> {
  const now = new Date().toISOString();
  const effectiveToken = token || process.env.SUPABASE_MANAGEMENT_TOKEN?.trim();
  const effectiveRef = projectRef || process.env.SUPABASE_PROJECT_REF?.trim();
  const scopeId = effectiveRef || 'primary';

  if (!effectiveToken || !effectiveRef) {
    return [
      createNotConnectedSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', scopeId),
      createNotConnectedSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', scopeId),
      createNotConnectedSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', scopeId),
      createNotConnectedSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', scopeId),
      createNotConnectedSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', scopeId),
      createNotConnectedSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', scopeId),
      createNotConnectedSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', scopeId),
    ];
  }

  const results: MetricSnapshot[] = [];
  const authHeaders = {
    Authorization: `Bearer ${effectiveToken}`,
    Accept: 'application/json',
  };

  // 1. Fetch Disk Utilization
  try {
    const diskRes = await fetch(`${SUPABASE_MGMT_BASE}/v1/projects/${effectiveRef}/config/disk/util`, {
      method: 'GET',
      headers: authHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (diskRes.status === 401 || diskRes.status === 403) {
      results.push(
        createErrorSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
        createErrorSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
        createErrorSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
      );
    } else if (diskRes.status === 429) {
      results.push(
        createErrorSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', 'rate_limited', 'RATE_LIMITED', scopeId),
        createErrorSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', 'rate_limited', 'RATE_LIMITED', scopeId),
        createErrorSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', 'rate_limited', 'RATE_LIMITED', scopeId),
      );
    } else if (!diskRes.ok) {
      const code = `HTTP_${diskRes.status}`;
      results.push(
        createErrorSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', 'unavailable', code, scopeId),
        createErrorSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', 'unavailable', code, scopeId),
        createErrorSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', 'unavailable', code, scopeId),
      );
    } else {
      const data = await diskRes.json().catch(() => null);
      const metrics = data?.metrics;
      if (!metrics || typeof metrics !== 'object') {
        results.push(
          createErrorSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', 'invalid_response', 'METRICS_OBJECT_MISSING', scopeId),
          createErrorSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', 'invalid_response', 'METRICS_OBJECT_MISSING', scopeId),
          createErrorSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', 'invalid_response', 'METRICS_OBJECT_MISSING', scopeId),
        );
      } else {
        const fsSize = typeof metrics.fs_size_bytes === 'number' ? metrics.fs_size_bytes : null;
        const fsUsed = typeof metrics.fs_used_bytes === 'number' ? metrics.fs_used_bytes : null;
        const fsAvail = typeof metrics.fs_avail_bytes === 'number' ? metrics.fs_avail_bytes : null;

        results.push({
          provider: 'supabase',
          scope_type: 'project',
          scope_id: effectiveRef,
          metric_key: 'supabase-disk-fs-size',
          display_name: 'Supabase DB Filesystem Size',
          environment: 'production',
          value: fsSize,
          unit: 'byte',
          limit_value: null,
          remaining_value: null,
          period_start: null,
          period_end: null,
          period_timezone: null,
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://supabase.com/docs/reference/api/v1-get-disk-utilization',
          endpoint: 'GET /v1/projects/{ref}/config/disk/util',
          field_path: 'metrics.fs_size_bytes',
          status: fsSize !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: fsSize !== null ? null : 'FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });

        results.push({
          provider: 'supabase',
          scope_type: 'project',
          scope_id: effectiveRef,
          metric_key: 'supabase-disk-fs-used',
          display_name: 'Supabase DB Filesystem Used',
          environment: 'production',
          value: fsUsed,
          unit: 'byte',
          limit_value: fsSize,
          remaining_value: fsAvail,
          period_start: null,
          period_end: null,
          period_timezone: null,
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://supabase.com/docs/reference/api/v1-get-disk-utilization',
          endpoint: 'GET /v1/projects/{ref}/config/disk/util',
          field_path: 'metrics.fs_used_bytes',
          status: fsUsed !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: fsUsed !== null ? null : 'FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });

        results.push({
          provider: 'supabase',
          scope_type: 'project',
          scope_id: effectiveRef,
          metric_key: 'supabase-disk-fs-avail',
          display_name: 'Supabase DB Filesystem Available',
          environment: 'production',
          value: fsAvail,
          unit: 'byte',
          limit_value: null,
          remaining_value: null,
          period_start: null,
          period_end: null,
          period_timezone: null,
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://supabase.com/docs/reference/api/v1-get-disk-utilization',
          endpoint: 'GET /v1/projects/{ref}/config/disk/util',
          field_path: 'metrics.fs_avail_bytes',
          status: fsAvail !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: fsAvail !== null ? null : 'FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });
      }
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const code = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    results.push(
      createErrorSnapshot('supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes', 'unavailable', code, scopeId),
      createErrorSnapshot('supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes', 'unavailable', code, scopeId),
      createErrorSnapshot('supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes', 'unavailable', code, scopeId),
    );
  }

  // 2. Fetch Usage API counts
  try {
    const countsRes = await fetch(`${SUPABASE_MGMT_BASE}/v1/projects/${effectiveRef}/analytics/endpoints/usage.api-counts`, {
      method: 'GET',
      headers: authHeaders,
      signal: AbortSignal.timeout(10000),
    });

    if (countsRes.status === 401 || countsRes.status === 403) {
      results.push(
        createErrorSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
        createErrorSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
        createErrorSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
        createErrorSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', 'forbidden', 'INVALID_CREDENTIALS_OR_PERMISSION', scopeId),
      );
    } else if (countsRes.status === 429) {
      results.push(
        createErrorSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', 'rate_limited', 'RATE_LIMITED', scopeId),
        createErrorSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', 'rate_limited', 'RATE_LIMITED', scopeId),
        createErrorSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', 'rate_limited', 'RATE_LIMITED', scopeId),
        createErrorSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', 'rate_limited', 'RATE_LIMITED', scopeId),
      );
    } else if (!countsRes.ok) {
      const code = `HTTP_${countsRes.status}`;
      results.push(
        createErrorSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', 'unavailable', code, scopeId),
        createErrorSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', 'unavailable', code, scopeId),
        createErrorSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', 'unavailable', code, scopeId),
        createErrorSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', 'unavailable', code, scopeId),
      );
    } else {
      const data = await countsRes.json().catch(() => null);
      const row = Array.isArray(data?.result) ? data.result[0] : (data?.result || data);
      if (!row || typeof row !== 'object') {
        results.push(
          createErrorSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', 'invalid_response', 'INVALID_RESPONSE_FORMAT', scopeId),
          createErrorSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', 'invalid_response', 'INVALID_RESPONSE_FORMAT', scopeId),
          createErrorSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', 'invalid_response', 'INVALID_RESPONSE_FORMAT', scopeId),
          createErrorSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', 'invalid_response', 'INVALID_RESPONSE_FORMAT', scopeId),
        );
      } else {
        const authCount = typeof row.total_auth_requests === 'number' ? row.total_auth_requests : null;
        const restCount = typeof row.total_rest_requests === 'number' ? row.total_rest_requests : null;
        const storageCount = typeof row.total_storage_requests === 'number' ? row.total_storage_requests : null;
        const realtimeCount = typeof row.total_realtime_requests === 'number' ? row.total_realtime_requests : null;

        results.push(createApiCountSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'total_auth_requests', authCount, effectiveRef, now));
        results.push(createApiCountSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'total_rest_requests', restCount, effectiveRef, now));
        results.push(createApiCountSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'total_storage_requests', storageCount, effectiveRef, now));
        results.push(createApiCountSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'total_realtime_requests', realtimeCount, effectiveRef, now));
      }
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const code = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    results.push(
      createErrorSnapshot('supabase-api-auth', 'Supabase Auth API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_auth_requests', 'unavailable', code, scopeId),
      createErrorSnapshot('supabase-api-rest', 'Supabase REST API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_rest_requests', 'unavailable', code, scopeId),
      createErrorSnapshot('supabase-api-storage', 'Supabase Storage API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_storage_requests', 'unavailable', code, scopeId),
      createErrorSnapshot('supabase-api-realtime', 'Supabase Realtime API Requests', 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', 'total_realtime_requests', 'unavailable', code, scopeId),
    );
  }

  return results;
}

function createApiCountSnapshot(
  metricKey: string,
  displayName: string,
  fieldPath: string,
  value: number | null,
  scopeId: string,
  now: string,
): MetricSnapshot {
  return {
    provider: 'supabase',
    scope_type: 'project',
    scope_id: scopeId,
    metric_key: metricKey,
    display_name: displayName,
    environment: 'production',
    value,
    unit: 'count',
    limit_value: null,
    remaining_value: null,
    period_start: null,
    period_end: null,
    period_timezone: null,
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: 'https://supabase.com/docs/reference/api/v1-get-project-usage-api-count',
    endpoint: 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts',
    field_path: fieldPath,
    status: value !== null ? 'fresh' : 'invalid_response',
    last_attempt_at: now,
    error_code: value !== null ? null : 'FIELD_MISSING',
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}

function createNotConnectedSnapshot(
  metricKey: string,
  displayName: string,
  unit: 'byte' | 'count',
  endpoint: string,
  fieldPath: string,
  scopeId = 'primary',
): MetricSnapshot {
  const now = new Date().toISOString();
  return {
    provider: 'supabase',
    scope_type: 'project',
    scope_id: scopeId,
    metric_key: metricKey,
    display_name: displayName,
    environment: 'production',
    value: null,
    unit,
    limit_value: null,
    remaining_value: null,
    period_start: null,
    period_end: null,
    period_timezone: null,
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: 'https://supabase.com/docs/reference/api',
    endpoint,
    field_path: fieldPath,
    status: 'not_connected',
    last_attempt_at: now,
    error_code: 'MISSING_MANAGEMENT_CREDENTIALS',
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}

function createErrorSnapshot(
  metricKey: string,
  displayName: string,
  unit: 'byte' | 'count',
  endpoint: string,
  fieldPath: string,
  status: 'forbidden' | 'rate_limited' | 'unavailable' | 'invalid_response',
  errorCode: string,
  scopeId = 'primary',
): MetricSnapshot {
  const now = new Date().toISOString();
  return {
    provider: 'supabase',
    scope_type: 'project',
    scope_id: scopeId,
    metric_key: metricKey,
    display_name: displayName,
    environment: 'production',
    value: null,
    unit,
    limit_value: null,
    remaining_value: null,
    period_start: null,
    period_end: null,
    period_timezone: null,
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: 'https://supabase.com/docs/reference/api',
    endpoint,
    field_path: fieldPath,
    status,
    last_attempt_at: now,
    error_code: errorCode,
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}
