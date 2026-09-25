import type { HostEvent } from '@/lib/contracts';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { EventEditor } from './EventEditor';
import { GuestManager } from '@/features/invitations/GuestManager';
import { ResponseTable } from '@/features/responses/ResponseTable';

export function DashboardShell({ event, section }: { event: HostEvent | null; section: 'event' | 'guests' | 'responses' }) {
  return <div className="host-dashboard">
    <aside className="host-sidebar">
      <div className="host-brand"><svg className="brand-envelope" viewBox="0 0 60 44" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="5" width="49" height="33" rx="3" /><path d="M4 7 27 25 51 7M45 4 56 0M52 13l7-4" /></svg><div><div className="brand-name">Khoảnh khắc</div><small>THIỆP MỜI ĐIỆN TỬ</small></div></div>
      <nav className="host-navigation" aria-label="Quản lý sự kiện">
        <a href="/dashboard" className={section === 'event' ? 'selected' : undefined} aria-current={section === 'event' ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">✉</span>Thiệp & thông tin</a>
        <a href="/dashboard?section=guests" className={section === 'guests' ? 'selected' : undefined} aria-current={section === 'guests' ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">♧</span>Khách mời</a>
        <a href="/dashboard?section=responses" className={section === 'responses' ? 'selected' : undefined} aria-current={section === 'responses' ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">☷</span>Phản hồi</a>
      </nav>
      <img className="sidebar-leaf" src="/templates/wedding-floral-01/corner-leaf.png" alt="" />
      <div className="host-account"><div className="account-name"><span className="account-avatar" aria-hidden="true">✧</span>Tài khoản của bạn</div><LogoutButton /></div>
    </aside>
    <main className="host-workspace">
      {section === 'guests'
        ? (event ? <GuestManager /> : <section className="editor-card"><h1>Khách mời</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)
        : section === 'responses'
        ? (event ? <ResponseTable /> : <section className="editor-card"><h1>Phản hồi</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)
        : (event ? <EventEditor initialEvent={event} /> : <section className="editor-card"><h1>Sự kiện</h1><p>Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện.</p></section>)}
    </main>
  </div>;
}

