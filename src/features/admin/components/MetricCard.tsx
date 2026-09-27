'use client';

import React from 'react';
import type { MetricSnapshot } from '../contracts';
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
  if (value === null || !Number.isFinite(value)) {
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
  const status = STATUS_LABELS[snapshot.status];
  const metric = formatMetricNumber(snapshot.value, snapshot.unit);
  const hasMeasuredLimit =
    typeof snapshot.value === 'number' &&
    typeof snapshot.limit_value === 'number' &&
    snapshot.limit_value > 0;
  const measuredPercent = hasMeasuredLimit
    ? Math.min(100, Math.max(0, (snapshot.value! / snapshot.limit_value!) * 100))
    : null;
  const denominatorLabel = snapshot.metric_key === 'supabase-disk-fs-used'
    ? 'Mức dùng so với filesystem do API báo'
    : 'Mức dùng so với giới hạn do API báo';

  return (
    <article className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{snapshot.display_name}</h3>
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
            <span className={styles.progressFill} style={{ width: `${measuredPercent}%` }} />
          </div>
        </div>
      ) : null}

      <div className={styles.cardMeta}>
        <span>{snapshot.source_kind === 'api' ? 'Nguồn: API nền tảng' : `Nguồn: ${snapshot.source_kind}`}</span>
        {snapshot.endpoint ? <span>Endpoint: <code>{snapshot.endpoint}</code></span> : null}
        {snapshot.error_code ? <span className={styles.metricError}>Mã lỗi: {snapshot.error_code}</span> : null}
        <div className={styles.cardMetaFooter}>
          <span>Cập nhật: {snapshot.fetched_at && !Number.isNaN(new Date(snapshot.fetched_at).getTime())
            ? new Date(snapshot.fetched_at).toLocaleString('vi-VN')
            : '—'}</span>
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
