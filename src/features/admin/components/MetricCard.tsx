'use client';

import React from 'react';
import type { MetricSnapshot } from '../contracts';
import styles from './admin.module.css';

interface MetricCardProps {
  snapshot: MetricSnapshot;
}

export function MetricCard({ snapshot }: MetricCardProps) {
  const {
    display_name,
    value,
    unit,
    status,
    endpoint,
    source_url,
    fetched_at,
    error_code,
    limit_value,
  } = snapshot;

  const statusLabelMap: Record<string, { text: string; className: string }> = {
    fresh: { text: 'Hoạt động', className: styles.badgeFresh },
    stale: { text: 'Dữ liệu cũ', className: styles.badgeStale },
    not_connected: { text: 'Chưa kết nối', className: styles.badgeNotConnected },
    forbidden: { text: 'Bị từ chối (403)', className: styles.badgeForbidden },
    rate_limited: { text: 'Giới hạn (429)', className: styles.badgeRateLimited },
    unavailable: { text: 'Không phản hồi', className: styles.badgeUnavailable },
    invalid_response: { text: 'Phản hồi sai cấu trúc', className: styles.badgeInvalid },
    dashboard_only: { text: 'Chỉ xem Dashboard', className: styles.badgeNotConnected },
    not_applicable: { text: 'Không áp dụng', className: styles.badgeNotConnected },
  };

  const statusBadge = statusLabelMap[status] || { text: status, className: styles.badgeNotConnected };

  function formatMetricNumber(num: number | null | undefined, metricUnit: string): { formatted: string; unitText: string } {
    if (num === null || num === undefined) {
      if (status === 'not_connected') return { formatted: '—', unitText: '(Chưa kết nối)' };
      if (status === 'forbidden') return { formatted: '—', unitText: '(Sai quyền)' };
      if (status === 'rate_limited') return { formatted: '—', unitText: '(Rate limited)' };
      if (status === 'unavailable') return { formatted: '—', unitText: '(Không phản hồi)' };
      return { formatted: '—', unitText: '(Thiếu trường)' };
    }

    if (metricUnit === 'byte') {
      const mib = num / (1024 * 1024);
      if (mib >= 1024) {
        return { formatted: (mib / 1024).toFixed(2), unitText: 'GiB' };
      }
      return { formatted: mib.toFixed(2), unitText: 'MiB' };
    }

    if (metricUnit === 'count') {
      return { formatted: Number(num).toLocaleString('vi-VN'), unitText: 'lượt' };
    }

    if (metricUnit === 'credit') {
      return { formatted: Number(num).toLocaleString('vi-VN'), unitText: 'credits' };
    }

    if (metricUnit === 'percentage') {
      return { formatted: `${num.toFixed(1)}%`, unitText: '' };
    }

    return { formatted: String(num), unitText: '' };
  }

  const { formatted, unitText } = formatMetricNumber(value, unit);
  const formattedLimit = limit_value ? formatMetricNumber(limit_value, unit) : null;

  return (
    <div className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{display_name}</h3>
        <span className={`${styles.badge} ${statusBadge.className}`}>{statusBadge.text}</span>
      </div>

      <div className={styles.cardValueWrap}>
        <span className={styles.cardValue}>{formatted}</span>
        <span className={styles.cardUnit}>{unitText}</span>
      </div>

      {limit_value && typeof value === 'number' && limit_value > 0 ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
            <span>Đã dùng: {((value / limit_value) * 100).toFixed(1)}%</span>
            <span>Filesystem đo được: {formattedLimit?.formatted} {formattedLimit?.unitText}</span>
          </div>
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, (value / limit_value) * 100))}%`,
                background: (value / limit_value) > 0.9 ? '#ef4444' : '#2563eb',
              }}
            />
          </div>
        </div>
      ) : null}

      <div className={styles.cardMeta}>
        {endpoint ? <span>Endpoint: <code>{endpoint}</code></span> : null}
        {error_code ? <span style={{ color: '#ef4444' }}>Mã lỗi: {error_code}</span> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
          <span>Cập nhật: {fetched_at && !isNaN(new Date(fetched_at).getTime()) ? new Date(fetched_at).toLocaleTimeString('vi-VN') : '—'}</span>
          {source_url ? (
            <a href={source_url} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
              Tài liệu ↗
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
