'use client';

import { useState, useEffect } from 'react';
import { useResponses } from './useResponses';

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
      <header className="editor-heading">
        <div>
          <p className="editor-eyebrow">Phản hồi</p>
          <h1>Theo dõi phản hồi</h1>
          <p>Danh sách và phản hồi của khách mời từ dữ liệu thực tế.</p>
        </div>
        <div className="response-header-actions">
          {lastUpdated && (
            <span className="last-updated-text" data-testid="last-updated">
              Cập nhật lần cuối: {formatVietnamTimeOnly(lastUpdated)}
            </span>
          )}
          <button
            className="button-secondary"
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Làm mới dữ liệu"
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
      </header>

      {/* Metrics Totals Cards */}
      <section className="metrics-grid" aria-label="Tổng quan phản hồi">
        <div className="metric-card" data-testid="metric-total">
          <span className="metric-label">Tổng khách mời</span>
          <span className="metric-value">{data ? totals.total : '—'}</span>
        </div>
        <div className="metric-card" data-testid="metric-pending">
          <span className="metric-label">Chưa phản hồi</span>
          <span className="metric-value">{data ? totals.pending : '—'}</span>
        </div>
        <div className="metric-card" data-testid="metric-accepted">
          <span className="metric-label">Đồng ý tham gia</span>
          <span className="metric-value">{data ? totals.accepted : '—'}</span>
        </div>
        <div className="metric-card" data-testid="metric-declined">
          <span className="metric-label">Không tham gia</span>
          <span className="metric-value">{data ? totals.declined : '—'}</span>
        </div>
      </section>

      {/* Main card */}
      <section className="editor-card" aria-label="Bảng phản hồi">
        {/* Filters and search */}
        <div className="table-controls">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Tìm theo tên hoặc email…"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label="Tìm kiếm khách mời"
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

          <div className="status-filter" role="group" aria-label="Lọc theo trạng thái">
            <button
              type="button"
              className={status === 'all' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => handleFilterChange('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={status === 'pending' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => handleFilterChange('pending')}
            >
              Chưa phản hồi
            </button>
            <button
              type="button"
              className={status === 'accepted' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => handleFilterChange('accepted')}
            >
              Đồng ý
            </button>
            <button
              type="button"
              className={status === 'declined' ? 'filter-btn active' : 'filter-btn'}
              onClick={() => handleFilterChange('declined')}
            >
              Từ chối
            </button>
          </div>
        </div>

        {/* Feedback / Stale Warning */}
        {isStale && (
          <div className="editor-feedback">
            <p className="editor-error" role="alert">
              {error || 'Không thể cập nhật dữ liệu mới nhất. Đang hiển thị bản sao lưu gần nhất.'}
            </p>
          </div>
        )}

        {/* Loading / Error / Empty / Table */}
        {isInitialLoading && !data ? (
          <div className="table-status-message">
            <p>Đang tải danh sách phản hồi…</p>
          </div>
        ) : error && !data ? (
          <div className="table-status-message error" role="alert">
            <p>{error}</p>
            <button className="button-secondary" type="button" onClick={refresh}>
              Thử lại
            </button>
          </div>
        ) : data && totals.total === 0 ? (
          <div className="table-status-message">
            <p>Chưa có khách mời nào trong sự kiện.</p>
          </div>
        ) : data && totals.total > 0 && filteredTotal === 0 ? (
          <div className="table-status-message">
            <p>Không tìm thấy khách mời nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table" aria-label="Danh sách phản hồi">
                <thead>
                  <tr>
                    <th scope="col">Tên khách</th>
                    <th scope="col">Email</th>
                    <th scope="col">Lựa chọn</th>
                    <th scope="col">Ghi chú</th>
                    <th scope="col">Thời điểm phản hồi</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item) => (
                    <tr key={item.id} data-testid={`response-row-${item.id}`}>
                      <td className="cell-name">{item.guestName}</td>
                      <td className="cell-email">{item.guestEmail}</td>
                      <td className="cell-decision">
                        {item.status === 'accepted' ? (
                          <span className="badge badge-accepted">Đồng ý</span>
                        ) : item.status === 'declined' ? (
                          <span className="badge badge-declined">Từ chối</span>
                        ) : (
                          <span className="badge badge-pending">Chưa phản hồi</span>
                        )}
                      </td>
                      <td className="cell-message">
                        {item.guestMessage ? item.guestMessage : <span className="empty-dash">—</span>}
                      </td>
                      <td className="cell-time">
                        {item.respondedAt ? (
                          formatVietnamDateTime(item.respondedAt)
                        ) : (
                          <span className="empty-dash">—</span>
                        )}
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
    </>
  );
}
