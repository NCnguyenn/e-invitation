'use client';

import React, { useState } from 'react';
import type { AdminUnknownAttempt, AdminMaintenanceJob } from '../contracts';
import styles from './admin.module.css';

interface OperationsViewProps {
  initialAttempts: AdminUnknownAttempt[];
  initialJobs: AdminMaintenanceJob[];
}

export function OperationsView({ initialAttempts, initialJobs }: OperationsViewProps) {
  const [attempts, setAttempts] = useState<AdminUnknownAttempt[]>(initialAttempts);
  const [jobs, setJobs] = useState<AdminMaintenanceJob[]>(initialJobs);

  // Modals state
  const [resolveAttemptTarget, setResolveAttemptTarget] = useState<AdminUnknownAttempt | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [allowResend, setAllowResend] = useState(false);

  const [loading, setLoading] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);

  async function refreshData() {
    try {
      const res = await fetch('/api/admin/reconciliation');
      if (res.ok) {
        const data = await res.json();
        setAttempts(data.attempts || []);
        setJobs(data.jobs || []);
      }
    } catch {
      // Ignore
    }
  }

  async function handleResolveAttempt(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveAttemptTarget) return;

    setLoading(true);
    setAlertError(null);
    try {
      const res = await fetch('/api/admin/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve',
          attemptId: resolveAttemptTarget.id,
          resolution: resolutionText,
          allowResend,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi giải quyết đối soát.');

      setAlertSuccess('Đã cập nhật trạng thái đối soát thành công.');
      setResolveAttemptTarget(null);
      setResolutionText('');
      setAllowResend(false);
      await refreshData();
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetryJob(jobId: string) {
    setLoading(true);
    setAlertError(null);
    try {
      const res = await fetch('/api/admin/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'retry_job',
          jobId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi thử lại công việc bảo trì.');

      setAlertSuccess(data.message || 'Đã hoàn tất thử lại công việc.');
      await refreshData();
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.operationsPage}>
      {/* Alert notifications */}
      {alertSuccess ? (
        <div className={styles.alertBanner} style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', marginBottom: '1.5rem' }}>
          ✓ {alertSuccess}
          <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }} onClick={() => setAlertSuccess(null)}>×</button>
        </div>
      ) : null}

      {alertError ? (
        <div className={`${styles.alertBanner} ${styles.dangerAlert}`} style={{ marginBottom: '1.5rem' }}>
          ⚠ {alertError}
          <button style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }} onClick={() => setAlertError(null)}>×</button>
        </div>
      ) : null}

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Email chưa rõ kết quả</h2>
            <p className={styles.sectionDescription}>
              Các lượt gửi email bị timeout hoặc gián đoạn mạng cần đối soát thủ công trước khi mở khóa gửi lại.
            </p>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={refreshData} disabled={loading}>
            {loading ? 'Đang tải…' : 'Làm mới danh sách'}
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Sự kiện</th>
                <th>Khách mời / Email</th>
                <th>Thời điểm</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    Không có lượt gửi email cần đối soát trong danh sách đã tải.
                  </td>
                </tr>
              ) : (
                attempts.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div className={styles.tablePrimaryCell}>{a.eventTitle || '—'}</div>
                      <details className={styles.inlineDetails}>
                        <summary>Chi tiết gửi</summary>
                        <div><span>Mã lỗi:</span> <code>{a.errorCode || '—'}</code></div>
                        <div><span>Provider message ID:</span> <code>{a.providerMessageId || '—'}</code></div>
                        <div><span>Attempt ID:</span> <code>{a.id}</code></div>
                      </details>
                    </td>
                    <td>
                      <div className={styles.tablePrimaryCell}>{a.guestName || '—'}</div>
                      <div className={styles.tableCellSecondary}>{a.guestEmail || 'Chưa có email'}</div>
                    </td>
                    <td className={styles.tableCellSecondary}>
                      {a.startedAt ? new Date(a.startedAt).toLocaleString('vi-VN') : a.budgetDate}
                    </td>
                    <td>
                      {a.resolvedAt ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`} title={a.resolution || ''}>
                          Đã đối soát
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>
                          Chờ xử lý
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        aria-label={`${a.resolvedAt ? 'Xem' : 'Mở'} đối soát email ${a.guestEmail || a.id}`}
                        onClick={() => {
                          setResolveAttemptTarget(a);
                          setResolutionText(a.resolution || '');
                          setAllowResend(false);
                          setAlertError(null);
                        }}
                      >
                        {a.resolvedAt ? 'Xem' : 'Đối soát'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Công việc bảo trì</h2>
            <p className={styles.sectionDescription}>
              Theo dõi và thử lại việc dọn dẹp file Storage khi xóa Host hoặc xóa Sự kiện nếu có lỗi phát sinh.
            </p>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Công việc</th>
                <th>Đối tượng</th>
                <th>Cập nhật</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    Không có công việc bảo trì trong danh sách đã tải.
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.id}>
                    <td className={styles.tablePrimaryCell}>
                      {j.kind === 'delete_event' ? 'Xóa Sự kiện' : j.kind === 'delete_host' ? 'Xóa Host' : 'Dọn tệp'}
                      <details className={styles.inlineDetails}>
                        <summary>Chi tiết công việc</summary>
                        <div><span>Job ID:</span> <code>{j.id}</code></div>
                        <div><span>Target ID:</span> <code>{j.targetId}</code></div>
                        <div><span>Đường dẫn:</span> <code>{j.objectPrefixes.join(', ') || '—'}</code></div>
                        <div><span>Mã lỗi gần nhất:</span> <code>{j.lastErrorCode || '—'}</code></div>
                      </details>
                    </td>
                    <td>
                      <code className={styles.shortId}>{j.targetId.slice(0, 8)}…</code>
                      <div className={styles.tableCellSecondary}>{j.kind === 'delete_event' ? 'Sự kiện' : j.kind === 'delete_host' ? 'Host' : 'Tệp lưu trữ'}</div>
                    </td>
                    <td className={styles.tableCellSecondary}>
                      {new Date(j.updatedAt).toLocaleString('vi-VN')}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${
                        j.status === 'completed'
                          ? styles.badgeSuccess
                          : j.status === 'failed'
                          ? styles.badgeDanger
                          : styles.badgeWarning
                      }`}>
                        {j.status === 'completed' ? 'Đã hoàn thành' : j.status === 'failed' ? 'Thất bại' : j.status === 'pending' ? 'Chờ xử lý' : 'Đang chạy'}
                      </span>
                    </td>
                    <td>
                      {j.status === 'failed' || j.status === 'running' ? (
                        <button
                          type="button"
                          className={styles.btnPrimary}
                          onClick={() => handleRetryJob(j.id)}
                          disabled={loading}
                        >
                          {loading ? 'Đang xử lý…' : 'Thử lại'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Đã hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Resolve Unknown Attempt */}
      {resolveAttemptTarget ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Xử lý đối soát email</h3>
              <button className={styles.modalClose} onClick={() => setResolveAttemptTarget(null)}>×</button>
            </div>

            <form onSubmit={handleResolveAttempt}>
              <div className={styles.modalBody}>
                <div style={{ fontSize: '0.85rem', color: '#475569', background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div><strong>Sự kiện:</strong> {resolveAttemptTarget.eventTitle || '—'}</div>
                  <div><strong>Khách mời:</strong> {resolveAttemptTarget.guestName} ({resolveAttemptTarget.guestEmail})</div>
                  <div><strong>Attempt ID:</strong> <code>{resolveAttemptTarget.id}</code></div>
                  <div><strong>Mã lỗi:</strong> <span style={{ color: '#dc2626' }}>{resolveAttemptTarget.errorCode || '—'}</span></div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Ghi chú xử lý / Kết quả đối soát *</label>
                  <textarea
                    required
                    rows={3}
                    className={styles.formTextarea}
                    placeholder="Ví dụ: Đã kiểm tra dashboard Brevo, thư không được gửi do lỗi kết nối. Cho phép host gửi lại."
                    value={resolutionText}
                    onChange={e => setResolutionText(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="checkbox"
                    id="allowResendCheckbox"
                    checked={allowResend}
                    onChange={e => setAllowResend(e.target.checked)}
                  />
                  <label htmlFor="allowResendCheckbox" style={{ fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, color: '#0f172a' }}>
                    Cho phép Host gửi lại thư mời cho khách này
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setResolveAttemptTarget(null)}
                  disabled={loading}
                >
                  Đóng
                </button>
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? 'Đang lưu…' : 'Lưu kết quả đối soát'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
