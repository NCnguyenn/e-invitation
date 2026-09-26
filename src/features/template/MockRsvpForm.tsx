'use client';

import { useState } from 'react';
import type { RsvpDecision, RsvpReceipt } from '@/lib/contracts';
import { ResponseReceipt } from '@/features/guest/ResponseReceipt';

export function MockRsvpForm({ guestName }: { guestName: string }) {
  const [decision, setDecision] = useState<RsvpDecision | ''>('');
  const [guestMessage, setGuestMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<RsvpReceipt | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision) {
      setError('Hãy chọn tham gia hoặc từ chối trước khi gửi.');
      return;
    }
    setError('');
    setPending(true);

    // Giả lập gửi phản hồi (không gọi backend / không lưu database)
    setTimeout(() => {
      setReceipt({
        status: decision,
        guestMessage: guestMessage.trim() || null,
        respondedAt: new Date().toISOString(),
      });
      setPending(false);
    }, 300);
  }

  function handleReset() {
    setReceipt(null);
    setDecision('');
    setGuestMessage('');
    setError('');
  }

  if (receipt) {
    return (
      <div className="preview-receipt-wrapper">
        <ResponseReceipt receipt={receipt} />
        <div className="preview-receipt-footer">
          <p className="preview-receipt-notice">
            💡 <strong>Chế độ xem trước</strong>: Phản hồi này hiển thị để bạn kiểm tra giao diện, không lưu vào hệ thống.
          </p>
          <button
            type="button"
            className="btn-rsvp-reset"
            onClick={handleReset}
          >
            ↻ Thử lại phản hồi khác
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="guest-rsvp-form preview-rsvp-form" onSubmit={handleSubmit} noValidate aria-busy={pending}>
      <p className="guest-rsvp-name">Tên khách: <strong>{guestName}</strong></p>
      <p className="rsvp-once-note">
        Chế độ xem thử: Bạn có thể chọn và nhập thử lời chúc để kiểm tra giao diện.
      </p>
      <fieldset disabled={pending} className="preview-fields">
        <legend className="sr-only">Phản hồi của khách mời</legend>
        <div className="radio-group">
          <label className="radio-card">
            <input
              type="radio"
              name="preview-decision"
              value="accepted"
              checked={decision === 'accepted'}
              onChange={() => setDecision('accepted')}
            />
            Tôi sẽ tham gia
          </label>
          <label className="radio-card">
            <input
              type="radio"
              name="preview-decision"
              value="declined"
              checked={decision === 'declined'}
              onChange={() => setDecision('declined')}
            />
            Tôi không thể tham gia
          </label>
        </div>
        <label className="form-label" htmlFor="preview-guest-message">
          Ghi chú / lời nhắn
        </label>
        <textarea
          className="form-textarea"
          id="preview-guest-message"
          maxLength={1000}
          rows={3}
          placeholder="Gửi lời chúc mừng hoặc lời nhắn đến chủ tiệc…"
          value={guestMessage}
          onChange={(e) => setGuestMessage(e.target.value)}
        />
        <button
          className="btn-rsvp-submit"
          type="submit"
          disabled={pending || !decision}
        >
          {pending ? 'Đang gửi…' : 'Gửi xác nhận (Xem trước)'}
        </button>
      </fieldset>
      {error && <p className="rsvp-error" role="alert">{error}</p>}
    </form>
  );
}
