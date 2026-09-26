'use client';

import { useState, useEffect } from 'react';
import { useResponses } from './useResponses';
import { EditorIcon } from '@/features/events/EditorIcon';

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'KM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    if (data && data.page !== page) {
      setPage(data.page);
    }
  }, [data, page]);

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
    <>
      <header className="invitation-page-header">
        <div className="header-badge-row">
          <span className="editor-eyebrow">Sổ lưu bút & Lời nhắn</span>
        </div>
        <div className="guestbook-header-row">
          <div>
            <h1 className="invitation-main-title">Những lời chúc thanh xuân</h1>
            <p className="invitation-main-desc">
              Lưu giữ trọn vẹn những câu trả lời và lời nhắn gửi yêu thương từ những người quan trọng trong ngày trọng đại.
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

      {/* Metrics Totals Cards - Memory Keepsake Style */}
      <section className="memory-metrics-grid" aria-label="Tổng quan phản hồi">
        <div className="memory-metric-card" data-testid="metric-total">
          <div className="metric-icon-bubble bubble-navy">
            <EditorIcon name="envelope" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Tổng khách mời</span>
            <span className="metric-value">{data ? totals.total : '—'}</span>
            <span className="metric-subtext">Đã gửi thiệp mời</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-accepted" data-testid="metric-accepted">
          <div className="metric-icon-bubble bubble-emerald">
            <EditorIcon name="heart" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Sẽ đến chung vui</span>
            <span className="metric-value">{data ? totals.accepted : '—'}</span>
            <span className="metric-subtext">Xác nhận tham dự</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-declined" data-testid="metric-declined">
          <div className="metric-icon-bubble bubble-rose">
            <EditorIcon name="sparkles" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Gửi lời chúc từ xa</span>
            <span className="metric-value">{data ? totals.declined : '—'}</span>
            <span className="metric-subtext">Không thể đến dự</span>
          </div>
        </div>

        <div className="memory-metric-card highlight-pending" data-testid="metric-pending">
          <div className="metric-icon-bubble bubble-amber">
            <EditorIcon name="clock" width="20" height="20" />
          </div>
          <div className="metric-content">
            <span className="metric-label">Chờ hồi âm</span>
            <span className="metric-value">{data ? totals.pending : '—'}</span>
            <span className="metric-subtext">Chưa gửi phản hồi</span>
          </div>
        </div>
      </section>

      {/* Main Guestbook Wall Card */}
      <section className="editor-card guestbook-wall-card" aria-label="Góc lưu bút">
        {/* Search and Status Filters */}
        <div className="guestbook-controls-bar">
          <form className="search-form-luxury" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrapper">
              <span className="search-icon-inside">
                <EditorIcon name="search" width="16" height="16" />
              </span>
              <input
                type="search"
                placeholder="Tìm lời nhắn theo tên hoặc email…"
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
              onClick={() => handleFilterChange('all')}
            >
              <span>Tất cả</span>
              <span className="tab-count">{data ? totals.total : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'accepted' ? 'guestbook-tab active tab-accepted' : 'guestbook-tab tab-accepted'}
              onClick={() => handleFilterChange('accepted')}
            >
              <span>Tham gia</span>
              <span className="tab-count">{data ? totals.accepted : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'declined' ? 'guestbook-tab active tab-declined' : 'guestbook-tab tab-declined'}
              onClick={() => handleFilterChange('declined')}
            >
              <span>Gửi lời chúc</span>
              <span className="tab-count">{data ? totals.declined : 0}</span>
            </button>
            <button
              type="button"
              className={status === 'pending' ? 'guestbook-tab active tab-pending' : 'guestbook-tab tab-pending'}
              onClick={() => handleFilterChange('pending')}
            >
              <span>Chưa hồi âm</span>
              <span className="tab-count">{data ? totals.pending : 0}</span>
            </button>
          </div>
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
            <h3>Sổ lưu bút thanh xuân đang mở</h3>
            <p>Chưa có phản hồi nào được ghi nhận. Khi khách mời mở thiệp và gửi lời nhắn, những mẩu giấy kỷ niệm sẽ xuất hiện tại đây.</p>
          </div>
        ) : data && totals.total > 0 && filteredTotal === 0 ? (
          <div className="guestbook-empty-state">
            <div className="empty-keepsake-icon">
              <EditorIcon name="search" width="36" height="36" />
            </div>
            <h3>Không tìm thấy lời nhắn phù hợp</h3>
            <p>Không có phản hồi nào khớp với từ khóa &ldquo;{appliedQuery}&rdquo;.</p>
            <button className="button-secondary" type="button" onClick={handleResetSearch} style={{ marginTop: '14px' }}>
              Xem toàn bộ sổ lưu bút
            </button>
          </div>
        ) : (
          <>
            {/* The Wall of Notes: Mẫu Giấy Ghi Chú Thanh Xuân */}
            <div className="wish-wall-grid" aria-label="Bức tường lưu bút và lời nhắn">
              {data?.items.map((item) => (
                <article
                  key={item.id}
                  className={`wish-note-card wish-note-${item.status}`}
                  data-testid={`response-row-${item.id}`}
                >
                  {/* Decorative Washi Tape Bar */}
                  <div className="washi-tape-pin" aria-hidden="true" />

                  {/* Header: Guest Info & Status Badge */}
                  <div className="wish-note-header">
                    <div className="wish-guest-profile">
                      <div className="wish-guest-avatar" aria-hidden="true">
                        {getInitials(item.guestName)}
                      </div>
                      <div className="wish-guest-meta">
                        <h3 className="wish-guest-name">{item.guestName}</h3>
                        <span className="wish-guest-email">{item.guestEmail}</span>
                      </div>
                    </div>

                    <div className="wish-status-badge-wrap">
                      {item.status === 'accepted' ? (
                        <span className="wish-badge wish-badge-accepted">
                          <EditorIcon name="heart" width="13" height="13" />
                          <span>Sẽ đến chung vui</span>
                        </span>
                      ) : item.status === 'declined' ? (
                        <span className="wish-badge wish-badge-declined">
                          <EditorIcon name="envelope" width="13" height="13" />
                          <span>Gửi lời chúc từ xa</span>
                        </span>
                      ) : (
                        <span className="wish-badge wish-badge-pending">
                          <EditorIcon name="clock" width="13" height="13" />
                          <span>Chờ hồi âm</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: The Wish / Heartfelt Message */}
                  <div className="wish-note-body">
                    {item.guestMessage ? (
                      <div className="wish-message-quote">
                        <span className="quote-mark-icon" aria-hidden="true">“</span>
                        <p className="wish-message-text">{item.guestMessage}</p>
                      </div>
                    ) : item.status === 'accepted' ? (
                      <div className="wish-empty-message accepted">
                        <p>Khách đã xác nhận tham dự và gửi trọn niềm vui đến bạn.</p>
                      </div>
                    ) : item.status === 'declined' ? (
                      <div className="wish-empty-message declined">
                        <p>Khách gửi lời chúc phúc từ xa và rất tiếc không thể đến chung vui.</p>
                      </div>
                    ) : (
                      <div className="wish-empty-message pending">
                        <p>Chưa có lời nhắn. Khách mời chưa gửi phản hồi tham dự.</p>
                      </div>
                    )}
                  </div>

                  {/* Footer: Timestamp */}
                  <footer className="wish-note-footer">
                    {item.respondedAt ? (
                      <span className="wish-timestamp">
                        <EditorIcon name="clock" width="12" height="12" />
                        <span>Phản hồi lúc {formatVietnamDateTime(item.respondedAt)}</span>
                      </span>
                    ) : (
                      <span className="wish-timestamp pending-time">
                        <EditorIcon name="clock" width="12" height="12" />
                        <span>Chưa phản hồi</span>
                      </span>
                    )}
                  </footer>
                </article>
              ))}
            </div>

            {/* Pagination */}
            <div className="pagination-bar-luxury" style={{ marginTop: '32px' }}>
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
    </>
  );
}
