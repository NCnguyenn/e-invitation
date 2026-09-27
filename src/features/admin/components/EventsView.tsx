'use client';

import React, { useState, useMemo } from 'react';
import type { AdminEventItem, AdminHostItem, AdminGuestItem } from '../contracts';
import styles from './admin.module.css';

interface EventsViewProps {
  initialEvents: AdminEventItem[];
  hosts: AdminHostItem[];
  availableTemplates: string[];
  onEventsUpdated?: () => void;
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export function EventsView({
  initialEvents,
  hosts,
  availableTemplates,
  onEventsUpdated,
  createModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}: EventsViewProps) {
  const [events, setEvents] = useState<AdminEventItem[]>(initialEvents);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [newEventHostId, setNewEventHostId] = useState(hosts[0]?.userId || '');
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

  // Sync when initialEvents or hosts update
  React.useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  React.useEffect(() => {
    if (hosts.length > 0 && !newEventHostId) {
      setNewEventHostId(hosts[0].userId);
    }
  }, [hosts, newEventHostId]);

  async function refreshEvents() {
    try {
      const res = await fetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (onEventsUpdated) onEventsUpdated();
      }
    } catch {
      // Ignore
    }
  }

  // 1. Create Event
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
      onCloseCreateModal();
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

  // 2. Change Template
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

  // 3. Delete Event
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

  // 4. Guest Drawer
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

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const term = searchTerm.toLowerCase();
    return events.filter(
      ev =>
        ev.title.toLowerCase().includes(term) ||
        ev.hostEmail.toLowerCase().includes(term) ||
        ev.templateKey.toLowerCase().includes(term)
    );
  }, [events, searchTerm]);

  return (
    <div>
      {/* Notifications */}
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

      {/* Main Events Table Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.listHeading}>
            <h2 className={styles.sectionTitle}>
              <span>🎉 Quản lý Sự kiện & Thiệp ({filteredEvents.length})</span>
            </h2>
            <div className={styles.searchBox}>
              <span>🔍</span>
              <input
                type="search"
                aria-label="Tìm sự kiện theo tên, chủ tiệc hoặc mẫu thiệp"
                placeholder="Tìm theo sự kiện, Host hoặc mẫu thiệp…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              onOpenCreateModal();
              setActionError(null);
            }}
            disabled={hosts.length === 0}
            title={hosts.length === 0 ? 'Cần tạo ít nhất 1 Host trước khi tạo sự kiện' : ''}
          >
            + Tạo Sự kiện mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable} aria-label="Danh sách sự kiện và thiệp mời">
            <thead>
              <tr>
                <th>Tiêu đề sự kiện</th>
                <th>Chủ sở hữu (Host)</th>
                <th>Mẫu thiệp (Template)</th>
                <th>Thời gian tổ chức</th>
                <th>Khách mời</th>
                <th>Phản hồi RSVP</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    {searchTerm ? 'Không tìm thấy sự kiện phù hợp.' : 'Chưa có sự kiện nào được tạo.'}
                  </td>
                </tr>
              ) : (
                filteredEvents.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{ev.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>ID: {ev.id.slice(0, 8)}…</div>
                    </td>
                    <td>
                      <div style={{ color: '#475569', fontSize: '0.875rem' }}>{ev.hostEmail}</div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: '#ede9fe', color: '#6d28d9', fontFamily: 'monospace' }}>
                        {ev.templateKey}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {new Date(ev.eventDate).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{ev.guestCount}</strong> khách
                    </td>
                    <td>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{ev.respondedCount} phản hồi</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => openGuestDrawer(ev)}
                          title="Xem danh sách khách mời để hỗ trợ kỹ thuật"
                        >
                          Xem khách
                        </button>
                        <button
                          className={styles.btnSecondary}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setChangeTemplateTarget(ev);
                            setSelectedTemplateKey(ev.templateKey);
                            setActionError(null);
                          }}
                        >
                          Đổi Template
                        </button>
                        <button
                          className={styles.btnDanger}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setDeleteEventTarget(ev);
                            setDeleteEventConfirmTitle('');
                            setActionError(null);
                          }}
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
      </div>

      {/* MODAL 1: Create Event */}
      {createModalOpen ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Khởi tạo Sự kiện mới</h3>
              <button className={styles.modalClose} onClick={onCloseCreateModal}>×</button>
            </div>

            <form onSubmit={handleCreateEvent}>
              <div className={styles.modalBody}>
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
                    placeholder="Lễ Tốt Nghiệp / Lễ Thành Hôn..."
                    value={newEventTitle}
                    onChange={e => setNewEventTitle(e.target.value)}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Mẫu thiệp (Template Registry) *</label>
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
                  <label className={styles.formLabel}>Thời gian diễn ra *</label>
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
                    placeholder="Trung tâm Hội nghị / Nhà riêng..."
                    value={newEventVenueName}
                    onChange={e => setNewEventVenueName(e.target.value)}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Địa chỉ chi tiết (Tùy chọn)</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Số nhà, Đường, Quận/Huyện, Tỉnh/TP..."
                    value={newEventVenueAddress}
                    onChange={e => setNewEventVenueAddress(e.target.value)}
                  />
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Google Maps Link (Tùy chọn)</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    placeholder="https://maps.app.goo.gl/..."
                    value={newEventGoogleMapUrl}
                    onChange={e => setNewEventGoogleMapUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={onCloseCreateModal}
                  disabled={actionLoading}
                >
                  Hủy
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={actionLoading}>
                  {actionLoading ? 'Đang tạo…' : 'Khởi tạo sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 2: Change Template */}
      {changeTemplateTarget ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Đổi Template cho Sự kiện</h3>
              <button className={styles.modalClose} onClick={() => setChangeTemplateTarget(null)}>×</button>
            </div>

            <form onSubmit={handleChangeTemplate}>
              <div className={styles.modalBody}>
                {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Sự kiện:</label>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{changeTemplateTarget.title}</div>
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
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setChangeTemplateTarget(null)}
                  disabled={actionLoading}
                >
                  Hủy
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={actionLoading}>
                  {actionLoading ? 'Đang đổi…' : 'Lưu mẫu mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 3: Delete Event */}
      {deleteEventTarget ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: '#dc2626' }}>Xác nhận xóa sự kiện</h3>
              <button className={styles.modalClose} onClick={() => setDeleteEventTarget(null)}>×</button>
            </div>

            <form onSubmit={handleDeleteEvent}>
              <div className={styles.modalBody}>
                <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>
                  <div>
                    <strong>CẢNH BÁO:</strong> File nhạc MP3 trong bucket audio sẽ được dọn dẹp trước khi xóa dữ liệu sự kiện.
                  </div>
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
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setDeleteEventTarget(null)}
                  disabled={actionLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.btnDanger}
                  disabled={actionLoading || deleteEventConfirmTitle.trim().toLowerCase() !== deleteEventTarget.title.trim().toLowerCase()}
                >
                  {actionLoading ? 'Đang dọn tệp & xóa…' : 'Xác nhận xóa sự kiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* DRAWER: Guest List for Technical Support */}
      {guestDrawerEvent ? (
        <div className={styles.drawerBackdrop} onClick={() => setGuestDrawerEvent(null)}>
          <div className={styles.drawer} onClick={e => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h3 className={styles.modalTitle}>Danh sách khách mời</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Sự kiện: <strong>{guestDrawerEvent.title}</strong>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setGuestDrawerEvent(null)}>×</button>
            </div>

            <div className={styles.drawerBody}>
              {loadingGuests ? (
                <div className={styles.emptyState}>Đang tải danh sách khách mời…</div>
              ) : eventGuests.length === 0 ? (
                <div className={styles.emptyState}>Sự kiện này chưa có khách mời nào.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Khách mời</th>
                        <th>Email</th>
                        <th>Gửi thư</th>
                        <th>RSVP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventGuests.map(g => (
                        <tr key={g.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{g.guestName}</td>
                          <td style={{ fontSize: '0.8rem', color: '#475569' }}>{g.guestEmail}</td>
                          <td>
                            <span className={`${styles.badge} ${g.emailStatus === 'sent' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                              {g.emailStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${
                              g.status === 'accepted'
                                ? styles.badgeSuccess
                                : g.status === 'declined'
                                ? styles.badgeDanger
                                : styles.badgeWarning
                            }`}>
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
