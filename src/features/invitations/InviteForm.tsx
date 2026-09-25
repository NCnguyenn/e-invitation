'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [needsCheck, setNeedsCheck] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const createdRef = useRef<CreatedLink | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  async function copy(href: string) {
    try {
      await navigator.clipboard.writeText(href);
      setStatus((current) => (current.includes('Đã sao chép') ? current : `${current} Đã sao chép liên kết.`));
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
          setStatus('Email này đã có thư mời. Đường dẫn bên dưới là thư mời cũ. Thao tác này không gửi thêm email. Hãy dùng Gửi lại trên dòng khách nếu muốn gửi.');
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
        setStatus('Thư mời đã được giữ. Không tạo thêm khách.');
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
        setStatus('Thư mời đã được giữ. Không tạo thêm khách.');
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
      setError('Không thể kết nối. Nếu thư mời đã tạo, bấm Kiểm tra lại để dùng cùng mã yêu cầu. Không tạo thêm khách.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="editor-heading">
        <div>
          <p className="editor-eyebrow">Khách mời</p>
          <h1>Gửi thư mời cá nhân</h1>
          <p>Nút này tạo thư mời rồi gửi email. “Brevo đã tiếp nhận” không có nghĩa thư đã vào hộp thư.</p>
        </div>
      </header>
      <section className="editor-card" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Thông tin khách</h2>
        <p className="card-description">Mỗi email chỉ có một thư mời trong sự kiện. Nếu tạo được nhưng gửi lỗi, dòng khách và liên kết vẫn được giữ.</p>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={!ready || pending} className="event-fields">
            <label htmlFor="guest-name-input">Tên khách</label>
            <input id="guest-name-input" value={name} maxLength={255} required onChange={(event) => { setName(event.target.value); setError(''); }} />
            <label htmlFor="guest-email-input">Email</label>
            <input id="guest-email-input" type="email" value={email} maxLength={255} required autoComplete="off" onChange={(event) => { setEmail(event.target.value); setError(''); }} />
            <label htmlFor="guest-note-input">Lời mời riêng</label>
            <textarea id="guest-note-input" value={note} maxLength={500} rows={4} onChange={(event) => { setNote(event.target.value); setError(''); }} />
            <div className="editor-actions">
              <button className="button-primary" type="submit" disabled={pending}>
                {pending ? 'Đang gửi…' : needsCheck ? 'Kiểm tra lại' : 'Gửi lời mời'}
              </button>
            </div>
          </fieldset>
          <div className="editor-feedback">
            {error && <p className="editor-error" role="alert">{error}</p>}
            <p role="status" aria-live="polite">{status}</p>
          </div>
          <noscript>Vui lòng bật JavaScript để gửi thư mời.</noscript>
        </form>
        {created && (
          <div className="invite-link-row">
            <label htmlFor="invite-link-output">Liên kết cá nhân</label>
            <input id="invite-link-output" data-testid="invite-link" readOnly value={created.href} />
            <div className="invite-actions">
              <button className="button-secondary" type="button" onClick={() => copy(created.href)}>Sao chép liên kết</button>
              <a className="button-primary" href={created.invitePath} target="_blank" rel="noopener noreferrer">Mở thiệp</a>
            </div>
            <p className="field-help">Mã thư mời: {created.invitationId}</p>
          </div>
        )}
      </section>
    </>
  );
}
