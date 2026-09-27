'use client';

import React, { useState } from 'react';
import type { AdminHostItem, AdminEventItem, AdminGuestItem } from '../contracts';
import styles from './admin.module.css';

interface HostEventTabProps {
  initialHosts: AdminHostItem[];
  initialEvents: AdminEventItem[];
  availableTemplates: string[];
}

export function HostEventTab({
  initialHosts,
  initialEvents,
  availableTemplates,
}: HostEventTabProps) {
  const [hosts, setHosts] = useState<AdminHostItem[]>(initialHosts);
  const [events, setEvents] = useState<AdminEventItem[]>(initialEvents);

  // Modals state
  const [createHostModalOpen, setCreateHostModalOpen] = useState(false);
  const [newHostEmail, setNewHostEmail] = useState('');
  const [oneTimePasswordData, setOneTimePasswordData] = useState<{ email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [deleteHostTarget, setDeleteHostTarget] = useState<AdminHostItem | null>(null);
  const [deleteHostConfirmEmail, setDeleteHostConfirmEmail] = useState('');

  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [newEventHostId, setNewEventHostId] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTemplateKey, setNewEventTemplateKey] = useState(availableTemplates[0] || 'wedding-floral-01');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventVenueName, setNewEventVenueName] = useState('');
  const [newEventVenueAddress, setNewEventVenueAddress] = useState('');
  const [newEventGoogleMapUrl, setNewEventGoogleMapUrl] = useState('');

  const [changeTemplateTarget, setChangeTemplateTarget] = useState<AdminEventItem | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');

  const [deleteEventTarget, setDeleteEventTarget] = useState<AdminEventItem | null>(null);
  const [deleteEventConfirmTitle, setDeleteEventConfirmTitle] = useState('');

  const [guestDrawerEvent, setGuestDrawerEvent] = useState<AdminEventItem | null>(null);
  const [eventGuests, setEventGuests] = useState<AdminGuestItem[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Refresh data helpers
  async function refreshHosts() {
    try {
      const res = await fetch('/api/admin/hosts');
      if (res.ok) {
        const data = await res.json();
        setHosts(data.hosts || []);
      }
    } catch {
      // Ignore
    }
  }

  async function refreshEvents() {
    try {
      const res = await fetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Ignore
    }
  }

  // 1. Create Host
  async function handleCreateHost(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newHostEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể tạo host.');

      setOneTimePasswordData({ email: data.email, password: data.password });
      setNewHostEmail('');
      await refreshHosts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi tạo host.');
    } finally {
      setActionLoading(false);
    }
  }

  // 2. Delete Host
  async function handleDeleteHost(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteHostTarget) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/hosts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUserId: deleteHostTarget.userId,
          confirmationEmail: deleteHostConfirmEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể xóa host.');

      setActionSuccess(data.message || 'Đã xóa host thành công.');
      setDeleteHostTarget(null);
      setDeleteHostConfirmEmail('');
      await Promise.all([refreshHosts(), refreshEvents()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi xóa host.');
    } finally {
      setActionLoading(false);
    }
  }

  // 3. Create Event
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUserId: newEventHostId,
          title: newEventTitle,
          templateKey: newEventTemplateKey,
          eventDate: newEventDate,
          venueName: newEventVenueName,
          venueAddress: newEventVenueAddress,
          googleMapUrl: newEventGoogleMapUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể tạo sự kiện.');

      setActionSuccess(`Đã tạo sự kiện "${data.title}" thành công.`);
      setCreateEventModalOpen(false);
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventVenueName('');
      setNewEventVenueAddress('');
      setNewEventGoogleMapUrl('');
      await refreshEvents();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi tạo sự kiện.');
    } finally {
      setActionLoading(false);
    }
  }

  // 4. Change Template
  async function handleChangeTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!changeTemplateTarget) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: changeTemplateTarget.id,
          templateKey: selectedTemplateKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể đổi template.');

      setActionSuccess(`Đã đổi mẫu thiệp sang "${data.templateKey}".`);
      setChangeTemplateTarget(null);
      await refreshEvents();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi đổi template.');
    } finally {
      setActionLoading(false);
    }
  }

  // 5. Delete Event
  async function handleDeleteEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteEventTarget) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: deleteEventTarget.id,
          confirmationTitle: deleteEventConfirmTitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không thể xóa sự kiện.');

      setActionSuccess(data.message || 'Đã xóa sự kiện.');
      setDeleteEventTarget(null);
      setDeleteEventConfirmTitle('');
      await refreshEvents();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi xóa sự kiện.');
    } finally {
      setActionLoading(false);
    }
  }

  // 6. View Guests
  async function openGuestDrawer(event: AdminEventItem) {
    setGuestDrawerEvent(event);
    setLoadingGuests(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/guests`);
      if (res.ok) {
        const data = await res.json();
        setEventGuests(data.guests || []);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingGuests(false);
    }
  }

  return (
    <div>
      {/* Global alert notifications */}
      {actionSuccess ? (
        <div className={styles.alertBanner} style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', marginBottom: '1.5rem' }}>
          ✓ {actionSuccess}
          <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }} onClick={() => setActionSuccess(null)}>×</button>
        </div>
      ) : null}

      {actionError ? (
        <div className={`${styles.alertBanner} ${styles.dangerAlert}`} style={{ marginBottom: '1.5rem' }}>
          ⚠ {actionError}
          <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }} onClick={() => setActionError(null)}>×</button>
        </div>
      ) : null}

      {/* Part 1: Host Management */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Quản lý Host (Khách hàng)</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Tạo tài khoản khách hàng, cấp mật khẩu 1 lần ngẫu nhiên và quản lý vòng đời tài khoản.
            </p>
          </div>
          <button className={styles.primaryBtn} onClick={() => { setCreateHostModalOpen(true); setActionError(null); }}>
            + Tạo Host mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Email Host</th>
                <th>Số sự kiện</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {hosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>Chưa có Host nào trong hệ thống.</td>
                </tr>
              ) : (
                hosts.map(h => (
                  <tr key={h.userId}>
                    <td style={{ fontWeight: 600 }}>{h.email}</td>
                    <td>{h.eventCount} sự kiện</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(h.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${h.lifecycleStatus === 'active' ? styles.badgeFresh : styles.badgeForbidden}`}>
                        {h.lifecycleStatus === 'active' ? 'Hoạt động' : 'Đang xóa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.dangerBtn}
                        onClick={() => { setDeleteHostTarget(h); setDeleteHostConfirmEmail(''); setActionError(null); }}
                      >
                        Xóa Host
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Part 2: Event Management */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Quản lý Sự kiện (Events)</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Khởi tạo sự kiện cho Host, gán mẫu thiệp từ Registry và xem danh sách khách mời để hỗ trợ kỹ thuật.
            </p>
          </div>
          <button
            className={styles.primaryBtn}
            onClick={() => {
              setCreateEventModalOpen(true);
              setNewEventHostId(hosts[0]?.userId || '');
              setActionError(null);
            }}
            disabled={hosts.length === 0}
          >
            + Tạo Sự kiện mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Tiêu đề sự kiện</th>
                <th>Host sở hữu</th>
                <th>Thời gian</th>
                <th>Mẫu thiệp (Template)</th>
                <th>Khách mời</th>
                <th>Phản hồi RSVP</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>Chưa có sự kiện nào được tạo.</td>
                </tr>
              ) : (
                events.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 600 }}>{ev.title}</td>
                    <td style={{ fontSize: '0.85rem' }}>{ev.hostEmail}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(ev.eventDate).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                        {ev.templateKey}
                      </code>
                    </td>
                    <td>{ev.guestCount} khách</td>
                    <td>
                      <span style={{ fontWeight: 600, color: ev.respondedCount > 0 ? '#16a34a' : '#64748b' }}>
                        {ev.respondedCount} phản hồi
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => openGuestDrawer(ev)}
                          title="Xem danh sách khách mời để hỗ trợ kỹ thuật"
                        >
                          Xem khách
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => { setChangeTemplateTarget(ev); setSelectedTemplateKey(ev.templateKey); setActionError(null); }}
                        >
                          Đổi Template
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => { setDeleteEventTarget(ev); setDeleteEventConfirmTitle(''); setActionError(null); }}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL 1: Create Host */}
      {createHostModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tạo tài khoản Host mới</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setCreateHostModalOpen(false);
                  setOneTimePasswordData(null);
                  setCopiedPassword(false);
                }}
              >
                ×
              </button>
            </div>

            {oneTimePasswordData ? (
              <div className={styles.modalBody}>
                <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>
                  <strong>QUAN TRỌNG:</strong> Mật khẩu này chỉ được hiển thị <strong>MỘT LẦN DUY NHẤT</strong>. Hãy sao chép ngay để gửi cho khách hàng. Hệ thống không lưu trữ hay gửi mật khẩu qua email!
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Email Host:</label>
                  <div>{oneTimePasswordData.email}</div>
                </div>

                <div className={styles.passwordBox}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>MẬT KHẨU KHỞI TẠO (16 KÝ TỰ):</span>
                  <span className={styles.passwordValue}>{oneTimePasswordData.password}</span>
                </div>

                <button
                  className={styles.primaryBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(oneTimePasswordData.password);
                    setCopiedPassword(true);
                  }}
                >
                  {copiedPassword ? '✓ Đã sao chép vào bộ nhớ tạm' : '📋 Sao chép mật khẩu'}
                </button>

                <button
                  className={styles.actionBtn}
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => {
                    setCreateHostModalOpen(false);
                    setOneTimePasswordData(null);
                    setCopiedPassword(false);
                  }}
                >
                  Đóng cửa sổ
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateHost} className={styles.modalBody}>
                {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Địa chỉ Email của Host *</label>
                  <input
                    type="email"
                    required
                    className={styles.formInput}
                    placeholder="host@example.com"
                    value={newHostEmail}
                    onChange={e => setNewHostEmail(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Server sẽ sinh ngẫu nhiên mật khẩu an toàn 16 ký tự và kích hoạt tài khoản ngay lập tức.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setCreateHostModalOpen(false)}
                    disabled={actionLoading}
                  >
                    Hủy
                  </button>
                  <button type="submit" className={styles.primaryBtn} disabled={actionLoading}>
                    {actionLoading ? 'Đang tạo…' : 'Tạo và cấp mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* MODAL 2: Delete Host Confirmation */}
      {deleteHostTarget ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>Xác nhận xóa an toàn Host</h3>
              <button className={styles.modalClose} onClick={() => setDeleteHostTarget(null)}>×</button>
            </div>

            <form onSubmit={handleDeleteHost} className={styles.modalBody}>
              <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>
                <strong>CẢNH BÁO DỌN DẸP DỮ LIỆU:</strong> Thao tác này xóa file nhạc MP3 trong bucket audio trước khi xóa tài khoản. Schema hiện không tạo bucket banners; object banners chỉ bị dọn nếu nằm đúng prefix sự kiện.
              </div>

              {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  Vui lòng nhập lại chính xác email: <code>{deleteHostTarget.email}</code>
                </label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder={deleteHostTarget.email}
                  value={deleteHostConfirmEmail}
                  onChange={e => setDeleteHostConfirmEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.actionBtn} onClick={() => setDeleteHostTarget(null)} disabled={actionLoading}>
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className={styles.dangerBtn}
                  disabled={actionLoading || deleteHostConfirmEmail.trim().toLowerCase() !== deleteHostTarget.email.trim().toLowerCase()}
                >
                  {actionLoading ? 'Đang dọn tệp & xóa…' : 'Xác nhận xóa vĩnh viễn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 3: Create Event */}
      {createEventModalOpen ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tạo sự kiện mới cho Host</h3>
              <button className={styles.modalClose} onClick={() => setCreateEventModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateEvent} className={styles.modalBody}>
              {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

              <div className={styles.formField}>
                <label className={styles.formLabel}>Chọn Host sở hữu *</label>
                <select
                  required
                  className={styles.formSelect}
                  value={newEventHostId}
                  onChange={e => setNewEventHostId(e.target.value)}
                >
                  {hosts.map(h => (
                    <option key={h.userId} value={h.userId}>{h.email}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Tiêu đề sự kiện *</label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder="Lễ Thành Hôn: Hoàng Long & Mai Hoa"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Mẫu thiệp (Template) *</label>
                <select
                  required
                  className={styles.formSelect}
                  value={newEventTemplateKey}
                  onChange={e => setNewEventTemplateKey(e.target.value)}
                >
                  {availableTemplates.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Thời gian diễn ra (ISO / YYYY-MM-DDTHH:mm) *</label>
                <input
                  type="datetime-local"
                  required
                  className={styles.formInput}
                  value={newEventDate}
                  onChange={e => setNewEventDate(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Tên địa điểm (Tùy chọn)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Trung tâm Tiệc cưới White Palace"
                  value={newEventVenueName}
                  onChange={e => setNewEventVenueName(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Địa chỉ (Tùy chọn)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="194 Hoàng Văn Thụ, Phường 9, Phú Nhuận, TP.HCM"
                  value={newEventVenueAddress}
                  onChange={e => setNewEventVenueAddress(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Google Maps URL (Tùy chọn)</label>
                <input
                  type="url"
                  className={styles.formInput}
                  placeholder="https://maps.app.goo.gl/..."
                  value={newEventGoogleMapUrl}
                  onChange={e => setNewEventGoogleMapUrl(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.actionBtn} onClick={() => setCreateEventModalOpen(false)} disabled={actionLoading}>
                  Hủy
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={actionLoading}>
                  {actionLoading ? 'Đang tạo…' : 'Khởi tạo sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 4: Change Template */}
      {changeTemplateTarget ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Đổi Template cho Sự kiện</h3>
              <button className={styles.modalClose} onClick={() => setChangeTemplateTarget(null)}>×</button>
            </div>

            <form onSubmit={handleChangeTemplate} className={styles.modalBody}>
              {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

              <div className={styles.formField}>
                <label className={styles.formLabel}>Sự kiện:</label>
                <div style={{ fontWeight: 600 }}>{changeTemplateTarget.title}</div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Chọn mẫu thiệp mới từ Template Registry *</label>
                <select
                  required
                  className={styles.formSelect}
                  value={selectedTemplateKey}
                  onChange={e => setSelectedTemplateKey(e.target.value)}
                >
                  {availableTemplates.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.actionBtn} onClick={() => setChangeTemplateTarget(null)} disabled={actionLoading}>
                  Hủy
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={actionLoading}>
                  {actionLoading ? 'Đang đổi…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 5: Delete Event */}
      {deleteEventTarget ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>Xác nhận xóa an toàn Sự kiện</h3>
              <button className={styles.modalClose} onClick={() => setDeleteEventTarget(null)}>×</button>
            </div>

            <form onSubmit={handleDeleteEvent} className={styles.modalBody}>
              <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>
                <strong>CẢNH BÁO DỌN TỆP:</strong> File nhạc MP3 trong bucket audio bị xóa trước khi xóa sự kiện. Bucket banners không có trong schema hiện tại.
              </div>

              {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  Vui lòng nhập lại chính xác tiêu đề sự kiện: <code>{deleteEventTarget.title}</code>
                </label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  placeholder={deleteEventTarget.title}
                  value={deleteEventConfirmTitle}
                  onChange={e => setDeleteEventConfirmTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.actionBtn} onClick={() => setDeleteEventTarget(null)} disabled={actionLoading}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.dangerBtn}
                  disabled={actionLoading || deleteEventConfirmTitle.trim().toLowerCase() !== deleteEventTarget.title.trim().toLowerCase()}
                >
                  {actionLoading ? 'Đang dọn tệp & xóa…' : 'Xác nhận xóa sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 6: Guest List Drawer for Technical Support */}
      {guestDrawerEvent ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox} style={{ maxWidth: '800px' }}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Danh sách khách mời (Hỗ trợ kỹ thuật)</h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Sự kiện: {guestDrawerEvent.title}</div>
              </div>
              <button className={styles.modalClose} onClick={() => setGuestDrawerEvent(null)}>×</button>
            </div>

            <div className={styles.modalBody}>
              {loadingGuests ? (
                <div className={styles.emptyState}>Đang tải danh sách khách mời…</div>
              ) : eventGuests.length === 0 ? (
                <div className={styles.emptyState}>Sự kiện này chưa có khách mời nào.</div>
              ) : (
                <div className={styles.tableWrapper} style={{ maxHeight: '400px' }}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Tên khách</th>
                        <th>Email</th>
                        <th>Email Status</th>
                        <th>RSVP Status</th>
                        <th>Thời gian phản hồi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventGuests.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 600 }}>{g.guestName}</td>
                          <td>{g.guestEmail}</td>
                          <td>
                            <span className={`${styles.badge} ${g.emailStatus === 'sent' ? styles.badgeFresh : styles.badgeNotConnected}`}>
                              {g.emailStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${g.status === 'accepted' ? styles.badgeFresh : g.status === 'declined' ? styles.badgeForbidden : styles.badgeStale}`}>
                              {g.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {g.respondedAt ? new Date(g.respondedAt).toLocaleString('vi-VN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className={styles.primaryBtn} onClick={() => setGuestDrawerEvent(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
