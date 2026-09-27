'use client';

import React from 'react';
import type { InternalActivityMetrics, AdminEventItem, MetricSnapshot, MetricProvider } from '../contracts';
import styles from './admin.module.css';
import { snapshotAtTime, summarizeProviderMeasurements } from '../metrics/measurement-status';
import { useMeasurementClock } from './useMeasurementClock';

interface OverviewViewProps {
  internalMetrics: InternalActivityMetrics;
  snapshots: MetricSnapshot[];
  events: AdminEventItem[];
  onNavigate: (tab: 'overview' | 'hosts' | 'events' | 'metrics' | 'operations') => void;
  onOpenCreateHost: () => void;
  onOpenCreateEvent: () => void;
}

function formatCount(value: number | null) {
  return value === null ? '—' : value.toLocaleString('vi-VN');
}

function getMeasurementSummary(provider: MetricProvider, snapshots: MetricSnapshot[], now: number) {
  const providerSnapshots = snapshots.filter((snapshot) => snapshot.provider === provider).map(snapshot => snapshotAtTime(snapshot, now));
  const summary = summarizeProviderMeasurements(providerSnapshots, now);
  const available = providerSnapshots.filter((snapshot) => snapshot.value !== null);
  const fresh = available.filter((snapshot) => snapshot.status === 'fresh');
  const stale = available.filter((snapshot) => snapshot.status === 'stale');

  if (fresh.length > 0 && fresh.length === providerSnapshots.length) return { label: `${fresh.length}/${summary.totalCount} chỉ số API có số đo`, hint: 'Đã đọc được giá trị từ API nền tảng.', tone: 'green' as const };
  if (fresh.length > 0) return { label: `${fresh.length}/${summary.totalCount} chỉ số API có số đo · phần còn lại thiếu/cũ`, hint: 'Không suy ra quota hoặc sức khỏe dịch vụ từ phần thiếu.', tone: 'amber' as const };
  if (stale.length > 0) {
    return { label: `0/${summary.totalCount} chỉ số mới · ${stale.length} số đo đã cũ`, hint: 'Đang hiển thị lần đọc gần nhất.', tone: 'amber' as const };
  }
  if (providerSnapshots.length > 0 && providerSnapshots.every((snapshot) => snapshot.status === 'not_connected')) {
    return { label: 'Chưa cấu hình API', hint: 'Không có số đo tài khoản để hiển thị.', tone: 'neutral' as const };
  }
  if (provider === 'netlify') {
    return { label: 'Chưa có phép đo API', hint: 'Mức dùng hiện tại cần xem trong Netlify Dashboard.', tone: 'neutral' as const };
  }
  return { label: 'Chưa có số đo API', hint: 'Không suy ra trạng thái dịch vụ từ hạn mức gói.', tone: 'neutral' as const };
}

export function OverviewView({
  internalMetrics,
  snapshots,
  events,
  onNavigate,
  onOpenCreateHost,
  onOpenCreateEvent,
}: OverviewViewProps) {
  const now = useMeasurementClock();
  const invitationCount = internalMetrics.totalInvitations;
  const respondedCount = internalMetrics.rsvpBreakdown.responded;
  const responseRate = invitationCount !== null && invitationCount > 0 && respondedCount !== null
    ? `${Math.round((respondedCount / invitationCount) * 100)}%`
    : '—';
  const emailBudget = internalMetrics.dailyEmailBudget;
  const emailReserved = emailBudget.reservedAttempts;
  const providers: Array<{ id: MetricProvider; name: string; description: string }> = [
    { id: 'brevo', name: 'Brevo', description: 'Số đo email từ API tài khoản' },
    { id: 'supabase', name: 'Supabase', description: 'Số đo Management API và database' },
    { id: 'netlify', name: 'Netlify', description: 'Usage cần xem trong dashboard' },
    { id: 'internal', name: 'Email trong ứng dụng', description: 'Bộ đếm trong database hệ thống' },
  ];

  return (
    <div className={styles.overviewPage}>
      <section className={styles.kpiGrid} aria-label="Số liệu tổng quan">
        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Khách hàng (Host)</span>
            <span className={`${styles.kpiIconWrap} ${styles.iconPurple}`} aria-hidden="true">01</span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatCount(internalMetrics.totalHosts)}</span>
            <span className={styles.kpiUnit}>tài khoản</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Tổng số Host trong database</span>
            <button type="button" className={styles.btnText} onClick={() => onNavigate('hosts')}>Danh sách</button>
            <button type="button" className={styles.btnText} onClick={onOpenCreateHost}>Tạo Host</button>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Sự kiện</span>
            <span className={`${styles.kpiIconWrap} ${styles.iconIndigo}`} aria-hidden="true">02</span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatCount(internalMetrics.totalEvents)}</span>
            <span className={styles.kpiUnit}>sự kiện</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Tổng số sự kiện trong database</span>
            <button type="button" className={styles.btnText} onClick={() => onNavigate('events')}>Mở danh sách</button>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Khách mời</span>
            <span className={`${styles.kpiIconWrap} ${styles.iconEmerald}`} aria-hidden="true">03</span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{formatCount(invitationCount)}</span>
            <span className={styles.kpiUnit}>lời mời</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Đã phản hồi: <strong>{formatCount(respondedCount)}</strong></span>
            <span className={styles.kpiFootValue}>{responseRate}{responseRate !== '—' ? ' phản hồi' : ''}</span>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Email theo sổ ứng dụng</span>
            <span className={`${styles.kpiIconWrap} ${styles.iconAmber}`} aria-hidden="true">04</span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{emailReserved ?? '—'}</span>
            <span className={styles.kpiUnit}>/ {emailBudget.cap} suất hôm nay</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Thành công: <strong>{emailBudget.acceptedAttempts ?? '—'}</strong></span>
            <button type="button" className={styles.btnText} onClick={() => onNavigate('metrics')}>Xem số liệu</button>
          </div>
        </article>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Tình trạng lấy số liệu</h2>
            <p className={styles.sectionDescription}>Trạng thái bên dưới nói về dữ liệu đã đọc được, không phải cam kết uptime của nhà cung cấp.</p>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={() => onNavigate('metrics')}>Xem tài nguyên</button>
        </div>

        <div className={styles.healthGrid}>
          {providers.map((provider) => {
            const result = provider.id === 'internal'
              ? internalMetrics.status === 'ok'
                ? { label: 'Database có đủ số liệu', hint: 'Bộ đếm được đọc từ database ứng dụng.', tone: 'green' as const }
                : internalMetrics.status === 'partial'
                  ? { label: 'Database có số liệu một phần', hint: 'Một vài phép đếm chưa lấy được.', tone: 'amber' as const }
                  : { label: 'Không đọc được database', hint: 'Số liệu chưa thể xác định.', tone: 'amber' as const }
              : getMeasurementSummary(provider.id, snapshots, now);

            return (
              <article className={styles.healthCard} key={provider.id}>
                <span className={styles.healthIcon} aria-hidden="true">{provider.id === 'brevo' ? '✉' : provider.id === 'supabase' ? '◈' : provider.id === 'netlify' ? '⌂' : '↗'}</span>
                <div className={styles.healthInfo}>
                  <span className={styles.healthName}>{provider.name}</span>
                  <span className={styles.healthDescription}>{provider.description}</span>
                  <span className={`${styles.healthStatus} ${result.tone === 'green' ? styles.statusGreen : result.tone === 'amber' ? styles.statusAmber : styles.statusNeutral}`}>
                    <span className={`${styles.statusDot} ${result.tone === 'green' ? styles.dotGreen : result.tone === 'amber' ? styles.dotAmber : styles.dotGray}`} />
                    {result.label}
                  </span>
                  <span className={styles.healthHint}>{result.hint}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Sự kiện mới nhất</h2>
            <p className={styles.sectionDescription}>Dữ liệu sự kiện được tải khi mở trang quản trị.</p>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={() => onNavigate('events')}>
            Mở danh sách sự kiện
          </button>
        </div>

        {events.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Chưa có sự kiện nào trong dữ liệu đã tải.</p>
            <button type="button" className={styles.btnPrimary} onClick={onOpenCreateEvent}>Tạo sự kiện đầu tiên</button>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Tên sự kiện</th>
                  <th>Host</th>
                  <th>Mẫu thiệp</th>
                  <th>Ngày tổ chức</th>
                  <th>Khách mời</th>
                  <th>Đã phản hồi</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 5).map((event) => (
                  <tr key={event.id}>
                    <td className={styles.tablePrimaryCell}>{event.title}</td>
                    <td>{event.hostEmail}</td>
                    <td><span className={`${styles.badge} ${styles.badgeNeutral}`}>{event.templateKey}</span></td>
                    <td>{Number.isNaN(new Date(event.eventDate).getTime())
                      ? '—'
                      : new Date(event.eventDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td>{event.guestCount.toLocaleString('vi-VN')}</td>
                    <td>{event.respondedCount.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
