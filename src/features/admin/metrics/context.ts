import { createHash } from 'node:crypto';

type EnvironmentInput = Record<string, string | undefined>;

export function metricEnvironment(env: EnvironmentInput = process.env): 'production' | 'staging' | 'local' {
  const explicit = env.METRICS_ENVIRONMENT?.trim().toLowerCase();
  if (explicit === 'production' || explicit === 'staging' || explicit === 'local') return explicit;

  const deployContext = (env.CONTEXT || env.VERCEL_ENV || '').trim().toLowerCase();
  if (deployContext === 'production') return 'production';
  if (deployContext === 'deploy-preview' || deployContext === 'preview' || deployContext === 'branch-deploy') return 'staging';
  if (env.NODE_ENV === 'production') return 'production';
  return 'local';
}

export function brevoMetricScope(apiKey?: string): string {
  const normalized = apiKey?.trim();
  if (!normalized) return 'not-connected';
  return `account-${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}
