import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { MetricSnapshot, SyncBlockedReason, SyncResult } from '../contracts';
import { fetchBrevoMetrics } from './brevo';
import { fetchSupabaseMgmtMetrics } from './supabase-mgmt';
import { fetchInternalActivityMetrics } from './internal';
import { unavailableInternalMetrics } from './integrity';
import { hasMeasurement, mergeMetricSnapshots, newestFetchedAt, snapshotKey } from './snapshot-merge';
import { expectedSnapshots } from './sync-schema';

const TTL_MS = 5 * 60 * 1000;
const fields = ['provider','scope_type','scope_id','metric_key','display_name','environment','value','unit',
  'limit_value','remaining_value','period_start','period_end','period_timezone','provider_updated_at',
  'fetched_at','source_kind','source_url','endpoint','field_path','status','last_attempt_at','error_code',
  'mapping_version','source_checked_at'] as const;
function sanitize(snapshot: MetricSnapshot): MetricSnapshot {
  const clean = Object.fromEntries(fields.map(field => [field, snapshot[field]])) as unknown as MetricSnapshot;
  for (const field of ['value','limit_value','remaining_value'] as const) {
    if (typeof clean[field] !== 'number' || !Number.isFinite(clean[field]) || clean[field]! < 0) clean[field] = null;
  }
  if (clean.status === 'fresh' && !hasMeasurement(clean)) {
    clean.status = 'invalid_response'; clean.error_code = 'INVALID_MEASUREMENT';
    clean.value = null; clean.limit_value = null; clean.remaining_value = null;
  }
  return clean;
}
function expire(snapshot: MetricSnapshot): MetricSnapshot {
  if (snapshot.status !== 'fresh') return snapshot;
  const age = Date.now() - Date.parse(snapshot.fetched_at);
  const periodEnded = snapshot.period_end !== null &&
    (!Number.isFinite(Date.parse(snapshot.period_end)) || Date.parse(snapshot.period_end) <= Date.now());
  return age < 0 || age >= TTL_MS || periodEnded ? { ...snapshot, status: 'stale' } : snapshot;
}
export async function getOrSyncMetrics(forceRefresh = false): Promise<SyncResult> {
  const db = createAdminSupabaseClient();
  const internalMetrics = await fetchInternalActivityMetrics().catch(() => unavailableInternalMetrics());
  const expected = expectedSnapshots();
  const schema = new Map(expected.map(s => [snapshotKey(s), s]));
  const matches = (s: MetricSnapshot) => {
    const def = schema.get(snapshotKey(s));
    return def && s.mapping_version === def.mapping_version && s.unit === def.unit &&
      s.field_path === def.field_path && s.endpoint === def.endpoint && s.source_kind === def.source_kind;
  };
  let cached: MetricSnapshot[] = [];
  let available = true;
  try {
    const { data, error } = await db.from('provider_metric_snapshots').select(fields.join(','));
    if (error || !Array.isArray(data)) available = false;
    else {
      const unique = new Map<string, MetricSnapshot>();
      for (const raw of data as unknown as MetricSnapshot[]) {
        if (!matches(raw)) continue;
        const s = expire(sanitize(raw)), prior = unique.get(snapshotKey(s));
        if (!prior || Date.parse(s.last_attempt_at || s.fetched_at) > Date.parse(prior.last_attempt_at || prior.fetched_at)) unique.set(snapshotKey(s), s);
      }
      cached = [...unique.values()];
    }
  } catch { available = false; }
  const cachedAt = newestFetchedAt(cached);
  const blocked = (reason: SyncBlockedReason): SyncResult => {
    const byKey = new Map(cached.map(s => [snapshotKey(s), expire(s)]));
    return {
      snapshots: expected.map(def => byKey.get(snapshotKey(def)) ?? { ...def, error_code: 'SYNC_BLOCKED' }),
      internalMetrics,
      lastSyncedAt: cachedAt,
      isLocked: true,
      syncBlockedReason: reason,
    };
  };
  if (!forceRefresh && cached.length === expected.length && cached.every(s => s.status === 'fresh')) {
    return { snapshots: cached, internalMetrics, lastSyncedAt: cachedAt, isLocked: false, syncBlockedReason: null };
  }
  if (!available) return blocked('lease_unavailable');
  let token: string;
  try {
    const { data, error } = await db.rpc('acquire_provider_sync_lease', {
      p_provider: 'global', p_scope_id: 'admin_sync', p_ttl_seconds: 35,
    });
    if (error || !data) return blocked('lease_unavailable');
    if (data.acquired !== true || typeof data.lease_token !== 'string' || !data.lease_token) {
      return blocked(data.reason === 'cooldown' ? 'cooldown' : 'locked');
    }
    token = data.lease_token;
  } catch { return blocked('lease_unavailable'); }
  try {
    const results = await Promise.allSettled([fetchBrevoMetrics(), fetchSupabaseMgmtMetrics()]);
    const incoming: MetricSnapshot[] = [];
    for (const [i, provider] of (['brevo', 'supabase'] as const).entries()) {
      const result = results[i];
      const rows = result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.filter(matches).map(sanitize) : [];
      const byKey = new Map(rows.map(s => [snapshotKey(s), s]));
      const errorCode = result.status === 'rejected'
        ? (result.reason instanceof Error && result.reason.name === 'TimeoutError' ? 'TIMEOUT' : 'SOURCE_FETCH_FAILED')
        : 'SOURCE_RESPONSE_MISSING';
      for (const def of expected.filter(s => s.provider === provider)) {
        incoming.push(byKey.get(snapshotKey(def)) || { ...def, error_code: errorCode, last_attempt_at: new Date().toISOString() });
      }
    }
    const merged = mergeMetricSnapshots(cached, incoming).map(sanitize).map(expire);
    try {
      const { data, error } = await db.rpc('persist_provider_metric_snapshots', { p_lease_token: token, p_snapshots: merged });
      if (error || data !== true) return blocked('persistence_failed');
    } catch { return blocked('persistence_failed'); }
    return { snapshots: merged, internalMetrics, lastSyncedAt: newestFetchedAt(merged), isLocked: false, syncBlockedReason: null };
  } finally {
    try {
      await db.rpc('release_provider_sync_lease', { p_provider: 'global', p_scope_id: 'admin_sync',
        p_lease_token: token, p_cooldown_seconds: 60 });
    } catch { /* The lease expires; acquisition also enforces a cooldown. */ }
  }
}
