'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InternalActivityMetrics, MetricProvider, MetricSnapshot, SyncResult } from '../contracts';
import { DIRECT_DASHBOARD_LINKS, PUBLISHED_REFERENCE_LIMITS } from '../metrics/reference';
import { snapshotAtTime, summarizeProviderMeasurements } from '../metrics/measurement-status';
import { unavailableInternalMetrics } from '../metrics/integrity';
import { MetricCard } from './MetricCard';
import styles from './admin.module.css';

interface MetricsViewProps {
  initialSnapshots: MetricSnapshot[];
  initialInternalMetrics: InternalActivityMetrics;
  initialSyncedAt: string | null;
  initialSyncBlockedReason?: string | null;
  onMetricsUpdated?: (data: SyncResult) => void;
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
  const summary = summarizeProviderMeasurements(providerMetrics);

  if (summary.measuredCount > 0) {
    return {
      label: summary.allFresh
        ? `${summary.freshCount}/${summary.totalCount} chỉ số có số đo mới`
        : `${summary.freshCount}/${summary.totalCount} số đo mới · ${summary.totalCount - summary.freshCount} thiếu/cũ`,
      className: summary.allFresh ? styles.statusGreen : styles.statusAmber,
    };
  }
  if (summary.allNotConnected) {
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
  if (reason === 'persistence_failed') return 'Không lưu được số đo mới. Đang giữ dữ liệu đã lưu trước đó.';
  return null;
}

export function MetricsView({
  initialSnapshots,
  initialInternalMetrics,
  initialSyncedAt,
  initialSyncBlockedReason = null,
  onMetricsUpdated,
}: MetricsViewProps) {
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>(initialSnapshots);
  const [internalMetrics, setInternalMetrics] = useState<InternalActivityMetrics>(initialInternalMetrics);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialSyncedAt);
  const [syncBlockedReason, setSyncBlockedReason] = useState<string | null>(initialSyncBlockedReason);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_SEC);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refreshLockRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const cooldownUntilRef = useRef(0);
  const nextRefreshAtRef = useRef(Date.now() + AUTO_REFRESH_INTERVAL_SEC * 1000);

  const handleRefresh = useCallback(async (force = true) => {
    if (refreshLockRef.current || Date.now() < cooldownUntilRef.current) return;
    refreshLockRef.current = true;
    cooldownUntilRef.current = Date.now() + REFRESH_COOLDOWN_SEC * 1000;
    nextRefreshAtRef.current = Date.now() + AUTO_REFRESH_INTERVAL_SEC * 1000;
    setCooldownSeconds(REFRESH_COOLDOWN_SEC);
    setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL_SEC);
    setIsRefreshing(true);
    setErrorMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`/api/admin/metrics?refresh=${force ? 'true' : 'false'}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Không thể đồng bộ số đo.');
      }

      const data: SyncResult = await response.json();
      if (!Array.isArray(data.snapshots) || !data.internalMetrics?.dailyEmailBudget) throw new Error('Phản hồi đồng bộ thiếu dữ liệu.');
      if (!mountedRef.current) return;
      const normalized = { ...data, snapshots: data.snapshots.map(s => snapshotAtTime(s)) };
      setSnapshots(normalized.snapshots);
      setInternalMetrics(normalized.internalMetrics);
      setLastSyncedAt(normalized.lastSyncedAt);
      setSyncBlockedReason(normalized.syncBlockedReason ?? null);
      onMetricsUpdated?.(normalized);
    } catch (error) {
      if (!mountedRef.current) return;
      const retained: SyncResult = {
        snapshots: snapshots.map(s => s.value === null ? s : { ...s, status: 'stale' as const }),
        internalMetrics: unavailableInternalMetrics(),
        lastSyncedAt,
        syncBlockedReason: null,
      };
      setSnapshots(retained.snapshots);
      setInternalMetrics(retained.internalMetrics);
      setSyncBlockedReason(null);
      onMetricsUpdated?.(retained);
      setErrorMessage(error instanceof DOMException && error.name === 'AbortError' ? 'Đồng bộ quá thời gian chờ.' : error instanceof Error ? error.message : 'Lỗi đồng bộ số liệu.');
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      if (mountedRef.current) setIsRefreshing(false);
      refreshLockRef.current = false;
    }
  }, [snapshots, lastSyncedAt, onMetricsUpdated]);

  useEffect(() => {
    const tick = () => {
      setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntilRef.current - Date.now()) / 1000)));
      setAutoRefreshCountdown(Math.max(0, Math.ceil((nextRefreshAtRef.current - Date.now()) / 1000)));
      if (document.visibilityState === 'visible' && Date.now() >= nextRefreshAtRef.current) void handleRefresh(false);
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [handleRefresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; requestRef.current?.abort(); };
  }, []);

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
                          <div>{limit.name}</div>
                          <strong>{limit.publishedLimit}</strong>
                        </div>
                        <a href={limit.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.linkExternal}>
                          Tài liệu ↗
                        </a>
                      </div>
                      <p>{limit.notes}</p>
                        <span className={styles.checkedDate}>
                          Hạn mức công bố · chỉ đối chiếu Dashboard · nguồn kiểm tra: {limit.checkedAt}
                        </span>
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
