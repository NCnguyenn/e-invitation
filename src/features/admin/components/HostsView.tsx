'use client';

import React, { useState, useMemo } from 'react';
import type { AdminHostItem } from '../contracts';
import styles from './admin.module.css';

interface HostsViewProps {
  initialHosts: AdminHostItem[];
  onHostsUpdated?: () => void;
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export function HostsView({
  initialHosts,
  onHostsUpdated,
  createModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}: HostsViewProps) {
  const [hosts, setHosts] = useState<AdminHostItem[]>(initialHosts);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [newHostEmail, setNewHostEmail] = useState('');
  const [oneTimePasswordData, setOneTimePasswordData] = useState<{ email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const [deleteHostTarget, setDeleteHostTarget] = useState<AdminHostItem | null>(null);
  const [deleteHostConfirmEmail, setDeleteHostConfirmEmail] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Sync state if initialHosts changes
  React.useEffect(() => {
    setHosts(initialHosts);
  }, [initialHosts]);

  async function refreshHosts() {
    try {
      const res = await fetch('/api/admin/hosts');
      if (res.ok) {
        const data = await res.json();
        setHosts(data.hosts || []);
        if (onHostsUpdated) onHostsUpdated();
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
      await refreshHosts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Lỗi khi xóa host.');
    } finally {
      setActionLoading(false);
    }
  }

  // Filtered hosts
  const filteredHosts = useMemo(() => {
    if (!searchTerm.trim()) return hosts;
    const term = searchTerm.toLowerCase();
    return hosts.filter(h => h.email.toLowerCase().includes(term) || h.userId.toLowerCase().includes(term));
  }, [hosts, searchTerm]);

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

      {/* Main Host Table Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.listHeading}>
            <h2 className={styles.sectionTitle}>
              <span>👥 Danh sách Host ({filteredHosts.length})</span>
            </h2>
            <div className={styles.searchBox}>
              <span>🔍</span>
              <input
                type="search"
                aria-label="Tìm Host theo email hoặc mã tài khoản"
                placeholder="Tìm theo email hoặc mã tài khoản…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={() => { onOpenCreateModal(); setActionError(null); }}>
            + Tạo Host mới
          </button>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.dataTable} aria-label="Danh sách khách hàng Host">
            <thead>
              <tr>
                <th>Email Khách hàng</th>
                <th>Số sự kiện</th>
                <th>Ngày tạo tài khoản</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredHosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    {searchTerm ? 'Không tìm thấy Host nào phù hợp với từ khóa.' : 'Chưa có Host nào trong hệ thống.'}
                  </td>
                </tr>
              ) : (
                filteredHosts.map(h => (
                  <tr key={h.userId}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{h.email}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>ID: {h.userId.slice(0, 8)}…</div>
                    </td>
                    <td>
                      <span className={styles.badge} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                        {h.eventCount} sự kiện
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {new Date(h.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${h.lifecycleStatus === 'active' ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {h.lifecycleStatus === 'active' ? 'Hoạt động' : 'Đang dọn dẹp'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.btnDanger}
                        onClick={() => {
                          setDeleteHostTarget(h);
                          setDeleteHostConfirmEmail('');
                          setActionError(null);
                        }}
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
      </div>

      {/* MODAL 1: Create Host Modal */}
      {createModalOpen ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Tạo tài khoản Host mới</h3>
              <button
                className={styles.modalClose}
                onClick={() => {
                  onCloseCreateModal();
                  setOneTimePasswordData(null);
                  setCopiedPassword(false);
                }}
              >
                ×
              </button>
            </div>

            {oneTimePasswordData ? (
              <div className={styles.modalBody}>
                <div className={styles.passwordAlert}>
                  <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.9rem' }}>
                    QUAN TRỌNG: MẬT KHẨU HIỂN THỊ MỘT LẦN DUY NHẤT
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                    Hệ thống không lưu mật khẩu ở dạng plain text. Hãy sao chép ngay để bàn giao cho khách hàng!
                  </div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Tài khoản Host:</label>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{oneTimePasswordData.email}</div>
                </div>

                <div className={styles.formField}>
                  <label className={styles.formLabel}>Mật khẩu khởi tạo (16 ký tự an toàn):</label>
                  <div className={styles.passwordBox}>
                    <span>{oneTimePasswordData.password}</span>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        navigator.clipboard.writeText(oneTimePasswordData.password);
                        setCopiedPassword(true);
                      }}
                    >
                      {copiedPassword ? '✓ Đã chép' : '📋 Sao chép'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      onCloseCreateModal();
                      setOneTimePasswordData(null);
                      setCopiedPassword(false);
                    }}
                  >
                    Hoàn tất & Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateHost}>
                <div className={styles.modalBody}>
                  {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Địa chỉ Email khách hàng *</label>
                    <input
                      type="email"
                      required
                      className={styles.formInput}
                      placeholder="host@example.com"
                      value={newHostEmail}
                      onChange={e => setNewHostEmail(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Server tự động tạo tài khoản Supabase Auth, gán vai trò Host và sinh mật khẩu 16 ký tự.
                    </span>
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
                    {actionLoading ? 'Đang tạo…' : 'Tạo tài khoản & Cấp mật khẩu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* MODAL 2: Delete Host Confirmation */}
      {deleteHostTarget ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: '#dc2626' }}>Xác nhận xóa tài khoản Host</h3>
              <button className={styles.modalClose} onClick={() => setDeleteHostTarget(null)}>×</button>
            </div>

            <form onSubmit={handleDeleteHost}>
              <div className={styles.modalBody}>
                <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>
                  <div>
                    <strong>CẢNH BÁO AN TOÀN DỮ LIỆU:</strong> Toàn bộ sự kiện, tệp âm thanh trong Storage và lời mời của khách hàng này sẽ được dọn dẹp trước khi xóa tài khoản auth.
                  </div>
                </div>

                {actionError ? <div className={`${styles.alertBanner} ${styles.dangerAlert}`}>{actionError}</div> : null}

                <div className={styles.formField}>
                  <label className={styles.formLabel}>
                    Vui lòng nhập lại chính xác email <code>{deleteHostTarget.email}</code> để xác nhận:
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
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setDeleteHostTarget(null)}
                  disabled={actionLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={styles.btnDanger}
                  disabled={actionLoading || deleteHostConfirmEmail.trim().toLowerCase() !== deleteHostTarget.email.trim().toLowerCase()}
                >
                  {actionLoading ? 'Đang dọn tệp & xóa…' : 'Xác nhận xóa vĩnh viễn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
