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

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'hosts', label: 'Khách hàng' },
  { id: 'events', label: 'Sự kiện & Thiệp' },
  { id: 'metrics', label: 'Tài nguyên' },
  { id: 'operations', label: 'Vận hành' },
];

function AdminNavIcon({ tab }: { tab: AdminTab }) {
  const common = {
    'aria-hidden': true as const,
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (tab) {
    case 'overview':
      return <svg {...common}><path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3h8v6h-8zM3 17h8v4H3z" /></svg>;
    case 'hosts':
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'events':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h6" /></svg>;
    case 'metrics':
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7" /></svg>;
    case 'operations':
      return <svg {...common}><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /><path d="M3.5 8h4M4 8l2-2" /></svg>;
  }
}

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
  const [syncBlockedReason, setSyncBlockedReason] = useState<string | null>(initialSyncBlockedReason);

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
        setSyncBlockedReason(d.syncBlockedReason ?? null);
      }
    } catch {
      // Ignore
    }
  }

  // Navigation tab meta
  const tabTitles: Record<AdminTab, { title: string; subtitle: string }> = {
    overview: {
      title: 'Tổng quan hệ thống',
      subtitle: 'Theo dõi khách hàng, sự kiện, RSVP và email từ số liệu đang có',
    },
    hosts: {
      title: 'Khách hàng (Host)',
      subtitle: 'Tìm tài khoản, xem sự kiện và quản lý quyền truy cập',
    },
    events: {
      title: 'Quản lý Sự kiện & Thiệp',
      subtitle: 'Tạo sự kiện, chọn mẫu thiệp và mở danh sách khách mời',
    },
    metrics: {
      title: 'Tài nguyên nền tảng',
      subtitle: 'Phân biệt số đo lấy từ API với hạn mức Free được công bố',
    },
    operations: {
      title: 'Vận hành & Đối soát',
      subtitle: 'Theo dõi email cần đối soát và công việc dọn dữ liệu',
    },
  };

  return (
    <div className={styles.adminLayout}>
      <aside className={styles.sidebar} aria-label="Điều hướng quản trị">
        <div className={styles.sidebarBrand}>
          <div className={styles.brandLogo}>E</div>
          <div className={styles.brandInfo}>
            <span className={styles.brandTitle}>e-invitation</span>
            <span className={styles.brandBadge}>System Admin</span>
          </div>
        </div>

        <nav className={styles.sidebarNav} aria-label="Các trang quản trị">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className={styles.navIcon}><AdminNavIcon tab={tab.id} /></span>
              <span>{tab.label}</span>
            </button>
          ))}
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
        <header className={styles.topBar}>
          <div className={styles.pageHeader}>
            <span className={styles.pageEyebrow}>E-INVITATION / QUẢN TRỊ</span>
            <h1 className={styles.pageTitle}>{tabTitles[activeTab].title}</h1>
            <p className={styles.pageSubtitle}>{tabTitles[activeTab].subtitle}</p>
          </div>
          <div className={styles.headerIdentity}>
            <span className={styles.headerIdentityLabel}>Đang đăng nhập</span>
            <strong title={developerEmail}>{developerEmail}</strong>
          </div>
        </header>

        <main className={styles.pageBody} id="admin-main-content">
          {activeTab === 'overview' && (
            <OverviewView
              internalMetrics={internalMetrics}
              snapshots={snapshots}
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
              initialSyncBlockedReason={syncBlockedReason}
              onMetricsUpdated={(data) => {
                setSnapshots(data.snapshots || []);
                if (data.internalMetrics) setInternalMetrics(data.internalMetrics);
                setLastSyncedAt(data.lastSyncedAt ?? null);
                setSyncBlockedReason(data.syncBlockedReason ?? null);
              }}
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
