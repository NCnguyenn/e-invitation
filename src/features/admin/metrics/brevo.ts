import type { MetricSnapshot } from '../contracts';

export function bounceTotal(hard: unknown, soft: unknown): number | null {
  if (typeof hard !== 'number' || typeof soft !== 'number') return null;
  return hard + soft;
}

const BREVO_BASE_URL = 'https://api.brevo.com/v3';
const MAPPING_VERSION = '1.0';
const SOURCE_CHECKED_AT = '2026-09-24';

export async function fetchBrevoMetrics(apiKey?: string): Promise<MetricSnapshot[]> {
  const now = new Date().toISOString();
  const effectiveKey = apiKey || process.env.BREVO_API_KEY?.trim();

  if (!effectiveKey) {
    return [
      createNotConnectedSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'primary'),
      createNotConnectedSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'smtp_daily'),
      createNotConnectedSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'smtp_daily'),
      createNotConnectedSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'smtp_daily'),
    ];
  }

  const results: MetricSnapshot[] = [];

  // 1. Fetch Account Details
  try {
    const accountRes = await fetch(`${BREVO_BASE_URL}/account`, {
      method: 'GET',
      headers: {
        'api-key': effectiveKey,
        'accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (accountRes.status === 401 || accountRes.status === 403) {
      results.push(createErrorSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'forbidden', 'INVALID_CREDENTIALS'));
    } else if (accountRes.status === 429) {
      results.push(createErrorSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'rate_limited', 'RATE_LIMITED'));
    } else if (!accountRes.ok) {
      results.push(createErrorSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'unavailable', `HTTP_${accountRes.status}`));
    } else {
      const data = await accountRes.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        results.push(createErrorSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'invalid_response', 'INVALID_JSON'));
      } else {
        // Brevo returns plan as an array of plans
        const plans = Array.isArray(data.plan) ? data.plan : [];
        const emailPlan = plans.find((p: Record<string, unknown>) => p.type === 'free' || p.creditsType === 'sendLimit' || typeof p.credits === 'number') || plans[0];
        const credits = typeof emailPlan?.credits === 'number' ? emailPlan.credits : null;
        const creditsType = typeof emailPlan?.creditsType === 'string' ? emailPlan.creditsType : 'unknown';

        results.push({
          provider: 'brevo',
          scope_type: 'account',
          scope_id: typeof data.email === 'string' ? data.email : 'primary',
          metric_key: 'brevo-credits',
          display_name: `Brevo Email Credits (${creditsType})`,
          environment: 'production',
          value: credits,
          unit: 'credit',
          limit_value: null,
          remaining_value: credits,
          period_start: null,
          period_end: null,
          period_timezone: 'UTC',
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://developers.brevo.com/reference/get-account',
          endpoint: 'GET /v3/account',
          field_path: 'plan[].credits',
          status: credits !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: credits !== null ? null : 'CREDITS_FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });
      }
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    results.push(createErrorSnapshot('brevo-credits', 'Brevo Email Credits', 'credit', 'GET /v3/account', 'plan.credits', 'unavailable', isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'));
  }

  // 2. Fetch Aggregated SMTP Report for Today (UTC)
  const todayUtc = new Date().toISOString().slice(0, 10);
  try {
    const reportRes = await fetch(`${BREVO_BASE_URL}/smtp/statistics/aggregatedReport?startDate=${todayUtc}&endDate=${todayUtc}`, {
      method: 'GET',
      headers: {
        'api-key': effectiveKey,
        'accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (reportRes.status === 401 || reportRes.status === 403) {
      results.push(
        createErrorSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'forbidden', 'INVALID_CREDENTIALS', 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'forbidden', 'INVALID_CREDENTIALS', 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'forbidden', 'INVALID_CREDENTIALS', 'smtp_daily'),
      );
    } else if (reportRes.status === 429) {
      results.push(
        createErrorSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'rate_limited', 'RATE_LIMITED', 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'rate_limited', 'RATE_LIMITED', 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'rate_limited', 'RATE_LIMITED', 'smtp_daily'),
      );
    } else if (!reportRes.ok) {
      const code = `HTTP_${reportRes.status}`;
      results.push(
        createErrorSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'unavailable', code, 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'unavailable', code, 'smtp_daily'),
        createErrorSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'unavailable', code, 'smtp_daily'),
      );
    } else {
      const data = await reportRes.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        results.push(
          createErrorSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'invalid_response', 'INVALID_JSON', 'smtp_daily'),
          createErrorSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'invalid_response', 'INVALID_JSON', 'smtp_daily'),
          createErrorSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'invalid_response', 'INVALID_JSON', 'smtp_daily'),
        );
      } else {
        const requests = typeof data.requests === 'number' ? data.requests : null;
        const delivered = typeof data.delivered === 'number' ? data.delivered : null;
        const totalBounces = bounceTotal(data.hardBounces, data.softBounces);

        results.push({
          provider: 'brevo',
          scope_type: 'account',
          scope_id: 'smtp_daily',
          metric_key: 'brevo-smtp-requests',
          display_name: 'Brevo SMTP Requests (Hôm nay UTC)',
          environment: 'production',
          value: requests,
          unit: 'count',
          limit_value: null,
          remaining_value: null,
          period_start: `${todayUtc}T00:00:00Z`,
          period_end: `${todayUtc}T23:59:59Z`,
          period_timezone: 'UTC',
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://developers.brevo.com/reference/get-aggregated-smtp-report',
          endpoint: 'GET /v3/smtp/statistics/aggregatedReport',
          field_path: 'requests',
          status: requests !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: requests !== null ? null : 'REQUESTS_FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });

        results.push({
          provider: 'brevo',
          scope_type: 'account',
          scope_id: 'smtp_daily',
          metric_key: 'brevo-smtp-delivered',
          display_name: 'Brevo SMTP Delivered (Hôm nay UTC)',
          environment: 'production',
          value: delivered,
          unit: 'count',
          limit_value: null,
          remaining_value: null,
          period_start: `${todayUtc}T00:00:00Z`,
          period_end: `${todayUtc}T23:59:59Z`,
          period_timezone: 'UTC',
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://developers.brevo.com/reference/get-aggregated-smtp-report',
          endpoint: 'GET /v3/smtp/statistics/aggregatedReport',
          field_path: 'delivered',
          status: delivered !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: delivered !== null ? null : 'DELIVERED_FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });

        results.push({
          provider: 'brevo',
          scope_type: 'account',
          scope_id: 'smtp_daily',
          metric_key: 'brevo-smtp-bounces',
          display_name: 'Brevo SMTP Bounces (Hôm nay UTC)',
          environment: 'production',
          value: totalBounces,
          unit: 'count',
          limit_value: null,
          remaining_value: null,
          period_start: `${todayUtc}T00:00:00Z`,
          period_end: `${todayUtc}T23:59:59Z`,
          period_timezone: 'UTC',
          provider_updated_at: null,
          fetched_at: now,
          source_kind: 'api',
          source_url: 'https://developers.brevo.com/reference/get-aggregated-smtp-report',
          endpoint: 'GET /v3/smtp/statistics/aggregatedReport',
          field_path: 'hardBounces + softBounces',
          status: totalBounces !== null ? 'fresh' : 'invalid_response',
          last_attempt_at: now,
          error_code: totalBounces !== null ? null : 'BOUNCES_FIELD_MISSING',
          mapping_version: MAPPING_VERSION,
          source_checked_at: SOURCE_CHECKED_AT,
        });
      }
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    const code = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    results.push(
      createErrorSnapshot('brevo-smtp-requests', 'Brevo SMTP Requests (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'requests', 'unavailable', code, 'smtp_daily'),
      createErrorSnapshot('brevo-smtp-delivered', 'Brevo SMTP Delivered (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'delivered', 'unavailable', code, 'smtp_daily'),
      createErrorSnapshot('brevo-smtp-bounces', 'Brevo SMTP Bounces (Hôm nay UTC)', 'count', 'GET /v3/smtp/statistics/aggregatedReport', 'hardBounces + softBounces', 'unavailable', code, 'smtp_daily'),
    );
  }

  return results;
}

function createNotConnectedSnapshot(
  metricKey: string,
  displayName: string,
  unit: 'credit' | 'count',
  endpoint: string,
  fieldPath: string,
  scopeId = 'primary',
): MetricSnapshot {
  const now = new Date().toISOString();
  return {
    provider: 'brevo',
    scope_type: 'account',
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
    period_timezone: 'UTC',
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: 'https://developers.brevo.com/reference',
    endpoint,
    field_path: fieldPath,
    status: 'not_connected',
    last_attempt_at: now,
    error_code: 'MISSING_API_KEY',
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}

function createErrorSnapshot(
  metricKey: string,
  displayName: string,
  unit: 'credit' | 'count',
  endpoint: string,
  fieldPath: string,
  status: 'forbidden' | 'rate_limited' | 'unavailable' | 'invalid_response',
  errorCode: string,
  scopeId = 'primary',
): MetricSnapshot {
  const now = new Date().toISOString();
  return {
    provider: 'brevo',
    scope_type: 'account',
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
    period_timezone: 'UTC',
    provider_updated_at: null,
    fetched_at: now,
    source_kind: 'api',
    source_url: 'https://developers.brevo.com/reference',
    endpoint,
    field_path: fieldPath,
    status,
    last_attempt_at: now,
    error_code: errorCode,
    mapping_version: MAPPING_VERSION,
    source_checked_at: SOURCE_CHECKED_AT,
  };
}
