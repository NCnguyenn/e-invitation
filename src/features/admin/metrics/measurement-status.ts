import type { MetricSnapshot } from '../contracts';

export const MEASUREMENT_TTL_MS = 5 * 60 * 1000;

export function validMeasurement(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function snapshotAtTime(snapshot: MetricSnapshot, now = Date.now()): MetricSnapshot {
  if (!validMeasurement(snapshot.value)) return { ...snapshot, value: null, status: snapshot.status === 'fresh' ? 'invalid_response' : snapshot.status };
  if (snapshot.status !== 'fresh') return snapshot;
  const fetched = Date.parse(snapshot.fetched_at);
  const end = snapshot.period_end ? Date.parse(snapshot.period_end) : null;
  const start = snapshot.period_start ? Date.parse(snapshot.period_start) : null;
  const expired = !Number.isFinite(fetched) || fetched > now || now - fetched >= MEASUREMENT_TTL_MS ||
    (end !== null && (!Number.isFinite(end) || end <= now)) ||
    (start !== null && (!Number.isFinite(start) || start > now));
  return expired ? { ...snapshot, status: 'stale' } : snapshot;
}

export function measuredUsagePercent(snapshot: MetricSnapshot, now = Date.now()): number | null {
  const current = snapshotAtTime(snapshot, now);
  if (current.status !== 'fresh' || current.source_kind !== 'api' || !validMeasurement(current.value) ||
    !validMeasurement(current.limit_value) || current.limit_value === 0 || !current.scope_id || /unknown|unconfigured/i.test(current.scope_id)) return null;
  const instantFilesystem = current.metric_key === 'supabase-disk-fs-used';
  const start = Date.parse(current.period_start || '');
  const end = Date.parse(current.period_end || '');
  if (!instantFilesystem && (!current.period_timezone || !Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now || start >= end)) return null;
  const result = current.value / current.limit_value * 100;
  return Number.isFinite(result) ? result : null;
}

export interface ProviderMeasurementSummary {
  totalCount: number;
  measuredCount: number;
  freshCount: number;
  unavailableCount: number;
  allFresh: boolean;
  allNotConnected: boolean;
}

export function summarizeProviderMeasurements(
  snapshots: MetricSnapshot[],
  now = Date.now(),
): ProviderMeasurementSummary {
  snapshots = snapshots.map(snapshot => snapshotAtTime(snapshot, now));
  const measuredCount = snapshots.filter((snapshot) => snapshot.value !== null).length;
  const freshCount = snapshots.filter(
    (snapshot) => snapshot.status === 'fresh' && snapshot.value !== null,
  ).length;
  const staleOrMeasuredErrorCount = snapshots.filter(
    (snapshot) => snapshot.value !== null && snapshot.status !== 'fresh',
  ).length;

  return {
    totalCount: snapshots.length,
    measuredCount,
    freshCount,
    unavailableCount: snapshots.length - freshCount - staleOrMeasuredErrorCount,
    allFresh: snapshots.length > 0 && freshCount === snapshots.length,
    allNotConnected: snapshots.length > 0 && snapshots.every((snapshot) => snapshot.status === 'not_connected'),
  };
}
