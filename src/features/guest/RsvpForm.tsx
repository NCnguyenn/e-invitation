'use client';

import { useRef, useState } from 'react';
import type { GuestInvitation, RsvpDecision, RsvpReceipt } from '@/lib/contracts';
import { ResponseReceipt } from './ResponseReceipt';

function isReceipt(value: unknown): value is RsvpReceipt {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (row.status === 'accepted' || row.status === 'declined') && (row.guestMessage === null || typeof row.guestMessage === 'string') && typeof row.respondedAt === 'string';
}

export function RsvpForm({ token, guestName }: { token: string; guestName: string }) {
  const [decision, setDecision] = useState<RsvpDecision | ''>('');
  const [guestMessage, setGuestMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<RsvpReceipt | null>(null);
  const sending = useRef(false);

  async function recover() {
    try {
      const response = await fetch(`/api/guest/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (!response.ok) {
        setError('Chưa xác định được kết quả. Nội dung của bạn vẫn được giữ. Hệ thống không tự gửi lại.');
        return;
      }
      const body = await response.json() as { invitation?: GuestInvitation };
      if (body.invitation?.receipt && isReceipt(body.invitation.receipt)) { setReceipt(body.invitation.receipt); return; }
      if (body.invitation?.status === 'pending') { setError('Chưa lưu được phản hồi. Bạn có thể gửi lại.'); return; }
      setError('Chưa xác định được kết quả. Nội dung của bạn vẫn được giữ. Hệ thống không tự gửi lại.');
    } catch {
      setError('Chưa xác định được kết quả. Nội dung của bạn vẫn được giữ. Hệ thống không tự gửi lại.');
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (!decision) { setError('Vui lòng chọn xác nhận tham gia hoặc không thể tham gia trước khi gửi.'); return; }
    if (!guestMessage.trim()) {
      setError('Vui lòng ghi thêm lời chúc mừng hoặc lời nhắn gửi đến chủ tiệc nhé!');
      const el = document.getElementById('rsvp-message');
      el?.focus();
      return;
    }
    sending.current = true; setPending(true); setError('');
    try {
      const response = await fetch(`/api/guest/${encodeURIComponent(token)}/rsvp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, guestMessage }),
      });
      const body = await response.json().catch(() => null) as { kind?: string; receipt?: unknown; message?: string } | null;
      if ((response.status === 200 || response.status === 409) && body && (body.kind === 'saved' || body.kind === 'already_responded') && isReceipt(body.receipt)) {
        setReceipt(body.receipt); return;
      }
      if (response.status === 422) { setError(body?.message || 'Phản hồi không hợp lệ.'); return; }
      if (response.status === 404) { setError(body?.message || 'Không tìm thấy thư mời.'); return; }
      if (response.status === 403) { setError(body?.message || 'Yêu cầu không hợp lệ.'); return; }
      await recover();
    } catch {
      await recover();
    } finally { sending.current = false; setPending(false); }
  }

  if (receipt) return <ResponseReceipt receipt={receipt} />;
  return <form className="guest-rsvp-form" data-testid="rsvp-form" onSubmit={submit} noValidate aria-busy={pending}>
    <p className="guest-rsvp-name">Tên khách: <strong>{guestName}</strong></p>
    <p className="rsvp-once-note">Bạn chỉ có thể gửi phản hồi một lần. Sau khi gửi, lựa chọn và ghi chú sẽ không thể chỉnh sửa.</p>
    <fieldset disabled={pending} className="preview-fields">
      <legend>Phản hồi của bạn</legend>
      <div className="radio-group">
        <label className="radio-card"><input type="radio" name="rsvp-decision" value="accepted" checked={decision === 'accepted'} onChange={() => setDecision('accepted')} />Tôi sẽ tham gia</label>
        <label className="radio-card"><input type="radio" name="rsvp-decision" value="declined" checked={decision === 'declined'} onChange={() => setDecision('declined')} />Tôi không thể tham gia</label>
      </div>
      <label className="form-label" htmlFor="rsvp-message">
        Ghi chú / lời nhắn <span className="rsvp-required" aria-hidden="true" style={{ color: '#c93b52', fontWeight: 700 }}>*</span>
      </label>
      <textarea
        className={`form-textarea ${error && !guestMessage.trim() ? 'has-error' : ''}`}
        id="rsvp-message"
        maxLength={1000}
        rows={4}
        placeholder="Gửi lời chúc mừng hoặc lời nhắn đến chủ tiệc…"
        value={guestMessage}
        onChange={event => {
          setGuestMessage(event.target.value);
          if (error) setError('');
        }}
      />
      {error && <p className="rsvp-error" role="alert">{error}</p>}
      <button className="btn-rsvp-submit" type="submit" disabled={pending || !decision}>{pending ? 'Đang gửi…' : 'Gửi xác nhận'}</button>
    </fieldset>
  </form>;
}
