import Link from 'next/link';
import type { HostEvent } from '@/lib/contracts';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { EventEditor } from './EventEditor';
import { GuestManager } from '@/features/invitations/GuestManager';
import { ResponseTable } from '@/features/responses/ResponseTable';
import { EditorIcon } from './EditorIcon';
import styles from './dashboard-shell.module.css';

export function DashboardShell({ event, section }: { event: HostEvent | null; section: 'event' | 'guests' | 'responses' }) {
  return <div className={styles.dashboard}>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/dashboard"><EditorIcon name="envelope" /><span>e-invitation</span></Link>
        <nav className={styles.navigation} aria-label="Quản lý sự kiện">
          <Link href="/dashboard" aria-current={section === 'event' ? 'page' : undefined}>Sự kiện</Link>
          <Link href="/dashboard?section=guests" aria-current={section === 'guests' ? 'page' : undefined}>Khách mời</Link>
          <Link href="/dashboard?section=responses" aria-current={section === 'responses' ? 'page' : undefined}>Phản hồi</Link>
        </nav>
        <details className={styles.account}>
          <summary aria-label="Tài khoản của bạn"><span className={styles.avatar}><EditorIcon name="user" /></span><span className={styles.accountLabel}>Tài khoản của bạn</span><EditorIcon name="chevron" width="16" height="16" /></summary>
          <div className={styles.accountMenu}><LogoutButton /></div>
        </details>
      </div>
    </header>
    <main className={styles.workspace}>
      {section === 'guests'
        ? (event ? <GuestManager /> : <section className="editor-card"><h1>Khách mời</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)
        : section === 'responses'
        ? (event ? <ResponseTable /> : <section className="editor-card"><h1>Phản hồi</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)
        : (event ? <EventEditor initialEvent={event} /> : <section className="editor-card"><h1>Sự kiện</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)}
    </main>
    <footer className={styles.footer}>e-invitation · Gửi lời mời, trao cảm xúc</footer>
  </div>;
}

