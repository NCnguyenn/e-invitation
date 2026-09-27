import type { MetricSnapshot } from '../contracts';
import { metricEnvironment, brevoMetricScope } from './context.ts';

const definitions = [
  ['brevo', 'brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan[].credits'],
  ['brevo', 'brevo-smtp-requests', 'Brevo SMTP Requests', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests'],
  ['brevo', 'brevo-smtp-delivered', 'Brevo SMTP Delivered', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered'],
  ['brevo', 'brevo-smtp-bounces', 'Brevo SMTP Bounces', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces'],
  ['supabase', 'supabase-disk-fs-size', 'Supabase DB Filesystem Size', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_size_bytes'],
  ['supabase', 'supabase-disk-fs-used', 'Supabase DB Filesystem Used', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_used_bytes'],
  ['supabase', 'supabase-disk-fs-avail', 'Supabase DB Filesystem Available', 'byte', 'GET /v1/projects/{ref}/config/disk/util', 'metrics.fs_avail_bytes'],
  ...(['auth', 'rest', 'storage', 'realtime'] as const).map(name => ['supabase', `supabase-api-${name}`, `Supabase ${name} API Requests`, 'count', 'GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts', `total_${name}_requests`] as const),
] as const;

/** Complete schema for failed/omitted responses; these rows never invent measurements. */
export function expectedSnapshots(): MetricSnapshot[] {
  const now = new Date().toISOString();
  return definitions.map(([provider, metric_key, display_name, unit, endpoint, field_path]) => ({
    provider, metric_key, display_name, unit, endpoint, field_path,
    scope_type: provider === 'brevo' ? 'account' : 'project',
    scope_id: provider === 'brevo'
      ? (process.env.BREVO_API_KEY?.trim() ? brevoMetricScope(process.env.BREVO_API_KEY) : 'primary')
      : process.env.SUPABASE_PROJECT_REF?.trim() || 'primary',
    environment: metricEnvironment(), value: null, limit_value: null, remaining_value: null,
    period_start: null, period_end: null, period_timezone: null, provider_updated_at: null,
    fetched_at: now, source_kind: 'api', source_url: provider === 'brevo'
      ? 'https://developers.brevo.com/reference' : 'https://supabase.com/docs/reference/api',
    status: 'unavailable', last_attempt_at: now, error_code: 'SOURCE_RESPONSE_MISSING',
    mapping_version: '2.0', source_checked_at: '2026-09-24',
  }));
}
