'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  MetricSnapshot,
  InternalActivityMetrics,
  AdminHostItem,
  AdminEventItem,
  AdminUnknownAttempt,
  AdminMaintenanceJob,
} from '../contracts';
import { OverviewView } from './OverviewView';
import { HostsView } from './HostsView';
import { EventsView } from './EventsView';
import { MetricsView } from './MetricsView';
import { OperationsView } from './OperationsView';
import styles from './admin.module.css';

interface AdminShellProps {
  developerEmail: string;
  initialSnapshots: MetricSnapshot[];
  initialInternalMetrics: InternalActivityMetrics;
  initialSyncedAt: string | null;
  initialSyncBlockedReason?: string | null;
  initialHosts: AdminHostItem[];
  initialEvents: AdminEventItem[];
  availableTemplates: string[];
  initialAttempts: AdminUnknownAttempt[];
  initialJobs: AdminMaintenanceJob[];
}

export type AdminTab = 'overview' | 'hosts' | 'events' | 'metrics' | 'operations';

export function AdminShell({
  developerEmail,
  initialSnapshots,
  initialInternalMetrics,
  initialSyncedAt,
  initialSyncBlockedReason = null,
  initialHosts,
  initialEvents,
  availableTemplates,
  initialAttempts,
  initialJobs,
}: AdminShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loggingOut, setLoggingOut] = useState(false);

  // Shared data state
  const [hosts, setHosts] = useState<AdminHostItem[]>(initialHosts);
  const [events, setEvents] = useState<AdminEventItem[]>(initialEvents);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>(initialSnapshots);
  const [internalMetrics, setInternalMetrics] = useState<InternalActivityMetrics>(initialInternalMetrics);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialSyncedAt);

  // Shared modal triggers
  const [createHostModalOpen, setCreateHostModalOpen] = useState(false);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      router.replace('/login');
    }
  }

  async function refreshData() {
    try {
      const [hostsRes, eventsRes, metricsRes] = await Promise.all([
        fetch('/api/admin/hosts'),
        fetch('/api/admin/events'),
        fetch('/api/admin/metrics'),
      ]);

      if (hostsRes.ok) {
        const d = await hostsRes.json();
        setHosts(d.hosts || []);
      }
      if (eventsRes.ok) {
        const d = await eventsRes.json();
        setEvents(d.events || []);
      }
      if (metricsRes.ok) {
        const d = await metricsRes.json();
        if (d.snapshots) setSnapshots(d.snapshots);
        if (d.internalMetrics) setInternalMetrics(d.internalMetrics);
        if (d.lastSyncedAt) setLastSyncedAt(d.lastSyncedAt);
      }
    } catch {
      // Ignore
    }
  }

  // Navigation tab meta
  const tabTitles: Record<AdminTab, { title: string; subtitle: string }> = {
    overview: {
      title: 'Bảng tổng quan',
      subtitle: 'Theo dõi nhanh chỉ số hoạt động, khách hàng và trạng thái hệ thống',
    },
    hosts: {
      title: 'Quản lý Khách hàng (Host)',
      subtitle: 'Tạo tài khoản Host, cấp mật khẩu 1 lần ngẫu nhiên và dọn dẹp an toàn',
    },
    events: {
      title: 'Quản lý Sự kiện & Thiệp',
      subtitle: 'Khởi tạo sự kiện, chọn mẫu thiệp từ Registry và xem danh sách khách',
    },
    metrics: {
      title: 'Giám sát tài nguyên Free Tier',
      subtitle: 'Theo dõi hạn mức sử dụng Brevo, Supabase, Netlify và bảng tham chiếu',
    },
    operations: {
      title: 'Vận hành & Đối soát',
      subtitle: 'Xử lý các lượt gửi email chưa rõ kết quả và công việc bảo trì Storage',
    },
  };

  return (
    <div className={styles.adminLayout}>
      {/* 1. Left Sidebar Navigation */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          <div className={styles.brandLogo}>E</div>
          <div className={styles.brandInfo}>
            <span className={styles.brandTitle}>e-invitation</span>
            <span className={styles.brandBadge}>System Admin</span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <button
            className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className={styles.navIcon}>📊</span>
            <span>Tổng quan</span>
          </button>

          <button
            className={`${styles.navItem} ${activeTab === 'hosts' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('hosts')}
          >
            <span className={styles.navIcon}>👥</span>
            <span>Khách hàng (Host)</span>
          </button>

          <button
            className={`${styles.navItem} ${activeTab === 'events' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <span className={styles.navIcon}>🎉</span>
            <span>Sự kiện & Thiệp</span>
          </button>

          <button
            className={`${styles.navItem} ${activeTab === 'metrics' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            <span className={styles.navIcon}>☁️</span>
            <span>Tài nguyên Free</span>
          </button>

          <button
            className={`${styles.navItem} ${activeTab === 'operations' ? styles.navItemActive : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            <span className={styles.navIcon}>🛠️</span>
            <span>Vận hành & Đối soát</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userEmail} title={developerEmail}>{developerEmail}</span>
            <span className={styles.userRole}>
              <span className={`${styles.statusDot} ${styles.dotGreen}`} />
              Developer
            </span>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            disabled={loggingOut}
            title="Đăng xuất khỏi phiên Developer"
          >
            {loggingOut ? '…' : 'Thoát'}
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className={styles.mainContent}>
        {/* Top Header Bar */}
        <header className={styles.topBar}>
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>{tabTitles[activeTab].title}</h1>
            <span className={styles.pageSubtitle}>{tabTitles[activeTab].subtitle}</span>
          </div>

          <div className={styles.topBarActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => {
                setActiveTab('hosts');
                setCreateHostModalOpen(true);
              }}
            >
              + Tạo Host
            </button>
            <button
              className={styles.btnPrimary}
              onClick={() => {
                setActiveTab('events');
                setCreateEventModalOpen(true);
              }}
              disabled={hosts.length === 0}
            >
              + Tạo Sự kiện
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className={styles.pageBody}>
          {activeTab === 'overview' && (
            <OverviewView
              internalMetrics={internalMetrics}
              snapshots={snapshots}
              hosts={hosts}
              events={events}
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenCreateHost={() => {
                setActiveTab('hosts');
                setCreateHostModalOpen(true);
              }}
              onOpenCreateEvent={() => {
                setActiveTab('events');
                setCreateEventModalOpen(true);
              }}
            />
          )}

          {activeTab === 'hosts' && (
            <HostsView
              initialHosts={hosts}
              onHostsUpdated={refreshData}
              createModalOpen={createHostModalOpen}
              onCloseCreateModal={() => setCreateHostModalOpen(false)}
              onOpenCreateModal={() => setCreateHostModalOpen(true)}
            />
          )}

          {activeTab === 'events' && (
            <EventsView
              initialEvents={events}
              hosts={hosts}
              availableTemplates={availableTemplates}
              onEventsUpdated={refreshData}
              createModalOpen={createEventModalOpen}
              onCloseCreateModal={() => setCreateEventModalOpen(false)}
              onOpenCreateModal={() => setCreateEventModalOpen(true)}
            />
          )}

          {activeTab === 'metrics' && (
            <MetricsView
              initialSnapshots={snapshots}
              initialInternalMetrics={internalMetrics}
              initialSyncedAt={lastSyncedAt}
              initialSyncBlockedReason={initialSyncBlockedReason}
              onRefreshTriggered={refreshData}
            />
          )}

          {activeTab === 'operations' && (
            <OperationsView
              initialAttempts={initialAttempts}
              initialJobs={initialJobs}
            />
          )}
        </main>
      </div>
    </div>
  );
}
