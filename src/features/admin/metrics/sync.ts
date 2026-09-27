import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { MetricSnapshot, SyncBlockedReason, SyncResult } from '../contracts';
import { fetchBrevoMetrics } from './brevo';
import { fetchSupabaseMgmtMetrics } from './supabase-mgmt';
import { fetchInternalActivityMetrics } from './internal';
import { canFetchProviders, unavailableInternalMetrics } from './integrity';

const TTL_MS = 5 * 60 * 1000;

async function readInternalMetrics() {
  return fetchInternalActivityMetrics().catch(() => unavailableInternalMetrics());
}

export async function getOrSyncMetrics(forceRefresh = false): Promise<SyncResult> {
  const supabase = createAdminSupabaseClient();
  const now = Date.now();
  const internalMetrics = await readInternalMetrics();

  let existingSnapshots: MetricSnapshot[] = [];
  let tableAvailable = true;
  try {
    const { data, error } = await supabase.from('provider_metric_snapshots').select('*');
    if (error) {
      tableAvailable = false;
    } else if (Array.isArray(data)) {
      const byKey = new Map<string, MetricSnapshot>();
      for (const item of data as MetricSnapshot[]) {
        const existing = byKey.get(item.metric_key);
        if (
          !existing ||
          (item.fetched_at && (!existing.fetched_at || new Date(item.fetched_at).getTime() > new Date(existing.fetched_at).getTime()))
        ) {
          byKey.set(item.metric_key, item);
        }
      }
      existingSnapshots = Array.from(byKey.values());
    }
  } catch {
    tableAvailable = false;
  }

  const cachedAt = existingSnapshots[0]?.fetched_at ?? null;
  const isFresh =
    !forceRefresh &&
    existingSnapshots.length > 0 &&
    existingSnapshots.every((snapshot) => snapshot.fetched_at && now - new Date(snapshot.fetched_at).getTime() < TTL_MS);

  if (isFresh) {
    return {
      snapshots: existingSnapshots,
      internalMetrics,
      lastSyncedAt: cachedAt,
      isLocked: false,
      syncBlockedReason: null,
    };
  }

  const blocked = (reason: SyncBlockedReason): SyncResult => ({
    snapshots: existingSnapshots,
    internalMetrics,
    lastSyncedAt: cachedAt,
    isLocked: true,
    syncBlockedReason: reason,
  });

  if (!tableAvailable) return blocked('lease_unavailable');

  let leaseToken: string | null = null;
  let leaseError = true;
  let acquired = false;
  let reason: SyncBlockedReason = 'lease_unavailable';
  try {
    const { data: leaseData, error } = await supabase.rpc('acquire_provider_sync_lease', {
      p_provider: 'global',
      p_scope_id: 'admin_sync',
      p_ttl_seconds: 35,
    });
    const lease = leaseData as { acquired?: boolean; lease_token?: string; reason?: string } | null;
    leaseError = Boolean(error) || !lease;
    acquired = !leaseError && lease?.acquired === true && typeof lease.lease_token === 'string';
    if (acquired && lease?.lease_token) {
      leaseToken = lease.lease_token;
    } else {
      acquired = false;
      reason = leaseError ? 'lease_unavailable' : lease?.reason === 'cooldown' ? 'cooldown' : 'locked';
    }
  } catch {
    leaseError = true;
    acquired = false;
    reason = 'lease_unavailable';
  }

  if (!canFetchProviders({ tableAvailable, leaseError, acquired })) {
    return blocked(reason);
  }

  let persisted = false;
  try {
    const [brevoResult, supabaseResult] = await Promise.allSettled([
      fetchBrevoMetrics(),
      fetchSupabaseMgmtMetrics(),
    ]);
    const brevoSnapshots = brevoResult.status === 'fulfilled' ? brevoResult.value : [];
    const supabaseSnapshots = supabaseResult.status === 'fulfilled' ? supabaseResult.value : [];
    const allSnapshots = [...brevoSnapshots, ...supabaseSnapshots];

    if (allSnapshots.length > 0) {
      const upsert = await supabase.from('provider_metric_snapshots').upsert(
        allSnapshots.map((snapshot) => ({
          provider: snapshot.provider,
          scope_type: snapshot.scope_type,
          scope_id: snapshot.scope_id,
          metric_key: snapshot.metric_key,
          display_name: snapshot.display_name,
          environment: snapshot.environment,
          value: snapshot.value,
          unit: snapshot.unit,
          limit_value: snapshot.limit_value,
          remaining_value: snapshot.remaining_value,
          period_start: snapshot.period_start,
          period_end: snapshot.period_end,
          period_timezone: snapshot.period_timezone,
          provider_updated_at: snapshot.provider_updated_at,
          fetched_at: snapshot.fetched_at,
          source_kind: snapshot.source_kind,
          source_url: snapshot.source_url,
          endpoint: snapshot.endpoint,
          field_path: snapshot.field_path,
          status: snapshot.status,
          last_attempt_at: snapshot.last_attempt_at,
          error_code: snapshot.error_code,
          mapping_version: snapshot.mapping_version,
          source_checked_at: snapshot.source_checked_at,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'provider, scope_id, metric_key' },
      );
      persisted = !upsert.error;
    }

    const merged = new Map<string, MetricSnapshot>();
    for (const snapshot of existingSnapshots) {
      merged.set(snapshot.metric_key, { ...snapshot, status: snapshot.status === 'fresh' ? 'stale' : snapshot.status });
    }
    for (const snapshot of allSnapshots) {
      merged.set(snapshot.metric_key, snapshot);
    }
    const fetchedAny = brevoResult.status === 'fulfilled' || supabaseResult.status === 'fulfilled';
    return {
      snapshots: Array.from(merged.values()),
      internalMetrics,
      lastSyncedAt: fetchedAny ? new Date().toISOString() : cachedAt,
      isLocked: false,
      syncBlockedReason: null,
    };
  } finally {
    if (leaseToken) {
      try {
        await supabase.rpc('release_provider_sync_lease', {
          p_provider: 'global',
          p_scope_id: 'admin_sync',
          p_lease_token: leaseToken,
          p_cooldown_seconds: persisted ? 60 : 0,
        });
      } catch {
        // lease_until releases a crashed holder.
      }
    }
  }
}
