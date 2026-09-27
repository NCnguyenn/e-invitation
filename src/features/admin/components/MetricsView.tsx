'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { MetricSnapshot, InternalActivityMetrics } from '../contracts';
import { PUBLISHED_REFERENCE_LIMITS, DIRECT_DASHBOARD_LINKS } from '../metrics/reference';
import { MetricCard } from './MetricCard';
import styles from './admin.module.css';

interface MetricsViewProps {
  initialSnapshots: MetricSnapshot[];
  initialInternalMetrics: InternalActivityMetrics;
  initialSyncedAt: string | null;
  initialSyncBlockedReason?: string | null;
  onRefreshTriggered?: () => void;
}

const REFRESH_COOLDOWN_SEC = 60;
const AUTO_REFRESH_INTERVAL_SEC = 300; // 5 minutes

export function MetricsView({
  initialSnapshots,
  initialInternalMetrics,
  initialSyncedAt,
  initialSyncBlockedReason = null,
  onRefreshTriggered,
}: MetricsViewProps) {
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>(initialSnapshots);
  const [internalMetrics, setInternalMetrics] = useState<InternalActivityMetrics>(initialInternalMetrics);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialSyncedAt);
  const [syncBlockedReason, setSyncBlockedReason] = useState<string | null>(initialSyncBlockedReason);

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_SEC);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isVisibleRef = useRef(true);

  // Tab visibility check to pause countdown when user switches away
  useEffect(() => {
    function handleVisibilityChange() {
      isVisibleRef.current = document.visibilityState === 'visible';
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer loop for cooldown & countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));

      if (isVisibleRef.current) {
        setAutoRefreshCountdown(prev => {
          if (prev <= 1) {
            handleRefresh(false);
            return AUTO_REFRESH_INTERVAL_SEC;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function handleRefresh(force = true) {
    if (isRefreshing || (force && cooldownSeconds > 0)) return;

    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/metrics?refresh=${force ? 'true' : 'false'}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Không thể đồng bộ số đo.');
      }

      const data = await res.json();
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
      if (data.internalMetrics) setInternalMetrics(data.internalMetrics);
      setLastSyncedAt(typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null);
      setSyncBlockedReason(typeof data.syncBlockedReason === 'string' ? data.syncBlockedReason : null);

      if (force) {
        setCooldownSeconds(REFRESH_COOLDOWN_SEC);
        setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL_SEC);
      }
      if (onRefreshTriggered) onRefreshTriggered();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi đồng bộ.');
    } finally {
      setIsRefreshing(false);
    }
  }

  // Provider health check
  const brevoSnapshot = snapshots.find(s => s.provider === 'brevo');
  const supabaseSnapshot = snapshots.find(s => s.provider === 'supabase');

  const isBrevoHealthy = brevoSnapshot ? brevoSnapshot.status === 'fresh' || brevoSnapshot.status === 'stale' : false;
  const isSupabaseDbHealthy = internalMetrics.totalHosts !== null;

  return (
    <div>
      {/* Top Sync & Action Bar */}
      <div className={styles.sectionCard} style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#0f172a', fontWeight: 600 }}>
              Cập nhật gần nhất: <span style={{ color: '#4f46e5' }}>{lastSyncedAt && !isNaN(new Date(lastSyncedAt).getTime()) ? new Date(lastSyncedAt).toLocaleString('vi-VN') : '—'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
              Tự động làm mới sau: <strong>{Math.floor(autoRefreshCountdown / 60)}p {autoRefreshCountdown % 60}s</strong>
              {syncBlockedReason ? <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>({syncBlockedReason})</span> : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {errorMessage ? <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errorMessage}</span> : null}
            <button
              className={styles.btnPrimary}
              onClick={() => handleRefresh(true)}
              disabled={isRefreshing || cooldownSeconds > 0}
            >
              {isRefreshing ? 'Đang đồng bộ…' : cooldownSeconds > 0 ? `Chờ ${cooldownSeconds}s` : '🔄 Làm mới số đo'}
            </button>
          </div>
        </div>
      </div>

      {/* 1. 4 Prominent Service Cards */}
      <div className={styles.serviceCardsGrid}>
        {/* Service 1: Brevo Email */}
        <div className={styles.serviceCard}>
          <div>
            <div className={styles.serviceTop}>
              <div className={styles.serviceBrand}>
                <div className={`${styles.serviceIcon} ${styles.iconPurple}`}>✉️</div>
                <div>
                  <div className={styles.serviceName}>Brevo Email</div>
                  <div className={styles.serviceTag}>Dịch vụ gửi thư mời điện tử</div>
                </div>
              </div>
              <span className={`${styles.badge} ${isBrevoHealthy ? styles.badgeSuccess : styles.badgeWarning}`}>
                {isBrevoHealthy ? 'Sẵn sàng' : 'Chưa kết nối API'}
              </span>
            </div>

            <div className={styles.serviceMetricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Hạn mức miễn phí:</span>
                <span className={styles.metricVal}>300 email / ngày</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Đã giữ suất hôm nay:</span>
                <span className={styles.metricVal}>
                  {internalMetrics.dailyEmailBudget?.reservedAttempts ?? 0} / 300
                </span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Gửi thành công:</span>
                <span className={styles.metricVal} style={{ color: '#059669' }}>
                  {internalMetrics.dailyEmailBudget?.acceptedAttempts ?? 0} email
                </span>
              </div>
            </div>
          </div>

          <div className={styles.serviceFooter}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reset lúc 00:00 hàng ngày</span>
            <a
              href="https://app.brevo.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkExternal}
            >
              Brevo Dashboard ↗
            </a>
          </div>
        </div>

        {/* Service 2: Supabase */}
        <div className={styles.serviceCard}>
          <div>
            <div className={styles.serviceTop}>
              <div className={styles.serviceBrand}>
                <div className={`${styles.serviceIcon} ${styles.iconEmerald}`}>🗄️</div>
                <div>
                  <div className={styles.serviceName}>Supabase PostgreSQL</div>
                  <div className={styles.serviceTag}>Cơ sở dữ liệu & Tệp âm thanh</div>
                </div>
              </div>
              <span className={`${styles.badge} ${isSupabaseDbHealthy ? styles.badgeSuccess : styles.badgeDanger}`}>
                {isSupabaseDbHealthy ? 'Đang hoạt động' : 'Mất kết nối'}
              </span>
            </div>

            <div className={styles.serviceMetricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Dung lượng DB Free:</span>
                <span className={styles.metricVal}>Tối đa 500 MB</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Dung lượng Storage:</span>
                <span className={styles.metricVal}>Tối đa 1 GB</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Dữ liệu hiện tại:</span>
                <span className={styles.metricVal}>
                  {internalMetrics.totalHosts ?? '—'} host · {internalMetrics.totalEvents ?? '—'} thiệp
                </span>
              </div>
            </div>
          </div>

          <div className={styles.serviceFooter}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Region: Singapore (ap-southeast-1)</span>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkExternal}
            >
              Supabase Console ↗
            </a>
          </div>
        </div>

        {/* Service 3: Netlify */}
        <div className={styles.serviceCard}>
          <div>
            <div className={styles.serviceTop}>
              <div className={styles.serviceBrand}>
                <div className={`${styles.serviceIcon} ${styles.iconIndigo}`}>☁️</div>
                <div>
                  <div className={styles.serviceName}>Netlify Hosting</div>
                  <div className={styles.serviceTag}>Máy chủ ứng dụng Web Next.js</div>
                </div>
              </div>
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                Hoạt động
              </span>
            </div>

            <div className={styles.serviceMetricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Thời gian build Free:</span>
                <span className={styles.metricVal}>300 credits / tháng</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Băng thông mạng:</span>
                <span className={styles.metricVal}>100 GB / tháng</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Serverless Functions:</span>
                <span className={styles.metricVal}>125k lượt gọi / tháng</span>
              </div>
            </div>
          </div>

          <div className={styles.serviceFooter}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đối soát trực tiếp tại Dashboard</span>
            <a
              href="https://app.netlify.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkExternal}
            >
              Netlify Console ↗
            </a>
          </div>
        </div>

        {/* Service 4: GitHub */}
        <div className={styles.serviceCard}>
          <div>
            <div className={styles.serviceTop}>
              <div className={styles.serviceBrand}>
                <div className={`${styles.serviceIcon} ${styles.iconAmber}`}>🐙</div>
                <div>
                  <div className={styles.serviceName}>GitHub Repository</div>
                  <div className={styles.serviceTag}>Mã nguồn & CI/CD Actions</div>
                </div>
              </div>
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                Đồng bộ
              </span>
            </div>

            <div className={styles.serviceMetricsList}>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>GitHub Actions Free:</span>
                <span className={styles.metricVal}>2,000 phút / tháng</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Lưu trữ Git LFS / Packages:</span>
                <span className={styles.metricVal}>500 MB</span>
              </div>
              <div className={styles.metricRow}>
                <span className={styles.metricLabel}>Branch triển khai:</span>
                <span className={styles.metricVal}>main</span>
              </div>
            </div>
          </div>

          <div className={styles.serviceFooter}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tự động trigger build khi push</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkExternal}
            >
              GitHub Repo ↗
            </a>
          </div>
        </div>
      </div>

      {/* 2. Published Reference Limits Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>📋 Bảng tham chiếu hạn mức công bố gói Miễn phí (Free Tier)</span>
          </h2>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>Tài liệu chính thức</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Nền tảng</th>
                <th>Dịch vụ</th>
                <th>Hạn mức công bố gói Free</th>
                <th>Ghi chú & Thời điểm kiểm tra</th>
                <th>Tài liệu nguồn</th>
              </tr>
            </thead>
            <tbody>
              {PUBLISHED_REFERENCE_LIMITS.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize', color: '#0f172a' }}>{item.provider}</td>
                  <td>{item.name}</td>
                  <td style={{ fontWeight: 700, color: '#4f46e5' }}>{item.publishedLimit}</td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {item.notes} <br />
                    <em>(Kiểm tra: {item.checkedAt})</em>
                  </td>
                  <td>
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.linkExternal}>
                      Xem tài liệu ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Collapsible Technical Debug Details */}
      <details className={styles.debugDetails}>
        <summary className={styles.debugSummary}>
          🔍 <strong>Dành cho Kỹ thuật viên / Developer:</strong> Xem chi tiết các Endpoint API & Metric Snapshots thô ({snapshots.length} số đo)
        </summary>
        <div className={styles.debugContent}>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>
            Dữ liệu raw đọc trực tiếp từ API Brevo v3 và Supabase Management. Số đo trống hiển thị &quot;—&quot;, không bị ép về số 0.
          </p>
          <div className={styles.gridCards}>
            {snapshots.map(s => (
              <MetricCard key={`${s.provider}-${s.metric_key}`} snapshot={s} />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
