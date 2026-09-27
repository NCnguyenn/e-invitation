'use client';

import { useState, useEffect } from 'react';
import { useResponses } from './useResponses';
import { EditorIcon } from '@/features/events/EditorIcon';
import './responses.css';

function formatVietnamDateTime(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '—';
  }
}

function formatVietnamTimeOnly(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

// Keep each guest's paper color consistent through searches and polling updates.
function paperTone(id: string) {
  return Array.from(id).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0) % 6;
}

function releasePaper(event: React.PointerEvent<HTMLElement>) {
  delete event.currentTarget.dataset.pressed;
}

export function ResponseTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const {
    data,
    loading,
    isInitialLoading,
    error,
    isStale,
    lastUpdated,
    refresh,
  } = useResponses({
    active: true,
    page,
    status,
    query: appliedQuery,
  });

  useEffect(() => {
    // Apply a server-clamped page only when a new response arrives. Watching
    // `page` here would undo a user's navigation using the previous response.
    if (data) setPage(data.page);
  }, [data]);

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

  const totals = data?.totals ?? { total: 0, pending: 0, accepted: 0, declined: 0 };
  const filteredTotal = data?.filteredTotal ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));

  return (
    <div className="response-guestbook">
      <header className="invitation-page-header">
        <div className="header-badge-row">
          <span className="editor-eyebrow">Sổ lưu bút</span>
        </div>
        <div className="guestbook-header-row">
          <div>
            <h1 className="invitation-main-title">Những lời nhắn thương mến</h1>
            <p className="invitation-main-desc">
              Gói ghém những lời chúc, lưu giữ những yêu thương.
            </p>
          </div>
          <div className="response-header-actions-luxury">
            {lastUpdated && (
              <span className="last-updated-text-luxury" data-testid="last-updated">
                <EditorIcon name="clock" width="13" height="13" />
                <span>Cập nhật: {formatVietnamTimeOnly(lastUpdated)}</span>
              </span>
            )}
            <button
              className="button-refresh-luxury"
              type="button"
              onClick={refresh}
              disabled={loading}
              aria-label="Làm mới dữ liệu"
            >
              <span className={`refresh-icon-spin ${loading ? 'spinning' : ''}`}>
                <EditorIcon name="refresh" width="15" height="15" />
              </span>
              <span>{loading ? 'Đang tải…' : 'Làm mới'}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="memory-metrics-grid" aria-label="Tổng quan phản hồi">
        <div className="memory-metric-card" data-testid="metric-total">
          <div className="metric-icon-bubble bubble-navy">
            <EditorIcon name="envelope" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Tổng khách mời</span>
            <span className="metric-value">{data ? totals.total : '—'}</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-accepted" data-testid="metric-accepted">
          <div className="metric-icon-bubble bubble-emerald">
            <EditorIcon name="heart" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Sẽ tham dự</span>
            <span className="metric-value">{data ? totals.accepted : '—'}</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-declined" data-testid="metric-declined">
          <div className="metric-icon-bubble bubble-rose">
            <EditorIcon name="sparkles" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Không tham dự</span>
            <span className="metric-value">{data ? totals.declined : '—'}</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-pending" data-testid="metric-pending">
          <div className="metric-icon-bubble bubble-amber">
            <EditorIcon name="clock" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Chưa hồi âm</span>
            <span className="metric-value">{data ? totals.pending : '—'}</span>
          </div>
        </div>
      </section>

      <section className="guestbook-wall-card" aria-label="Góc lưu bút">
        {/* Search and Status Filters */}
        <div className="guestbook-controls-bar">
          <form className="search-form-luxury" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrapper">
              <span className="search-icon-inside">
                <EditorIcon name="search" width="16" height="16" />
              </span>
              <input
                type="search"
                placeholder="Tìm theo tên hoặc email…"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                aria-label="Tìm kiếm trong sổ lưu bút"
              />
              {queryInput && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleResetSearch}
                  aria-label="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>
            <button className="button-search-submit" type="submit">
              Tìm
            </button>
            {appliedQuery && (
              <button className="button-search-reset" type="button" onClick={handleResetSearch}>
                Hủy lọc
              </button>
            )}
          </form>

          <div className="guestbook-filter-tabs" role="group" aria-label="Lọc theo phản hồi">
            <button
              type="button"
              className={status === 'all' ? 'guestbook-tab active' : 'guestbook-tab'}
              aria-pressed={status === 'all'}
              onClick={() => handleFilterChange('all')}
            >
              <span>Tất cả</span>
              <span className="tab-count">{data ? totals.total : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'accepted' ? 'guestbook-tab active tab-accepted' : 'guestbook-tab tab-accepted'}
              aria-pressed={status === 'accepted'}
              onClick={() => handleFilterChange('accepted')}
            >
              <span>Tham dự</span>
              <span className="tab-count">{data ? totals.accepted : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'declined' ? 'guestbook-tab active tab-declined' : 'guestbook-tab tab-declined'}
              aria-pressed={status === 'declined'}
              onClick={() => handleFilterChange('declined')}
            >
              <span>Không tham dự</span>
              <span className="tab-count">{data ? totals.declined : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'pending' ? 'guestbook-tab active tab-pending' : 'guestbook-tab tab-pending'}
              aria-pressed={status === 'pending'}
              onClick={() => handleFilterChange('pending')}
            >
              <span>Chưa hồi âm</span>
              <span className="tab-count">{data ? totals.pending : 0}</span>
            </button>
          </div>
        </div>

        <div className="guestbook-collection-heading">
          <h2>Những lá thư gửi bạn</h2>
          {data && <span role="status">{filteredTotal} phản hồi{status === 'all' ? '' : ' trong bộ lọc'}</span>}
        </div>

        {/* Feedback / Stale Warning */}
        {isStale && (
          <div className="alert-box alert-error" role="alert" style={{ marginBottom: '20px' }}>
            <EditorIcon name="info" width="16" height="16" />
            <span>{error || 'Không thể cập nhật dữ liệu mới nhất. Đang hiển thị bản sao lưu gần nhất.'}</span>
          </div>
        )}

        {/* Loading / Error / Empty States */}
        {isInitialLoading && !data ? (
          <div className="table-status-luxury">
            <span className="spinner-border" />
            <p>Đang mở sổ lưu bút…</p>
          </div>
        ) : error && !data ? (
          <div className="table-status-luxury error" role="alert">
            <EditorIcon name="info" width="28" height="28" />
            <p>{error}</p>
            <button className="button-secondary" type="button" onClick={refresh}>
              Thử lại
            </button>
          </div>
        ) : data && totals.total === 0 ? (
          <div className="guestbook-empty-state">
            <div className="empty-keepsake-icon">
              <EditorIcon name="envelope" width="40" height="40" />
            </div>
            <h3>Sổ lưu bút đang mở</h3>
            <p>Khi bạn thêm khách mời, những lá thư và tình trạng phản hồi của khách sẽ xuất hiện tại đây.</p>
          </div>
        ) : data && totals.total > 0 && filteredTotal === 0 ? (
          <div className="guestbook-empty-state">
            <div className="empty-keepsake-icon">
              <EditorIcon name="search" width="36" height="36" />
            </div>
            <h3>Không tìm thấy lời nhắn phù hợp</h3>
            <p>{appliedQuery ? <>Không có phản hồi nào khớp với từ khóa &ldquo;{appliedQuery}&rdquo; và bộ lọc hiện tại.</> : 'Chưa có khách mời nào trong trạng thái đã chọn.'}</p>
            <button className="button-secondary" type="button" onClick={() => { handleResetSearch(); handleFilterChange('all'); }} style={{ marginTop: '14px' }}>
              Xem toàn bộ sổ lưu bút
            </button>
          </div>
        ) : (
          <>
            <div className="wish-wall-grid" aria-label="Những lá thư và phản hồi của khách mời">
              {data?.items.map((item) => (
                <article
                  key={item.id}
                  className={`wish-note-card wish-note-${item.status}`}
                  data-paper={paperTone(item.id)}
                  data-testid={`response-row-${item.id}`}
                  aria-labelledby={`guest-signature-${item.id}`}
                  onPointerDown={(event) => {
                    if (event.isPrimary && event.button === 0) event.currentTarget.dataset.pressed = 'true';
                  }}
                  onPointerUp={releasePaper}
                  onPointerCancel={releasePaper}
                  onPointerLeave={releasePaper}
                  onLostPointerCapture={releasePaper}
                >
                  <span className="wish-paper-fold" aria-hidden="true" />
                  <div className="wish-note-header">
                    <div className="wish-status-badge-wrap">
                      {item.status === 'accepted' ? (
                        <span className="wish-badge wish-badge-accepted">
                          <EditorIcon name="heart" width="13" height="13" />
                          <span>Sẽ tham dự</span>
                        </span>
                      ) : item.status === 'declined' ? (
                        <span className="wish-badge wish-badge-declined">
                          <EditorIcon name="sparkles" width="13" height="13" />
                          <span>Không tham dự</span>
                        </span>
                      ) : (
                        <span className="wish-badge wish-badge-pending">
                          <EditorIcon name="clock" width="13" height="13" />
                          <span>Chưa hồi âm</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="wish-note-body">
                    {item.guestMessage?.trim() ? (
                      <blockquote className="wish-message-quote">
                        <span className="quote-mark-icon" aria-hidden="true">“</span>
                        <p className="wish-message-text">{item.guestMessage}</p>
                      </blockquote>
                    ) : item.status === 'accepted' ? (
                      <div className="wish-empty-message accepted">
                        <p>Đã xác nhận tham dự. Khách chưa để lại lời nhắn.</p>
                      </div>
                    ) : item.status === 'declined' ? (
                      <div className="wish-empty-message declined">
                        <p>Đã phản hồi không tham dự. Khách chưa để lại lời nhắn.</p>
                      </div>
                    ) : (
                      <div className="wish-empty-message pending">
                        <p>Chưa có lời nhắn. Khách mời chưa gửi phản hồi tham dự.</p>
                      </div>
                    )}
                  </div>

                  <footer className="wish-note-footer">
                    {item.respondedAt ? (
                      <time className="wish-timestamp" dateTime={item.respondedAt}>
                        {formatVietnamDateTime(item.respondedAt)}
                      </time>
                    ) : (
                      <span className="wish-timestamp pending-time">
                        <span>Chưa phản hồi</span>
                      </span>
                    )}
                    <div className="wish-signature">
                      <h3 className="wish-guest-name" id={`guest-signature-${item.id}`}>{item.guestName}</h3>
                      <span className="wish-guest-email">{item.guestEmail}</span>
                    </div>
                  </footer>
                </article>
              ))}
            </div>

            {/* Pagination */}
            <div className="pagination-bar-luxury">
              <span className="pagination-info">
                Hiển thị {filteredTotal > 0 ? (page - 1) * pageSize + 1 : 0} –{' '}
                {Math.min(page * pageSize, filteredTotal)} trên tổng số {filteredTotal} phản hồi
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
    </div>
  );
}
