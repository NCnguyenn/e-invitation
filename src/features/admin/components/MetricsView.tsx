'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { InternalActivityMetrics, MetricProvider, MetricSnapshot } from '../contracts';
import { DIRECT_DASHBOARD_LINKS, PUBLISHED_REFERENCE_LIMITS } from '../metrics/reference';
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
const AUTO_REFRESH_INTERVAL_SEC = 300;

const PROVIDERS: Array<{ id: MetricProvider; name: string; summary: string }> = [
  { id: 'brevo', name: 'Brevo', summary: 'Email giao dịch' },
  { id: 'supabase', name: 'Supabase', summary: 'Database, Storage và API' },
  { id: 'netlify', name: 'Netlify', summary: 'Deploy và traffic ứng dụng' },
  { id: 'github', name: 'GitHub', summary: 'Mã nguồn và Actions' },
];

function getProviderMeasurementStatus(provider: MetricProvider, snapshots: MetricSnapshot[]) {
  const providerMetrics = snapshots.filter((snapshot) => snapshot.provider === provider);
  const measuredCount = providerMetrics.filter((snapshot) => snapshot.value !== null).length;
  const freshCount = providerMetrics.filter(
    (snapshot) => snapshot.status === 'fresh' && snapshot.value !== null,
  ).length;

  if (measuredCount > 0) {
    return {
      label: freshCount === measuredCount
        ? `${measuredCount}/${providerMetrics.length} chỉ số có số đo mới`
        : `${freshCount}/${providerMetrics.length} số đo mới · ${measuredCount - freshCount} cũ`,
      className: freshCount === measuredCount ? styles.statusGreen : styles.statusAmber,
    };
  }
  if (providerMetrics.length > 0 && providerMetrics.every((snapshot) => snapshot.status === 'not_connected')) {
    return { label: 'Chưa cấu hình kết nối API', className: styles.statusAmber };
  }
  if (provider === 'netlify' || provider === 'github') {
    return { label: 'Ứng dụng chưa tích hợp API đo usage', className: styles.statusNeutral };
  }
  if (providerMetrics.length > 0) {
    return { label: 'Hiện chưa có số đo dùng được', className: styles.statusAmber };
  }
  return { label: 'Chưa có phép đo API', className: styles.statusNeutral };
}

function getSyncBlockLabel(reason: string | null) {
  if (reason === 'locked') return 'Một tiến trình khác đang đồng bộ.';
  if (reason === 'cooldown') return 'Đang trong thời gian chờ giữa các lần đồng bộ.';
  if (reason === 'lease_unavailable') return 'Không thể lấy quyền đồng bộ lúc này.';
  return null;
}

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

  useEffect(() => {
    function handleVisibilityChange() {
      isVisibleRef.current = document.visibilityState === 'visible';
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownSeconds((previous) => (previous > 0 ? previous - 1 : 0));
      if (isVisibleRef.current) {
        setAutoRefreshCountdown((previous) => {
          if (previous <= 1) {
            void handleRefresh(false);
            return AUTO_REFRESH_INTERVAL_SEC;
          }
          return previous - 1;
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
      const response = await fetch(`/api/admin/metrics?refresh=${force ? 'true' : 'false'}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Không thể đồng bộ số đo.');
      }

      const data = await response.json();
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
      if (data.internalMetrics) setInternalMetrics(data.internalMetrics);
      setLastSyncedAt(typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null);
      setSyncBlockedReason(typeof data.syncBlockedReason === 'string' ? data.syncBlockedReason : null);
      if (force) {
        setCooldownSeconds(REFRESH_COOLDOWN_SEC);
        setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL_SEC);
      }
      onRefreshTriggered?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Lỗi đồng bộ số liệu.');
    } finally {
      setIsRefreshing(false);
    }
  }

  const emailBudget = internalMetrics.dailyEmailBudget;
  const appReserved = emailBudget?.reservedAttempts;
  const appAccepted = emailBudget?.acceptedAttempts;
  const appRejected = emailBudget?.rejectedAttempts;
  const appUnknown = emailBudget?.unknownAttempts;
  const syncBlockLabel = getSyncBlockLabel(syncBlockedReason);

  return (
    <div className={styles.metricsPage}>
      <section className={`${styles.sectionCard} ${styles.metricsToolbar}`} aria-label="Đồng bộ số đo">
        <div>
          <div className={styles.metricsToolbarTitle}>Số đo nền tảng</div>
          <p className={styles.metricsToolbarText}>
            {lastSyncedAt && !Number.isNaN(new Date(lastSyncedAt).getTime())
              ? `Lần đồng bộ gần nhất: ${new Date(lastSyncedAt).toLocaleString('vi-VN')}`
              : 'Chưa có lần đồng bộ API thành công.'}
          </p>
          <p className={styles.metricsToolbarHint}>
            Tự làm mới sau {Math.floor(autoRefreshCountdown / 60)} phút {autoRefreshCountdown % 60} giây.
            {syncBlockLabel ? ` ${syncBlockLabel}` : ''}
          </p>
        </div>
        <button
          className={styles.btnPrimary}
          onClick={() => void handleRefresh(true)}
          disabled={isRefreshing || cooldownSeconds > 0}
        >
          {isRefreshing ? 'Đang đồng bộ…' : cooldownSeconds > 0 ? `Làm mới sau ${cooldownSeconds}s` : 'Làm mới số đo'}
        </button>
      </section>

      {errorMessage ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`} role="alert">{errorMessage}</div> : null}

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeadingBlock}>
          <div>
            <h2 className={styles.sectionTitle}>Email được ghi nhận trong ứng dụng hôm nay</h2>
            <p className={styles.sectionDescription}>
              Bộ đếm lấy từ database của ứng dụng theo ngày Việt Nam. Nó không phải tổng mức dùng tài khoản Brevo.
            </p>
          </div>
          <span className={`${styles.badge} ${internalMetrics.status === 'ok' ? styles.badgeFresh : styles.badgeStale}`}>
            {internalMetrics.status === 'ok' ? 'Database đủ số liệu' : internalMetrics.status === 'partial' ? 'Database có số liệu một phần' : 'Không đọc được database'}
          </span>
        </div>
        <div className={styles.emailBudgetGrid}>
          <div className={styles.emailBudgetMain}>
            <span className={styles.emailBudgetLabel}>Suất đã giữ trong ứng dụng</span>
            <strong>{appReserved ?? '—'} <span>/ {emailBudget.cap}</span></strong>
            <span className={styles.emailBudgetMeta}>{emailBudget.budgetDate ? `Ngày ${emailBudget.budgetDate} · Việt Nam` : 'Chưa xác định ngày tính'}</span>
          </div>
          <div className={styles.emailBudgetStat}>
            <span>Được Brevo xác nhận</span>
            <strong>{appAccepted ?? '—'}</strong>
          </div>
          <div className={styles.emailBudgetStat}>
            <span>Bị từ chối</span>
            <strong>{appRejected ?? '—'}</strong>
          </div>
          <div className={styles.emailBudgetStat}>
            <span>Chưa rõ kết quả</span>
            <strong>{appUnknown ?? '—'}</strong>
          </div>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeadingBlock}>
          <div>
            <h2 className={styles.sectionTitle}>Hạn mức Free đã công bố</h2>
            <p className={styles.sectionDescription}>
              Đây là hạn mức tham khảo từ tài liệu chính thức; không biểu thị mức sử dụng hiện tại của tài khoản.
            </p>
          </div>
        </div>

        <div className={styles.resourceProviderGrid}>
          {PROVIDERS.map((provider) => {
            const limits = PUBLISHED_REFERENCE_LIMITS.filter((limit) => limit.provider === provider.id);
            const dashboard = DIRECT_DASHBOARD_LINKS.find((link) => link.provider.toLowerCase() === provider.name.toLowerCase());
            const measurementStatus = getProviderMeasurementStatus(provider.id, snapshots);

            return (
              <article className={styles.resourceProviderCard} key={provider.id}>
                <div className={styles.resourceProviderHeader}>
                  <div>
                    <h3>{provider.name}</h3>
                    <p>{provider.summary}</p>
                  </div>
                  <span className={`${styles.measurementStatus} ${measurementStatus.className}`}>{measurementStatus.label}</span>
                </div>

                <div className={styles.resourceLimitList}>
                  {limits.length > 0 ? limits.map((limit) => (
                    <div className={styles.resourceLimitItem} key={limit.id}>
                      <div className={styles.resourceLimitTop}>
                        <div>
                          <span className={styles.resourceCategory}>{limit.category}</span>
                          <strong>{limit.publishedLimit}</strong>
                        </div>
                        <a href={limit.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.linkExternal}>
                          Tài liệu ↗
                        </a>
                      </div>
                      <p>{limit.notes}</p>
                      <span className={styles.checkedDate}>Đối chiếu nguồn: {limit.checkedAt}</span>
                    </div>
                  )) : (
                    <p className={styles.emptyInline}>Chưa có hạn mức tham khảo được ghi nguồn.</p>
                  )}
                </div>

                {dashboard ? (
                  <a href={dashboard.url} target="_blank" rel="noopener noreferrer" className={styles.dashboardLink}>
                    Mở trang quản lý {provider.name} ↗
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeadingBlock}>
          <div>
            <h2 className={styles.sectionTitle}>Số liệu đo được từ API nền tảng</h2>
            <p className={styles.sectionDescription}>
              Các giá trị bên dưới đến từ API có cấu hình trong ứng dụng. Trạng thái API không khẳng định toàn bộ dịch vụ đang hoạt động.
            </p>
          </div>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>{snapshots.length} chỉ số</span>
        </div>

        {snapshots.length > 0 ? (
          <div className={styles.gridCards}>
            {snapshots.map((snapshot) => (
              <MetricCard key={`${snapshot.provider}-${snapshot.metric_key}`} snapshot={snapshot} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Chưa có snapshot API. Hãy cấu hình thông tin kết nối nền tảng để ứng dụng có thể đọc số đo.
          </div>
        )}
      </section>
    </div>
  );
}
