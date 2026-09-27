'use client';

import React from 'react';
import type { InternalActivityMetrics, AdminHostItem, AdminEventItem, MetricSnapshot } from '../contracts';
import styles from './admin.module.css';

interface OverviewViewProps {
  internalMetrics: InternalActivityMetrics;
  snapshots: MetricSnapshot[];
  hosts: AdminHostItem[];
  events: AdminEventItem[];
  onNavigate: (tab: 'overview' | 'hosts' | 'events' | 'metrics' | 'operations') => void;
  onOpenCreateHost: () => void;
  onOpenCreateEvent: () => void;
}

export function OverviewView({
  internalMetrics,
  snapshots,
  hosts,
  events,
  onNavigate,
  onOpenCreateHost,
  onOpenCreateEvent,
}: OverviewViewProps) {
  // Check provider health based on snapshots
  const brevoSnapshot = snapshots.find(s => s.provider === 'brevo');
  const supabaseSnapshot = snapshots.find(s => s.provider === 'supabase');

  const isBrevoHealthy = brevoSnapshot ? brevoSnapshot.status === 'fresh' || brevoSnapshot.status === 'stale' : false;
  const isSupabaseDbHealthy = internalMetrics.totalHosts !== null;

  return (
    <div>
      {/* 1. KPI Summary Cards */}
      <div className={styles.kpiGrid}>
        {/* Host Card */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Khách hàng (Host)</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconPurple}`}>👤</div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {internalMetrics.totalHosts !== null ? internalMetrics.totalHosts : '—'}
            </span>
            <span className={styles.kpiUnit}>tài khoản</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Đang hoạt động</span>
            <button className={styles.btnSecondary} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={onOpenCreateHost}>
              + Tạo Host
            </button>
          </div>
        </div>

        {/* Event Card */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Sự kiện & Thiệp</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconIndigo}`}>🎉</div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {internalMetrics.totalEvents !== null ? internalMetrics.totalEvents : '—'}
            </span>
            <span className={styles.kpiUnit}>thiệp</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>Tốt nghiệp / Cưới</span>
            <button className={styles.btnSecondary} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={onOpenCreateEvent}>
              + Tạo Thiệp
            </button>
          </div>
        </div>

        {/* Guests Card */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Tổng khách mời</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconEmerald}`}>💌</div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {internalMetrics.totalInvitations !== null ? internalMetrics.totalInvitations : '—'}
            </span>
            <span className={styles.kpiUnit}>thư mời</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>
              Đã phản hồi: <strong>{internalMetrics.rsvpBreakdown?.responded ?? '—'}</strong>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
              {internalMetrics.totalInvitations && internalMetrics.rsvpBreakdown?.responded
                ? `${Math.round((internalMetrics.rsvpBreakdown.responded / internalMetrics.totalInvitations) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Email Budget Today */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiTitle}>Email gửi hôm nay</span>
            <div className={`${styles.kpiIconWrap} ${styles.iconAmber}`}>📬</div>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>
              {internalMetrics.dailyEmailBudget?.reservedAttempts ?? '0'}
            </span>
            <span className={styles.kpiUnit}>/ {internalMetrics.dailyEmailBudget?.cap ?? 300} suất</span>
          </div>
          <div className={styles.kpiFooter}>
            <span>
              Thành công: <strong>{internalMetrics.dailyEmailBudget?.acceptedAttempts ?? 0}</strong>
            </span>
            <button className={styles.btnSecondary} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => onNavigate('metrics')}>
              Chi tiết ↗
            </button>
          </div>
        </div>
      </div>

      {/* 2. System Health Status */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>🩺 Tình trạng sức khỏe hệ thống</span>
          </h2>
          <button className={styles.btnSecondary} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => onNavigate('metrics')}>
            Quản lý tài nguyên ↗
          </button>
        </div>

        <div className={styles.healthGrid}>
          {/* Brevo Email Health */}
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>✉️</div>
            <div className={styles.healthInfo}>
              <span className={styles.healthName}>Brevo Email v3</span>
              <span className={`${styles.healthStatus} ${isBrevoHealthy ? styles.statusGreen : styles.statusAmber}`}>
                <span className={`${styles.statusDot} ${isBrevoHealthy ? styles.dotGreen : styles.dotAmber}`} />
                {isBrevoHealthy ? 'Sẵn sàng gửi thư' : 'Chưa cấu hình API Key'}
              </span>
            </div>
          </div>

          {/* Supabase DB Health */}
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>🗄️</div>
            <div className={styles.healthInfo}>
              <span className={styles.healthName}>Supabase PostgreSQL</span>
              <span className={`${styles.healthStatus} ${isSupabaseDbHealthy ? styles.statusGreen : styles.statusAmber}`}>
                <span className={`${styles.statusDot} ${isSupabaseDbHealthy ? styles.dotGreen : styles.dotAmber}`} />
                {isSupabaseDbHealthy ? 'Cơ sở dữ liệu hoạt động' : 'Kiểm tra kết nối'}
              </span>
            </div>
          </div>

          {/* Netlify Hosting */}
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>☁️</div>
            <div className={styles.healthInfo}>
              <span className={styles.healthName}>Netlify Hosting</span>
              <span className={`${styles.healthStatus} ${styles.statusGreen}`}>
                <span className={`${styles.statusDot} ${styles.dotGreen}`} />
                Đang chạy trực tuyến
              </span>
            </div>
          </div>

          {/* Storage Health */}
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>📁</div>
            <div className={styles.healthInfo}>
              <span className={styles.healthName}>Supabase Storage</span>
              <span className={`${styles.healthStatus} ${styles.statusGreen}`}>
                <span className={`${styles.statusDot} ${styles.dotGreen}`} />
                Lưu trữ audio sẵn sàng
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recent Events Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>🎉 Sự kiện mới nhất</span>
          </h2>
          <button className={styles.btnSecondary} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => onNavigate('events')}>
            Xem tất cả sự kiện ({events.length}) ↗
          </button>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
            <p style={{ margin: '0 0 1rem' }}>Chưa có sự kiện nào được tạo.</p>
            <button className={styles.btnPrimary} onClick={onOpenCreateEvent}>
              + Tạo Sự kiện đầu tiên
            </button>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Tên sự kiện</th>
                  <th>Chủ sở hữu (Host)</th>
                  <th>Mẫu thiệp (Template)</th>
                  <th>Ngày tổ chức</th>
                  <th>Khách mời</th>
                  <th>Phản hồi</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 5).map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{ev.title}</td>
                    <td style={{ color: '#475569' }}>{ev.hostEmail}</td>
                    <td>
                      <span className={styles.badge} style={{ background: '#e0e7ff', color: '#4338ca' }}>
                        {ev.templateKey}
                      </span>
                    </td>
                    <td style={{ color: '#64748b' }}>
                      {new Date(ev.eventDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td>
                      <strong>{ev.guestCount}</strong> khách
                    </td>
                    <td>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{ev.respondedCount} phản hồi</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
