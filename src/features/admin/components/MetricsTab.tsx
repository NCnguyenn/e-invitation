'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { MetricSnapshot, InternalActivityMetrics } from '../contracts';
import { PUBLISHED_REFERENCE_LIMITS, DIRECT_DASHBOARD_LINKS } from '../metrics/reference';
import { MetricCard } from './MetricCard';
import styles from './admin.module.css';

interface MetricsTabProps {
  initialSnapshots: MetricSnapshot[];
  initialInternalMetrics: InternalActivityMetrics;
  initialSyncedAt: string | null;
  initialSyncBlockedReason?: string | null;
}

const REFRESH_COOLDOWN_SEC = 60;
const AUTO_REFRESH_INTERVAL_SEC = 300; // 5 minutes

function showCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('vi-VN');
}

function showRate(responded: number | null, total: number | null): string {
  if (responded === null || total === null) return '—';
  if (total === 0) return '0%';
  return `${((responded / total) * 100).toFixed(1)}%`;
}

function syncBlockedText(reason: string | null): string | null {
  if (reason === 'cooldown') return 'Đang trong thời gian chờ 60 giây. Không gọi lại API nhà cung cấp.';
  if (reason === 'locked') return 'Một lượt đồng bộ khác đang giữ lease. Hiển thị bản đã lưu, không gọi API mới.';
  if (reason === 'lease_unavailable') return 'Không giữ được lease đồng bộ. Không gọi API Brevo/Supabase.';
  return null;
}

export function MetricsTab({
  initialSnapshots,
  initialInternalMetrics,
  initialSyncedAt,
  initialSyncBlockedReason = null,
}: MetricsTabProps) {
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>(initialSnapshots);
  const [internalMetrics, setInternalMetrics] = useState<InternalActivityMetrics>(initialInternalMetrics);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialSyncedAt);
  const [syncBlockedReason, setSyncBlockedReason] = useState<string | null>(initialSyncBlockedReason);

  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_SEC);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isVisibleRef = useRef(true);

  // Handle visibility changes (pause countdown if hidden)
  useEffect(() => {
    function handleVisibilityChange() {
      isVisibleRef.current = document.visibilityState === 'visible';
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Timer loop for cooldown and auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      // Cooldown timer
      setCooldownSeconds(prev => (prev > 0 ? prev - 1 : 0));

      // Auto-refresh countdown (only when tab is active)
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
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi đồng bộ.');
    } finally {
      setIsRefreshing(false);
    }
  }

  // Group snapshots by provider
  const brevoSnapshots = snapshots.filter(s => s.provider === 'brevo');
  const supabaseSnapshots = snapshots.filter(s => s.provider === 'supabase');

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.syncInfo}>
          <div>
            Lần đồng bộ gần nhất: <span className={styles.syncTime}>{lastSyncedAt && !Number.isNaN(new Date(lastSyncedAt).getTime()) ? new Date(lastSyncedAt).toLocaleString('vi-VN') : '—'}</span>
          </div>
          {syncBlockedText(syncBlockedReason) ? (
            <div style={{ fontSize: '0.8rem', color: '#b45309' }}>{syncBlockedText(syncBlockedReason)}</div>
          ) : null}
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Tự động làm mới sau: <strong>{Math.floor(autoRefreshCountdown / 60)}p {autoRefreshCountdown % 60}s</strong> (Tạm dừng khi ẩn tab)
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {errorMessage ? <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errorMessage}</span> : null}
          <button
            className={styles.refreshBtn}
            onClick={() => handleRefresh(true)}
            disabled={isRefreshing || cooldownSeconds > 0}
          >
            {isRefreshing ? (
              'Đang đồng bộ…'
            ) : cooldownSeconds > 0 ? (
              `Chờ ${cooldownSeconds}s`
            ) : (
              '🔄 Làm mới ngay'
            )}
          </button>
        </div>
      </div>

      {/* Section 1: Platform API Metrics */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>1. Số đo nền tảng (Platform API)</span>
          </h2>
          <span className={`${styles.badge} ${styles.badgeFresh}`}>Nguồn: API chính thức đã xác minh</span>
        </div>

        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
          Được đọc trực tiếp từ API Brevo và Supabase Management. Không suy đoán quota từ dữ liệu nội bộ và không thay giá trị trống bằng số 0.
        </p>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>Brevo API v3</h3>
        <div className={styles.gridCards} style={{ marginBottom: '1.5rem' }}>
          {brevoSnapshots.map(s => (
            <MetricCard key={`${s.provider}-${s.metric_key}`} snapshot={s} />
          ))}
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginBottom: '0.75rem' }}>Supabase Management API</h3>
        <div className={styles.gridCards}>
          {supabaseSnapshots.map(s => (
            <MetricCard key={`${s.provider}-${s.metric_key}`} snapshot={s} />
          ))}
        </div>
      </section>

      {/* Section 2: Published Limits */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>2. Hạn mức công bố (Published Limits)</span>
          </h2>
          <span className={`${styles.badge} ${styles.badgeNotConnected}`}>Bảng tham chiếu tĩnh</span>
        </div>

        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
          Thông tin đối chiếu từ tài liệu chính thức (kiểm tra ngày 24/09/2026). Dùng để tra cứu đối chiếu, không dùng làm mẫu số giả lập quota tài khoản.
        </p>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Nền tảng</th>
                <th>Hạng mục</th>
                <th>Tên dịch vụ</th>
                <th>Hạn mức công bố gói Free</th>
                <th>Ghi chú & Ngày kiểm tra</th>
                <th>Tài liệu nguồn</th>
              </tr>
            </thead>
            <tbody>
              {PUBLISHED_REFERENCE_LIMITS.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{item.provider}</td>
                  <td>{item.category}</td>
                  <td>{item.name}</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.publishedLimit}</td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {item.notes} <br />
                    <em>(Đối chiếu: {item.checkedAt})</em>
                  </td>
                  <td>
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
                      Xem nguồn ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Internal Application Activity */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>3. Hoạt động ứng dụng nội bộ (Internal Activity)</span>
          </h2>
          <span className={`${styles.badge} ${styles.badgeStale}`}>Nguồn: PostgreSQL ứng dụng</span>
        </div>

        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
          Dữ liệu thống kê từ database thực tế của hệ thống. Không đánh đồng các số liệu này là MAU, Realtime messages hoặc usage của nhà cung cấp.
          {internalMetrics.status !== 'ok' ? ' Một hoặc nhiều số đo không đọc được và được để trống, không quy thành 0.' : ''}
        </p>

        <div className={styles.gridCards} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.metricCard}>
            <span className={styles.cardTitle}>Tổng số Host</span>
            <div className={styles.cardValueWrap}>
              <span className={styles.cardValue}>{showCount(internalMetrics.totalHosts)}</span>
              <span className={styles.cardUnit}>tài khoản</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Hồ sơ role host, gồm cả đang xóa</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.cardTitle}>Tổng số Sự kiện</span>
            <div className={styles.cardValueWrap}>
              <span className={styles.cardValue}>{showCount(internalMetrics.totalEvents)}</span>
              <span className={styles.cardUnit}>sự kiện</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sự kiện đã được developer khởi tạo</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.cardTitle}>Tổng số Khách mời</span>
            <div className={styles.cardValueWrap}>
              <span className={styles.cardValue}>{showCount(internalMetrics.totalInvitations)}</span>
              <span className={styles.cardUnit}>thư mời</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tổng số lời mời trên toàn hệ thống</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.cardTitle}>Tỷ lệ phản hồi RSVP</span>
            <div className={styles.cardValueWrap}>
              <span className={styles.cardValue}>{showRate(internalMetrics.rsvpBreakdown.responded, internalMetrics.totalInvitations)}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {showCount(internalMetrics.rsvpBreakdown.accepted)} đồng ý · {showCount(internalMetrics.rsvpBreakdown.declined)} từ chối · {showCount(internalMetrics.rsvpBreakdown.pending)} chờ
            </span>
          </div>
        </div>

        {/* Email Budget Ledger */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
            Sổ giữ suất gửi Email nội bộ hôm nay ({internalMetrics.dailyEmailBudget.budgetDate})
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
            Chính sách ứng dụng giới hạn tối đa 300 suất gửi/ngày (Asia/Ho_Chi_Minh) để ngăn vượt hạn mức Brevo.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', textAlign: 'center' }}>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Đã giữ suất</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {showCount(internalMetrics.dailyEmailBudget.reservedAttempts)} / {internalMetrics.dailyEmailBudget.cap}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Đã tiếp nhận (Accepted)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
                {showCount(internalMetrics.dailyEmailBudget.acceptedAttempts)}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Bị từ chối (Rejected)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                {showCount(internalMetrics.dailyEmailBudget.rejectedAttempts)}
              </div>
            </div>
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#d97706' }}>Chưa rõ kết quả (Unknown)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                {showCount(internalMetrics.dailyEmailBudget.unknownAttempts)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Direct Dashboard Links */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>4. Phím tắt đối chiếu nhanh (Dashboard Links)</span>
          </h2>
          <span className={`${styles.badge} ${styles.badgeFresh}`}>Truy cập trực tiếp</span>
        </div>

        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
          Dành cho các dịch vụ chưa có API hạn mức tin cậy (Netlify, GitHub) hoặc để đối soát chi tiết trên console của nhà cung cấp.
        </p>

        <div className={styles.gridCards}>
          {DIRECT_DASHBOARD_LINKS.map(link => (
            <div key={link.provider} className={styles.metricCard}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{link.name}</h3>
                <span className={`${styles.badge} ${styles.badgeNotConnected}`}>{link.provider}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 1rem 0' }}>
                {link.description}
              </p>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.primaryBtn}
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                Mở {link.provider} Dashboard ↗
              </a>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
