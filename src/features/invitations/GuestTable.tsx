'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { HostInvitationsListResponse, HostInvitationItem } from '@/lib/contracts';
import { emailStatusLabel } from '@/features/email/labels';
import { EditorIcon } from '@/features/events/EditorIcon';
import { SendInvitationButton } from './SendInvitationButton';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GuestTable({
  reloadTrigger = 0,
  onGuestUpdated,
}: {
  reloadTrigger?: number;
  onGuestUpdated?: () => void;
}) {
  const [page, setPage] = useState(1);
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

  const [copyFeedback, setCopyFeedback] = useState<Record<string, boolean>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef<number>(0);

  const fetchGuests = useCallback(
    async (force = false) => {
      const currentKey = `all:${appliedQuery}:${page}`;
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

          loadedKeyRef.current = `all:${appliedQuery}:${json.page}`;
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
    [page, appliedQuery],
  );

  useEffect(() => {
    fetchGuests(reloadTrigger > 0);
  }, [fetchGuests, reloadTrigger]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
      setCopyFeedback((prev) => ({ ...prev, [token]: true }));
      setTimeout(() => {
        setCopyFeedback((prev) => ({ ...prev, [token]: false }));
      }, 2500);
    } catch {
      setCopyFeedback((prev) => ({ ...prev, [token]: false }));
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

  const totals = data?.totals ?? { total: 0, pending: 0, accepted: 0, declined: 0 };
  const filteredTotal = data?.filteredTotal ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  return (
    <section className="editor-card guest-table-card" aria-label="Danh sách lời mời đã gửi">
      <div className="guest-list-header-luxury">
        <div className="guest-list-title-box">
          <div className="title-row">
            <h2>Danh sách lời mời đã tạo</h2>
            {data && (
              <span className="guest-count-pill">
                {totals.total} thư mời
              </span>
            )}
          </div>
          <p className="card-subtitle-styled">
            Theo dõi trạng thái gửi email, sao chép liên kết cá nhân hoặc gửi lại thư cho từng khách mời.
          </p>
        </div>
        <button
          className="button-refresh-luxury"
          type="button"
          onClick={() => fetchGuests(true)}
          disabled={loading}
          aria-label="Tải lại danh sách"
        >
          <span className={`refresh-icon-spin ${loading ? 'spinning' : ''}`}>
            <EditorIcon name="refresh" width="16" height="16" />
          </span>
          <span>{loading ? 'Đang cập nhật…' : 'Làm mới'}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="table-controls-luxury">
        <form className="search-form-luxury" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <span className="search-icon-inside">
              <EditorIcon name="search" width="16" height="16" />
            </span>
            <input
              type="search"
              placeholder="Tìm theo tên khách hoặc email…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Tìm kiếm trong danh sách lời mời"
            />
            {queryInput && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleResetSearch}
                aria-label="Xóa nội dung tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>
          <button className="button-search-submit" type="submit">
            Tìm kiếm
          </button>
          {appliedQuery && (
            <button className="button-search-reset" type="button" onClick={handleResetSearch}>
              Hủy lọc
            </button>
          )}
        </form>
      </div>

      {/* Edit Guest Modal */}
      {editingGuest && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-guest-heading">
          <div className="modal-dialog-luxury">
            <div className="modal-header">
              <div className="modal-icon-badge">
                <EditorIcon name="edit" width="20" height="20" />
              </div>
              <div>
                <h3 id="edit-guest-heading">Chỉnh sửa thông tin khách</h3>
                <p className="modal-subtitle">Chỉ có thể chỉnh sửa khi thư mời chưa phát sinh lịch sử gửi email thành công.</p>
              </div>
            </div>

            <form onSubmit={submitEdit} noValidate>
              <fieldset disabled={editSaving} className="event-fields">
                <div className="form-field-box">
                  <label htmlFor="edit-name-input" className="form-label-styled">
                    <EditorIcon name="user" width="15" height="15" />
                    <span>Tên khách mời <span className="text-required">*</span></span>
                  </label>
                  <input
                    id="edit-name-input"
                    className="input-styled"
                    value={editName}
                    maxLength={255}
                    required
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="form-field-box" style={{ marginTop: '14px' }}>
                  <label htmlFor="edit-email-input" className="form-label-styled">
                    <EditorIcon name="envelope" width="15" height="15" />
                    <span>Email nhận thư <span className="text-required">*</span></span>
                  </label>
                  <input
                    id="edit-email-input"
                    type="email"
                    className="input-styled"
                    value={editEmail}
                    maxLength={255}
                    required
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>

                <div className="form-field-box" style={{ marginTop: '14px' }}>
                  <label htmlFor="edit-note-input" className="form-label-styled">
                    <EditorIcon name="note" width="15" height="15" />
                    <span>Lời mời riêng</span>
                  </label>
                  <textarea
                    id="edit-note-input"
                    className="textarea-styled"
                    value={editNote}
                    maxLength={500}
                    rows={3}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                </div>

                <div className="modal-actions-bar">
                  <button className="button-modal-cancel" type="button" onClick={cancelEdit} disabled={editSaving}>
                    Hủy bỏ
                  </button>
                  <button className="button-primary-luxury" type="submit" disabled={editSaving}>
                    {editSaving ? 'Đang lưu…' : 'Lưu cập nhật'}
                  </button>
                </div>
              </fieldset>
              {editError && (
                <div className="alert-box alert-error" style={{ marginTop: '14px' }} role="alert">
                  <EditorIcon name="info" width="16" height="16" />
                  <span>{editError}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Content states */}
      {loading && !data ? (
        <div className="table-status-luxury">
          <span className="spinner-border" />
          <p>Đang tải danh sách lời mời…</p>
        </div>
      ) : error && !data ? (
        <div className="table-status-luxury error" role="alert">
          <EditorIcon name="info" width="28" height="28" />
          <p>{error}</p>
          <button className="button-secondary" type="button" onClick={() => fetchGuests(true)}>
            Thử lại
          </button>
        </div>
      ) : data && totals.total === 0 ? (
        <div className="table-empty-luxury">
          <div className="empty-icon-circle">
            <EditorIcon name="envelope" width="36" height="36" />
          </div>
          <h3>Chưa có lời mời nào được gửi</h3>
          <p>Hãy sử dụng biểu mẫu phía trên để nhập tên, email và gửi thiệp mời riêng đầu tiên cho khách quý.</p>
        </div>
      ) : data && totals.total > 0 && filteredTotal === 0 ? (
        <div className="table-empty-luxury">
          <div className="empty-icon-circle">
            <EditorIcon name="search" width="32" height="32" />
          </div>
          <h3>Không tìm thấy khách mời nào</h3>
          <p>Không có kết quả nào phù hợp với từ khóa &ldquo;{appliedQuery}&rdquo;.</p>
          <button className="button-secondary" type="button" onClick={handleResetSearch} style={{ marginTop: '12px' }}>
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : (
        <>
          <div className="table-responsive-luxury">
            <table className="data-table-luxury" aria-label="Danh sách lời mời đã tạo">
              <thead>
                <tr>
                  <th scope="col" style={{ width: '28%' }}>Khách mời</th>
                  <th scope="col" style={{ width: '24%' }}>Lời mời riêng</th>
                  <th scope="col" style={{ width: '20%' }}>Trạng thái gửi Email</th>
                  <th scope="col" style={{ width: '14%' }}>Liên kết thiệp</th>
                  <th scope="col" style={{ width: '14%' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} data-testid={`guest-row-${item.id}`}>
                    <td className="cell-guest-profile">
                      <div className="guest-profile-flex">
                        <div className="guest-avatar" aria-hidden="true">
                          {getInitials(item.guestName)}
                        </div>
                        <div className="guest-info">
                          <span className="guest-name">{item.guestName}</span>
                          <span className="guest-email">{item.guestEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="cell-note-styled">
                      {item.invitationNote ? (
                        <span className="guest-note-text" title={item.invitationNote}>
                          &ldquo;{item.invitationNote}&rdquo;
                        </span>
                      ) : (
                        <span className="empty-dash">—</span>
                      )}
                    </td>
                    <td className="cell-email-status-styled">
                      <span className={`email-badge-luxury email-${item.emailStatus}`}>
                        <span className="email-status-dot" />
                        <span>{emailStatusLabel(item.emailStatus)}</span>
                      </span>
                    </td>
                    <td className="cell-links-styled">
                      <div className="table-actions-cluster">
                        <button
                          type="button"
                          className={`btn-row-copy ${copyFeedback[item.token] ? 'copied' : ''}`}
                          onClick={() => copyLink(item.token, item.invitePath)}
                          title="Sao chép liên kết cá nhân"
                        >
                          <EditorIcon name={copyFeedback[item.token] ? 'check' : 'copy'} width="14" height="14" />
                          <span>{copyFeedback[item.token] ? 'Đã chép' : 'Sao chép'}</span>
                        </button>
                        <a
                          className="btn-row-open"
                          href={item.invitePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Mở thiệp xem thử"
                        >
                          <EditorIcon name="external" width="14" height="14" />
                          <span>Mở</span>
                        </a>
                      </div>
                    </td>
                    <td className="cell-actions-styled">
                      <div className="table-row-ops">
                        {item.canEdit ? (
                          <button
                            type="button"
                            className="btn-row-edit"
                            onClick={() => startEdit(item)}
                            aria-label={`Sửa thông tin ${item.guestName}`}
                            title="Sửa tên hoặc email"
                          >
                            <EditorIcon name="edit" width="14" height="14" />
                            <span>Sửa</span>
                          </button>
                        ) : (
                          <span className="badge-locked-subtle" title="Đã có lịch sử gửi email, thông tin được khóa an toàn">
                            Đã khóa
                          </span>
                        )}
                        <SendInvitationButton item={item} onSent={() => fetchGuests(true)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-bar-luxury">
            <span className="pagination-info">
              Hiển thị {filteredTotal > 0 ? (page - 1) * pageSize + 1 : 0} –{' '}
              {Math.min(page * pageSize, filteredTotal)} trên tổng số {filteredTotal} lời mời
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                className="pagination-btn-luxury"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Trang trước"
              >
                Trang trước
              </button>
              <span className="pagination-current-page">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn-luxury"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Trang sau"
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
