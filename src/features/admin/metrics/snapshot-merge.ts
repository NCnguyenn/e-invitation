import type { MetricSnapshot } from '../contracts';

export function snapshotKey(s: MetricSnapshot): string {
  return [s.provider, s.scope_type, s.scope_id, s.environment, s.metric_key].join(':');
}
export function hasMeasurement(s: MetricSnapshot): boolean {
  return (s.status === 'fresh' || s.status === 'stale') &&
    typeof s.value === 'number' && Number.isFinite(s.value) && s.value >= 0 &&
    Number.isFinite(Date.parse(s.fetched_at));
}
export function mergeMetricSnapshots(existing: MetricSnapshot[], incoming: MetricSnapshot[]): MetricSnapshot[] {
  const merged = new Map(existing.map(s => [snapshotKey(s), s]));
  for (const next of incoming) {
    const key = snapshotKey(next);
    const previous = merged.get(key);
    const compatible = previous && previous.mapping_version === next.mapping_version &&
      previous.unit === next.unit && previous.field_path === next.field_path &&
      previous.endpoint === next.endpoint && previous.source_kind === next.source_kind;
    if (compatible && hasMeasurement(previous) && !hasMeasurement(next)) {
      merged.set(key, { ...previous, status: 'stale', last_attempt_at: next.last_attempt_at, error_code: next.error_code });
    } else {
      merged.set(key, next);
    }
  }
  return [...merged.values()];
}
export function newestFetchedAt(snapshots: MetricSnapshot[]): string | null {
  return snapshots.reduce<string | null>((best, s) => {
    if (!hasMeasurement(s)) return best;
    return !best || Date.parse(s.fetched_at) > Date.parse(best) ? s.fetched_at : best;
  }, null);
}
