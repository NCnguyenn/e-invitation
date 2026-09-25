'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HostInvitationsListResponse, HostInvitationItem } from '@/lib/contracts';
import { emailStatusLabel } from '@/features/email/labels';
import { SendInvitationButton } from './SendInvitationButton';
export function GuestTable({
  reloadTrigger = 0,
  onGuestUpdated,
}: {
  reloadTrigger?: number;
  onGuestUpdated?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const [data, setData] = useState<HostInvitationsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit guest state
  const [editingGuest, setEditingGuest] = useState<HostInvitationItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [copyFeedback, setCopyFeedback] = useState<Record<string, string>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef<number>(0);

  const fetchGuests = useCallback(
    async (force = false) => {
      const currentKey = `${status}:${appliedQuery}:${page}`;
      if (!force && loadedKeyRef.current === currentKey) {
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const reqId = ++requestIdRef.current;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        if (status !== 'all') params.set('status', status);
        if (appliedQuery) params.set('query', appliedQuery);

        const res = await fetch(`/api/host/invitations?${params.toString()}`, {
          headers: { 'Cache-Control': 'no-cache' },
          signal: controller.signal,
        });

        if (controller.signal.aborted || reqId !== requestIdRef.current) return;

        if (res.status === 401) {
          if (typeof window !== 'undefined') window.location.href = '/login';
          return;
        }

        if (res.ok) {
          const json: HostInvitationsListResponse = await res.json();
          if (controller.signal.aborted || reqId !== requestIdRef.current) return;

          loadedKeyRef.current = `${status}:${appliedQuery}:${json.page}`;
          setData(json);
          setError(null);
          if (json.page !== page) {
            setPage(json.page);
          }
        } else {
          const body = await res.json().catch(() => ({}));
          if (controller.signal.aborted || reqId !== requestIdRef.current) return;
          setError(body.message || 'Không thể tải danh sách khách mời.');
        }
      } catch (err: unknown) {
        if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') return;
        if (reqId !== requestIdRef.current) return;
        setError('Không thể kết nối máy chủ để tải danh sách khách.');
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [page, status, appliedQuery],
  );

  useEffect(() => {
    fetchGuests(reloadTrigger > 0);
  }, [fetchGuests, reloadTrigger]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function handleFilterChange(newStatus: 'all' | 'pending' | 'accepted' | 'declined') {
    setStatus(newStatus);
    setPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAppliedQuery(queryInput.trim());
    setPage(1);
  }

  function handleResetSearch() {
    setQueryInput('');
    setAppliedQuery('');
    setPage(1);
  }

  async function copyLink(token: string, invitePath: string) {
    const fullUrl = `${window.location.origin}${invitePath}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopyFeedback((prev) => ({ ...prev, [token]: 'Đã sao chép!' }));
      setTimeout(() => {
        setCopyFeedback((prev) => ({ ...prev, [token]: '' }));
      }, 2500);
    } catch {
      setCopyFeedback((prev) => ({ ...prev, [token]: 'Lỗi sao chép' }));
    }
  }

  function startEdit(item: HostInvitationItem) {
    if (!item.canEdit) return;
    setEditingGuest(item);
    setEditName(item.guestName);
    setEditEmail(item.guestEmail);
    setEditNote(item.invitationNote || '');
    setEditError('');
  }

  function cancelEdit() {
    setEditingGuest(null);
    setEditError('');
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGuest || editSaving) return;

    setEditSaving(true);
    setEditError('');

    try {
      const res = await fetch(`/api/host/invitations/${editingGuest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: editName,
          guestEmail: editEmail,
          invitationNote: editNote,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        setEditingGuest(null);
        await fetchGuests(true);
        onGuestUpdated?.();
      } else {
        setEditError(body.message || 'Không thể lưu thay đổi.');
      }
    } catch {
      setEditError('Không thể kết nối máy chủ để cập nhật.');
    } finally {
      setEditSaving(false);
    }
  }

  function rsvpStatusText(s: string) {
    switch (s) {
      case 'accepted':
        return 'Đã đồng ý';
      case 'declined':
        return 'Từ chối';
      default:
        return 'Chưa phản hồi';
    }
  }

  const totals = data?.totals ?? { total: 0, pending: 0, accepted: 0, declined: 0 };
  const filteredTotal = data?.filteredTotal ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  return (
    <section className="editor-card" aria-label="Danh sách khách mời" style={{ marginTop: '24px' }}>
      <div className="guest-list-header">
        <div>
          <h2>Danh sách khách mời</h2>
          <p className="card-description">
            Tổng cộng {data ? totals.total : '—'} khách. Bạn có thể mở hoặc sao chép liên kết cá nhân để kiểm tra.
          </p>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={() => fetchGuests()}
          disabled={loading}
          aria-label="Tải lại danh sách"
        >
          {loading ? 'Đang tải…' : 'Làm mới danh sách'}
        </button>
      </div>

      {/* Search and Status Filters */}
      <div className="table-controls">
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            placeholder="Tìm theo tên hoặc email…"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            aria-label="Tìm kiếm trong danh sách khách"
          />
          <button className="button-secondary" type="submit">
            Tìm
          </button>
          {appliedQuery && (
            <button className="button-secondary" type="button" onClick={handleResetSearch}>
              Xóa tìm
            </button>
          )}
        </form>

        <div className="status-filter" role="group" aria-label="Lọc theo trạng thái RSVP">
          <button
            type="button"
            className={status === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => handleFilterChange('all')}
          >
            Tất cả ({data ? totals.total : 0})
          </button>
          <button
            type="button"
            className={status === 'pending' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => handleFilterChange('pending')}
          >
            Chưa phản hồi ({data ? totals.pending : 0})
          </button>
          <button
            type="button"
            className={status === 'accepted' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => handleFilterChange('accepted')}
          >
            Đã đồng ý ({data ? totals.accepted : 0})
          </button>
          <button
            type="button"
            className={status === 'declined' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => handleFilterChange('declined')}
          >
            Từ chối ({data ? totals.declined : 0})
          </button>
        </div>
      </div>

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-guest-heading">
          <div className="modal-dialog">
            <h3 id="edit-guest-heading">Chỉnh sửa thông tin khách</h3>
            <form onSubmit={submitEdit} noValidate>
              <fieldset disabled={editSaving} className="event-fields">
                <label htmlFor="edit-name-input">Tên khách</label>
                <input
                  id="edit-name-input"
                  value={editName}
                  maxLength={255}
                  required
                  onChange={(e) => setEditName(e.target.value)}
                />

                <label htmlFor="edit-email-input">Email</label>
                <input
                  id="edit-email-input"
                  type="email"
                  value={editEmail}
                  maxLength={255}
                  required
                  onChange={(e) => setEditEmail(e.target.value)}
                />

                <label htmlFor="edit-note-input">Lời mời riêng</label>
                <textarea
                  id="edit-note-input"
                  value={editNote}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setEditNote(e.target.value)}
                />

                <div className="editor-actions">
                  <button className="button-secondary" type="button" onClick={cancelEdit} disabled={editSaving}>
                    Hủy
                  </button>
                  <button className="button-primary" type="submit" disabled={editSaving}>
                    {editSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </fieldset>
              {editError && (
                <div className="editor-feedback" style={{ marginTop: '12px' }}>
                  <p className="editor-error" role="alert">
                    {editError}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Content states */}
      {loading && !data ? (
        <div className="table-status-message">
          <p>Đang tải danh sách khách mời…</p>
        </div>
      ) : error && !data ? (
        <div className="table-status-message error" role="alert">
          <p>{error}</p>
          <button className="button-secondary" type="button" onClick={() => fetchGuests()}>
            Thử lại
          </button>
        </div>
      ) : data && totals.total === 0 ? (
        <div className="table-status-message">
          <p>Chưa có khách mời nào được tạo. Hãy dùng biểu mẫu phía trên để tạo thư mời.</p>
        </div>
      ) : data && totals.total > 0 && filteredTotal === 0 ? (
        <div className="table-status-message">
          <p>Không tìm thấy khách mời nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table" aria-label="Danh sách khách mời">
              <thead>
                <tr>
                  <th scope="col">Tên khách</th>
                  <th scope="col">Email</th>
                  <th scope="col">Lời mời riêng</th>
                  <th scope="col">RSVP</th>
                  <th scope="col">Email <span className="field-help">tiếp nhận, không phải RSVP</span></th>
                  <th scope="col">Liên kết thiệp</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} data-testid={`guest-row-${item.id}`}>
                    <td className="cell-name">{item.guestName}</td>
                    <td className="cell-email">{item.guestEmail}</td>
                    <td className="cell-note">
                      {item.invitationNote ? item.invitationNote : <span className="empty-dash">—</span>}
                    </td>
                    <td className="cell-rsvp">
                      <span className={`badge badge-${item.status}`}>{rsvpStatusText(item.status)}</span>
                    </td>
                    <td className="cell-email-status">
                      <span className={`email-badge email-${item.emailStatus}`}>
                        {emailStatusLabel(item.emailStatus)}
                      </span>
                    </td>
                    <td className="cell-links">
                      <div className="table-row-actions">
                        <button
                          type="button"
                          className="action-btn copy-btn"
                          onClick={() => copyLink(item.token, item.invitePath)}
                          title="Sao chép liên kết"
                        >
                          {copyFeedback[item.token] || 'Sao chép link'}
                        </button>
                        <a
                          className="action-btn open-btn"
                          href={item.invitePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Mở thiệp xem thử"
                        >
                          Mở thiệp
                        </a>
                      </div>
                    </td>
                    <td className="cell-actions">
                      {item.canEdit ? (
                        <button
                          type="button"
                          className="button-secondary edit-btn"
                          onClick={() => startEdit(item)}
                          aria-label={`Sửa khách ${item.guestName}`}
                        >
                          Sửa
                        </button>
                      ) : (
                        <span className="badge badge-locked" title="Thư mời đã có lịch sử gửi, không thể sửa">
                          Đã khóa
                        </span>
                      )}
                      <SendInvitationButton item={item} onSent={() => fetchGuests(true)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span className="pagination-info">
              Hiển thị {filteredTotal > 0 ? (page - 1) * pageSize + 1 : 0} –{' '}
              {Math.min(page * pageSize, filteredTotal)} trên {filteredTotal} khách
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                className="button-secondary pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Trang trước"
              >
                Trước
              </button>
              <span className="pagination-current">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                className="button-secondary pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Trang sau"
              >
                Sau
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
