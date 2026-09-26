import styles from '@/features/events/dashboard-shell.module.css';

export default function DashboardLoading() {
  return (
    <div className={styles.dashboard}>
      <main className={styles.workspace} aria-busy="true">
        <p role="status">Đang tải trang quản lý…</p>
      </main>
    </div>
  );
}
