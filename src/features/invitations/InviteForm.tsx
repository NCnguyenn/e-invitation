'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorIcon } from '@/features/events/EditorIcon';

type CreatedLink = { invitationId: string; invitePath: string; href: string; duplicate: boolean };

export function InviteForm({ onCreated }: { onCreated?: () => void } = {}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const createdRef = useRef<CreatedLink | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  async function copy(href: string) {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setStatus((current) => (current.includes('Đã sao chép') ? current : `${current} Đã sao chép liên kết.`.trim()));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Không sao chép tự động được. Hãy chọn liên kết và sao chép thủ công.');
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      let current = createdRef.current;
      if (!current) {
        const response = await fetch('/api/host/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestName: name, guestEmail: email, invitationNote: note }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status !== 201 && response.status !== 409) {
          setError(body.message || 'Không thể tạo thư mời. Thông tin bạn nhập vẫn được giữ lại.');
          return;
        }
        if (typeof body.invitePath !== 'string' || typeof body.invitationId !== 'string') {
          setError('Máy chủ trả về kết quả không hợp lệ. Chưa xác nhận đã tạo thư mời.');
          return;
        }
        current = {
          invitationId: body.invitationId,
          invitePath: body.invitePath,
          href: `${window.location.origin}${body.invitePath}`,
          duplicate: response.status === 409,
        };
        setCreated(current);
        onCreated?.();
        if (current.duplicate) {
          createdRef.current = null;
          requestIdRef.current = null;
          setNeedsCheck(false);
          setStatus('Email này đã có thư mời. Đường dẫn bên dưới là thư mời hiện tại. Bạn có thể sao chép liên kết hoặc gửi lại trên danh sách bên dưới.');
          setName('');
          setEmail('');
          setNote('');
          return;
        }
        createdRef.current = current;
      }

      if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
      const response = await fetch(`/api/host/invitations/${current.invitationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: requestIdRef.current }),
      });
      const body = await response.json().catch(() => ({}));
      const message = typeof body.message === 'string' ? body.message : 'Máy chủ không trả kết quả gửi rõ ràng.';
      const emailStatus = typeof body.emailStatus === 'string' ? body.emailStatus : '';
      const terminal = emailStatus === 'sent' || emailStatus === 'failed' || emailStatus === 'unknown' || emailStatus === 'sending';
      if (!response.ok || !terminal) {
        setNeedsCheck(false);
        setError(message);
        setStatus('Thư mời đã được lưu lại an toàn. Không tạo thêm khách trùng lặp.');
        if (body.code === 'cooldown' || body.code === 'internal_cap' || body.code === 'unresolved_attempt' || emailStatus) {
          requestIdRef.current = null;
          createdRef.current = null;
          setName('');
          setEmail('');
          setNote('');
        }
        onCreated?.();
        return;
      }
      setNeedsCheck(false);
      if (emailStatus === 'unknown' || emailStatus === 'sending') {
        setError(message);
        setStatus('Thư mời đã được lưu lại an toàn. Không tạo thêm khách.');
      } else {
        setError('');
        setStatus(message);
      }
      setName('');
      setEmail('');
      setNote('');
      requestIdRef.current = null;
      createdRef.current = null;
      onCreated?.();
    } catch {
      setNeedsCheck(true);
      setError('Không thể kết nối máy chủ. Nếu thư mời đã tạo, bấm Kiểm tra lại để xác nhận trạng thái mà không bị tạo trùng khách.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="invitation-page-header">
        <div className="header-badge-row">
          <span className="editor-eyebrow">Quản lý khách mời</span>
        </div>
        <h1 className="invitation-main-title">Gửi thư mời cá nhân</h1>
        <p className="invitation-main-desc">
          Soạn thông tin người nhận để tạo đường dẫn thiệp cưới riêng biệt và gửi email thông báo trực tiếp.
        </p>

        <div className="invite-callout-banner">
          <div className="callout-icon">
            <EditorIcon name="info" width="20" height="20" />
          </div>
          <div className="callout-content">
            <strong>Cơ chế gửi email tự động qua Brevo:</strong> Khi gửi thư mời, hệ thống sẽ chuyển email đến cổng tiếp nhận Brevo. Khách mời sẽ nhận được thư chứa lời mời riêng và đường dẫn cá nhân để mở thiệp.
          </div>
        </div>
      </header>

      <section className="editor-card invite-create-card" aria-labelledby="invite-heading">
        <div className="card-header-styled">
          <div className="card-icon-badge">
            <EditorIcon name="envelope" width="22" height="22" />
          </div>
          <div>
            <h2 id="invite-heading" className="card-title-styled">Thông tin người nhận</h2>
            <p className="card-subtitle-styled">Mỗi email chỉ tương ứng với một thư mời duy nhất trong sự kiện để tránh gửi trùng lặp.</p>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <fieldset disabled={!ready || pending} className="event-fields">
            <div className="form-grid-2col">
              <div className="form-field-box">
                <label htmlFor="guest-name-input" className="form-label-styled">
                  <EditorIcon name="user" width="16" height="16" />
                  <span>Tên khách mời <span className="text-required">*</span></span>
                </label>
                <div className="input-styled-wrapper">
                  <input
                    id="guest-name-input"
                    className="input-styled"
                    placeholder="Ví dụ: Anh Hoàng Nam, Gia đình Bác Hải…"
                    value={name}
                    maxLength={255}
                    required
                    onChange={(event) => { setName(event.target.value); setError(''); }}
                  />
                </div>
              </div>

              <div className="form-field-box">
                <label htmlFor="guest-email-input" className="form-label-styled">
                  <EditorIcon name="envelope" width="16" height="16" />
                  <span>Email nhận thư mời <span className="text-required">*</span></span>
                </label>
                <div className="input-styled-wrapper">
                  <input
                    id="guest-email-input"
                    type="email"
                    className="input-styled"
                    placeholder="hoangnam@example.com"
                    value={email}
                    maxLength={255}
                    required
                    autoComplete="off"
                    onChange={(event) => { setEmail(event.target.value); setError(''); }}
                  />
                </div>
              </div>
            </div>

            <div className="form-field-box full-width">
              <div className="label-with-meta">
                <label htmlFor="guest-note-input" className="form-label-styled">
                  <EditorIcon name="note" width="16" height="16" />
                  <span>Lời mời riêng cho khách (tùy chọn)</span>
                </label>
                <span className="char-badge">{note.length}/500 ký tự</span>
              </div>
              <div className="input-styled-wrapper">
                <textarea
                  id="guest-note-input"
                  className="textarea-styled"
                  rows={3}
                  placeholder="Nhập lời chúc hoặc lời nhắn nhủ riêng dành cho vị khách này (lời nhắn sẽ xuất hiện trang trọng trên thiệp)…"
                  value={note}
                  maxLength={500}
                  onChange={(event) => { setNote(event.target.value); setError(''); }}
                />
              </div>
              <p className="field-subnote">Gợi ý: Lời nhắn riêng giúp khách mời cảm nhận được sự chu đáo và ấm áp của chủ tiệc.</p>
            </div>

            <div className="form-submit-bar">
              <button
                className="button-primary-luxury"
                type="submit"
                disabled={pending || !name.trim() || !email.trim()}
              >
                {pending ? (
                  <>
                    <span className="spinner-border" aria-hidden="true" />
                    <span>Đang gửi thư mời…</span>
                  </>
                ) : needsCheck ? (
                  <>
                    <EditorIcon name="refresh" width="18" height="18" />
                    <span>Kiểm tra lại trạng thái</span>
                  </>
                ) : (
                  <>
                    <EditorIcon name="send" width="17" height="17" />
                    <span>Gửi lời mời ngay</span>
                  </>
                )}
              </button>
            </div>
          </fieldset>

          <div className="editor-feedback-styled">
            {error && (
              <div className="alert-box alert-error" role="alert">
                <EditorIcon name="info" width="18" height="18" />
                <span>{error}</span>
              </div>
            )}
            {status && !error && (
              <div className="alert-box alert-success" role="status" aria-live="polite">
                <EditorIcon name="check" width="18" height="18" />
                <span>{status}</span>
              </div>
            )}
          </div>
          <noscript>Vui lòng bật JavaScript để gửi thư mời.</noscript>
        </form>

        {created && (
          <div className="created-invitation-container" data-duplicate={created.duplicate}>
            <div className="created-invitation-badge">
              <EditorIcon name={created.duplicate ? 'info' : 'sparkles'} width="16" height="16" />
              <span>{created.duplicate ? 'Thư mời đã có trong sự kiện' : 'Khởi tạo thư mời thành công!'}</span>
            </div>

            <div className="created-invitation-content">
              <label htmlFor="invite-link-output" className="created-link-title">
                Liên kết thiệp cá nhân của khách:
              </label>
              <div className="created-link-box">
                <input
                  id="invite-link-output"
                  data-testid="invite-link"
                  readOnly
                  value={created.href}
                  className="created-link-input"
                />
                <div className="created-link-actions">
                  <button
                    className={`btn-action-copy ${copied ? 'copied' : ''}`}
                    type="button"
                    onClick={() => copy(created.href)}
                    title="Sao chép đường dẫn thiệp"
                  >
                    <EditorIcon name={copied ? 'check' : 'copy'} width="16" height="16" />
                    <span>{copied ? 'Đã sao chép' : 'Sao chép link'}</span>
                  </button>
                  <a
                    className="btn-action-open"
                    href={created.invitePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mở thiệp xem thử trong tab mới"
                  >
                    <EditorIcon name="external" width="16" height="16" />
                    <span>Mở thiệp xem</span>
                  </a>
                </div>
              </div>
              <div className="created-invitation-meta">
                <span>Mã định danh thư mời: <code>{created.invitationId}</code></span>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
