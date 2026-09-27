import type { MetricSnapshot } from '../contracts';
import { metricEnvironment, brevoMetricScope } from './context.ts';

const BASE = 'https://api.brevo.com/v3';
const MAPPING_VERSION = '2.0';
const SOURCE_CHECKED_AT = '2026-09-24';
const DEFINITIONS = [
  ['brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan[].credits'],
  ['brevo-smtp-requests', 'Brevo SMTP Requests', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests'],
  ['brevo-smtp-delivered', 'Brevo SMTP Delivered', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered'],
  ['brevo-smtp-bounces', 'Brevo SMTP Bounces', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces'],
] as const;
type Definition = typeof DEFINITIONS[number];
type Period = [string | null, string | null];

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function bounceTotal(hard: unknown, soft: unknown): number | null {
  if (!finite(hard) || !finite(soft)) return null;
  const total = hard + soft;
  return finite(total) ? total : null;
}

function snapshot(
  definition: Definition,
  scope: string,
  status: MetricSnapshot['status'],
  error: string | null,
  value: number | null = null,
  period: Period = [null, null],
): MetricSnapshot {
  const [metric_key, display_name, unit, endpoint, field_path] = definition;
  const now = new Date().toISOString();
  return {
    provider: 'brevo',
    scope_type: 'account',
    scope_id: scope,
    metric_key,
    display_name,
    environment: metricEnvironment(),
    value,
    unit,
    limit_value: null,
    remaining_value: null,
    period_start: period[0],
    period_end: period[1],
    period_timezone: period[0] ? 'UTC' : null,
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: metric_key === 'brevo-credits'
      ? 'https://developers.brevo.com/reference/get-account'
      : 'https://developers.brevo.com/reference/get-aggregated-smtp-report',
    endpoint,
    field_path,
    status,
    last_attempt_at: now,
    error_code: error,
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}

function httpError(status: number): [MetricSnapshot['status'], string] {
  if (status === 401 || status === 403) return ['forbidden', 'INVALID_CREDENTIALS'];
  if (status === 429) return ['rate_limited', 'RATE_LIMITED'];
  return ['unavailable', `HTTP_${status}`];
}

function networkError(error: unknown): string {
  return error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR';
}

export async function fetchBrevoMetrics(apiKey?: string): Promise<MetricSnapshot[]> {
  const key = (apiKey !== undefined ? apiKey : process.env.BREVO_API_KEY)?.trim();
  const scope = key ? brevoMetricScope(key) : 'primary';
  if (!key) return DEFINITIONS.map(def => snapshot(def, scope, 'not_connected', 'MISSING_API_KEY'));

  const results: MetricSnapshot[] = [];
  const headers = { 'api-key': key, accept: 'application/json' };
  try {
    const response = await fetch(`${BASE}/account`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const [status, code] = httpError(response.status);
      results.push(snapshot(DEFINITIONS[0], scope, status, code));
    } else {
      const data = await response.json().catch(() => null);
      const plans: unknown[] = Array.isArray(data?.plan) ? data.plan : [];
      const emailPlans = plans.filter((plan): plan is Record<string, unknown> =>
        !!plan && typeof plan === 'object' &&
        'type' in plan && plan.type === 'free' &&
        'creditsType' in plan && plan.creditsType === 'sendLimit');
      const plan = emailPlans.length === 1 ? emailPlans[0] : null;
      const value = finite(plan?.credits) ? plan.credits : null;
      results.push(snapshot(DEFINITIONS[0], scope,
        value === null ? 'invalid_response' : 'fresh',
        value === null ? 'EMAIL_PLAN_AMBIGUOUS_OR_INVALID' : null, value));
    }
  } catch (error) {
    results.push(snapshot(DEFINITIONS[0], scope, 'unavailable', networkError(error)));
  }

  const reportDefinitions = DEFINITIONS.slice(1);
  try {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const response = await fetch(`${BASE}/smtp/statistics/aggregatedReport?startDate=${todayUtc}&endDate=${todayUtc}`, {
      headers, cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const [status, code] = httpError(response.status);
      results.push(...reportDefinitions.map(def => snapshot(def, scope, status, code)));
    } else {
      const data = await response.json().catch(() => null);
      const start = `${todayUtc}T00:00:00Z`;
      const end = new Date(Date.parse(start) + 24 * 60 * 60 * 1000).toISOString();
      const values = [
        finite(data?.requests) ? data.requests : null,
        finite(data?.delivered) ? data.delivered : null,
        bounceTotal(data?.hardBounces, data?.softBounces),
      ];
      reportDefinitions.forEach((def, index) => {
        const value = values[index];
        results.push(snapshot(def, scope, value === null ? 'invalid_response' : 'fresh',
          value === null ? 'FIELD_MISSING' : null, value, [start, end]));
      });
    }
  } catch (error) {
    results.push(...reportDefinitions.map(def => snapshot(def, scope, 'unavailable', networkError(error))));
  }
  return results;
}
