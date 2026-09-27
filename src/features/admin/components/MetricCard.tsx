'use client';

import React from 'react';
import type { MetricSnapshot } from '../contracts';
import { measuredUsagePercent, snapshotAtTime } from '../metrics/measurement-status';
import { useMeasurementClock } from './useMeasurementClock';
import styles from './admin.module.css';

interface MetricCardProps {
  snapshot: MetricSnapshot;
}

const STATUS_LABELS: Record<MetricSnapshot['status'], { text: string; className: string }> = {
  fresh: { text: 'API có số đo', className: styles.badgeFresh },
  stale: { text: 'Số đo đã cũ', className: styles.badgeStale },
  not_connected: { text: 'Chưa kết nối', className: styles.badgeNotConnected },
  forbidden: { text: 'API từ chối quyền', className: styles.badgeForbidden },
  rate_limited: { text: 'API giới hạn lượt gọi', className: styles.badgeRateLimited },
  unavailable: { text: 'API không phản hồi', className: styles.badgeUnavailable },
  invalid_response: { text: 'Thiếu dữ liệu API', className: styles.badgeInvalid },
  dashboard_only: { text: 'Chỉ xem Dashboard', className: styles.badgeNotConnected },
  not_applicable: { text: 'Không áp dụng', className: styles.badgeNotConnected },
};

function formatMetricNumber(value: number | null, unit: MetricSnapshot['unit']) {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return { formatted: '—', unitText: 'Chưa có số đo' };
  }

  if (unit === 'byte') {
    const mib = value / (1024 * 1024);
    return mib >= 1024
      ? { formatted: (mib / 1024).toFixed(2), unitText: 'GiB' }
      : { formatted: mib.toFixed(2), unitText: 'MiB' };
  }

  if (unit === 'count') return { formatted: value.toLocaleString('vi-VN'), unitText: 'lượt' };
  if (unit === 'credit') return { formatted: value.toLocaleString('vi-VN'), unitText: 'credits' };
  if (unit === 'percentage') return { formatted: `${value.toFixed(1)}%`, unitText: '' };
  if (unit === 'boolean') return { formatted: value ? 'Có' : 'Không', unitText: '' };
  return { formatted: String(value), unitText: '' };
}

export function MetricCard({ snapshot }: MetricCardProps) {
  const now = useMeasurementClock();
  snapshot = snapshotAtTime(snapshot, now);
  const status = STATUS_LABELS[snapshot.status];
  const metric = formatMetricNumber(snapshot.value, snapshot.unit);
  const measuredPercent = measuredUsagePercent(snapshot, now);
  const denominatorLabel = snapshot.metric_key === 'supabase-disk-fs-used'
    ? 'Mức dùng filesystem tại thời điểm đo · không phải quota gói'
    : 'Mức dùng so với giới hạn do API báo';

  return (
    <article className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{snapshot.display_name.replace(/hôm nay|today/gi, 'theo kỳ đo')}</h3>
        <span className={`${styles.badge} ${status.className}`}>{status.text}</span>
      </div>

      <div className={styles.cardValueWrap}>
        <span className={styles.cardValue}>{metric.formatted}</span>
        {metric.unitText ? <span className={styles.cardUnit}>{metric.unitText}</span> : null}
      </div>

      {measuredPercent !== null ? (
        <div className={styles.measuredUsage}>
          <div className={styles.measuredUsageMeta}>
            <span>{denominatorLabel}</span>
            <strong>{measuredPercent.toFixed(1)}%</strong>
          </div>
          <div className={styles.progressTrack} aria-label={`${denominatorLabel}: ${measuredPercent.toFixed(1)}%`}>
            <span className={styles.progressFill} style={{ width: `${Math.min(100, measuredPercent)}%` }} />
          </div>
        </div>
      ) : null}

      <div className={styles.cardMeta}>
        <span>{snapshot.source_kind === 'api' ? 'Nguồn: API nền tảng' : `Nguồn: ${snapshot.source_kind}`}</span>
        <span>Phạm vi: {snapshot.scope_type} / {snapshot.scope_id}</span>
        <span>Môi trường: {snapshot.environment}</span>
        <span>Còn lại: {snapshot.status === 'fresh' && snapshot.remaining_value !== null && Number.isFinite(snapshot.remaining_value) && snapshot.remaining_value >= 0
          ? `${formatMetricNumber(snapshot.remaining_value, snapshot.unit).formatted} ${formatMetricNumber(snapshot.remaining_value, snapshot.unit).unitText}`
          : 'Chưa có số đo API xác nhận'}</span>
        <span>Kỳ đo: {snapshot.period_start || snapshot.period_end
          ? `${snapshot.period_start || '—'} → ${snapshot.period_end || '—'}${snapshot.period_timezone ? ` (${snapshot.period_timezone})` : ''}`
          : 'Nền tảng không trả kỳ đo'}</span>
        {snapshot.endpoint ? <span>Endpoint: <code>{snapshot.endpoint}</code></span> : null}
        {snapshot.error_code ? <span className={styles.metricError}>Mã lỗi: {snapshot.error_code}</span> : null}
        <div className={styles.cardMetaFooter}>
          <span>Lấy số đo: {snapshot.value !== null && snapshot.fetched_at && !Number.isNaN(new Date(snapshot.fetched_at).getTime())
            ? new Date(snapshot.fetched_at).toLocaleString('vi-VN')
            : '—'}</span>
          <span>Lần thử gần nhất: {snapshot.last_attempt_at && Number.isFinite(Date.parse(snapshot.last_attempt_at)) ? new Date(snapshot.last_attempt_at).toLocaleString('vi-VN') : '—'}</span>
          {snapshot.source_url ? (
            <a href={snapshot.source_url} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
              Nguồn đo ↗
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
