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
    <div>
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

      {/* Section 1: Unknown Email Reconciliation */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>📬 Đối soát Email chưa rõ kết quả (Unknown Attempts)</span>
            </h2>
            <div style={{ color: '#64748b', fontSize: '0.825rem', marginTop: '0.25rem' }}>
              Các lượt gửi email bị timeout hoặc gián đoạn mạng cần đối soát thủ công trước khi mở khóa gửi lại.
            </div>
          </div>
          <button className={styles.btnSecondary} onClick={refreshData} disabled={loading}>
            🔄 Làm mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Sự kiện</th>
                <th>Khách mời</th>
                <th>Email nhận</th>
                <th>Thời điểm</th>
                <th>Mã lỗi</th>
                <th>Provider Msg ID</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    Không có lượt gửi nào cần đối soát. Hệ thống đang hoạt động ổn định.
                  </td>
                </tr>
              ) : (
                attempts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{a.eventTitle || '—'}</td>
                    <td>{a.guestName || '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{a.guestEmail || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {a.startedAt ? new Date(a.startedAt).toLocaleString('vi-VN') : a.budgetDate}
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: '#fee2e2', color: '#b91c1c', fontFamily: 'monospace' }}>
                        {a.errorCode || 'TIMEOUT'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {a.providerMessageId ? <code>{a.providerMessageId}</code> : '—'}
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
                        className={styles.btnSecondary}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setResolveAttemptTarget(a);
                          setResolutionText(a.resolution || '');
                          setAllowResend(false);
                          setAlertError(null);
                        }}
                      >
                        {a.resolvedAt ? 'Xem đối soát' : 'Xử lý đối soát'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Storage Maintenance Jobs */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span>🧹 Công việc bảo trì & Dọn dẹp tệp tin (Maintenance Jobs)</span>
            </h2>
            <div style={{ color: '#64748b', fontSize: '0.825rem', marginTop: '0.25rem' }}>
              Theo dõi và thử lại việc dọn dẹp file Storage khi xóa Host hoặc xóa Sự kiện nếu có lỗi phát sinh.
            </div>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Hạng mục</th>
                <th>Target ID</th>
                <th>Đường dẫn tệp (Prefixes)</th>
                <th>Trạng thái</th>
                <th>Lỗi gần nhất</th>
                <th>Thời điểm tạo</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    Không có công việc bảo trì nào tồn đọng.
                  </td>
                </tr>
              ) : (
                jobs.map(j => (
                  <tr key={j.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>
                      {j.kind === 'delete_event' ? 'Xóa Sự kiện' : j.kind === 'delete_host' ? 'Xóa Host' : 'Dọn tệp'}
                    </td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#64748b' }}>
                      {j.targetId.slice(0, 8)}…
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {j.objectPrefixes.join(', ')}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${
                        j.status === 'completed'
                          ? styles.badgeSuccess
                          : j.status === 'failed'
                          ? styles.badgeDanger
                          : styles.badgeWarning
                      }`}>
                        {j.status === 'completed' ? 'Thành công' : j.status === 'failed' ? 'Thất bại' : 'Đang chạy'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                      {j.lastErrorCode || '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(j.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {j.status === 'failed' || j.status === 'running' ? (
                        <button
                          className={styles.btnPrimary}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => handleRetryJob(j.id)}
                          disabled={loading}
                        >
                          Thử lại
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
                  <div><strong>Mã lỗi:</strong> <span style={{ color: '#dc2626' }}>{resolveAttemptTarget.errorCode || 'TIMEOUT'}</span></div>
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
