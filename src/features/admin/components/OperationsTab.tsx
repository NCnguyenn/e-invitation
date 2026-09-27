'use client';

import React, { useState } from 'react';
import type { AdminUnknownAttempt, AdminMaintenanceJob } from '../contracts';
import styles from './admin.module.css';

interface OperationsTabProps {
  initialAttempts: AdminUnknownAttempt[];
  initialJobs: AdminMaintenanceJob[];
}

export function OperationsTab({ initialAttempts, initialJobs }: OperationsTabProps) {
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
      {/* Alert banners */}
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
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Đối soát Email chưa rõ kết quả (Unknown Attempts)</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Các lượt gửi bị timeout, mất kết nối hoặc server dừng đột ngột (Mục 0.6 & 7.1). Cần đối soát thủ công trước khi cho phép gửi lại.
            </p>
          </div>
          <button className={styles.actionBtn} onClick={refreshData} disabled={loading}>
            🔄 Làm mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Sự kiện</th>
                <th>Khách mời</th>
                <th>Email</th>
                <th>Ngày gửi</th>
                <th>Mã lỗi</th>
                <th>Provider Msg ID</th>
                <th>Đối soát</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    Không có lượt gửi nào ở trạng thái unknown. Hệ thống đang hoạt động ổn định.
                  </td>
                </tr>
              ) : (
                attempts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.eventTitle || '—'}</td>
                    <td>{a.guestName || '—'}</td>
                    <td>{a.guestEmail || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {a.startedAt ? new Date(a.startedAt).toLocaleString('vi-VN') : a.budgetDate}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{a.errorCode || 'TIMEOUT'}</code>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {a.providerMessageId ? <code>{a.providerMessageId}</code> : '—'}
                    </td>
                    <td>
                      {a.resolvedAt ? (
                        <span className={`${styles.badge} ${styles.badgeFresh}`} title={a.resolution || ''}>
                          Đã giải quyết
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeRateLimited}`}>
                          Chờ xử lý
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.actionBtn}
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
      </section>

      {/* Section 2: Maintenance Jobs */}
      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Công việc bảo trì & dọn dẹp Storage (Maintenance Jobs)</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Theo dõi các tiến trình dọn dẹp tệp tin storage khi xóa host hoặc xóa sự kiện (Mục 5.4).
            </p>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Loại công việc</th>
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
                    <td style={{ fontWeight: 600 }}>
                      {j.kind === 'delete_event' ? 'Xóa Sự kiện' : j.kind === 'delete_host' ? 'Xóa Host' : 'Dọn tệp tin'}
                    </td>
                    <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {j.targetId.slice(0, 8)}…
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {j.objectPrefixes.join(', ')}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${
                        j.status === 'completed'
                          ? styles.badgeFresh
                          : j.status === 'failed'
                          ? styles.badgeForbidden
                          : styles.badgeStale
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                      {j.lastErrorCode || '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {new Date(j.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {j.status === 'failed' || j.status === 'running' ? (
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleRetryJob(j.id)}
                          disabled={loading}
                        >
                          Thử lại xóa
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Không cần xử lý</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL: Resolve Unknown Attempt */}
      {resolveAttemptTarget ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Xử lý đối soát email</h3>
              <button className={styles.modalClose} onClick={() => setResolveAttemptTarget(null)}>×</button>
            </div>

            <form onSubmit={handleResolveAttempt} className={styles.modalBody}>
              <div style={{ fontSize: '0.875rem', color: '#475569', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                <div><strong>Sự kiện:</strong> {resolveAttemptTarget.eventTitle || '—'}</div>
                <div><strong>Người nhận:</strong> {resolveAttemptTarget.guestName} ({resolveAttemptTarget.guestEmail})</div>
                <div><strong>Attempt ID:</strong> <code>{resolveAttemptTarget.id}</code></div>
                <div><strong>Lỗi ghi nhận:</strong> {resolveAttemptTarget.errorCode || 'TIMEOUT / DISCONNECTED'}</div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Ghi chú xử lý / Lý do đối soát *</label>
                <textarea
                  required
                  rows={3}
                  className={styles.formTextarea}
                  placeholder="Ví dụ: Đã kiểm tra dashboard Brevo, thư không được gửi do lỗi kết nối. Cho phép host gửi lại."
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="allowResendCheckbox"
                  checked={allowResend}
                  onChange={e => setAllowResend(e.target.checked)}
                />
                <label htmlFor="allowResendCheckbox" style={{ fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}>
                  Cho phép Host gửi lại thư mời cho khách này
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className={styles.actionBtn} onClick={() => setResolveAttemptTarget(null)} disabled={loading}>
                  Đóng
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={loading}>
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
