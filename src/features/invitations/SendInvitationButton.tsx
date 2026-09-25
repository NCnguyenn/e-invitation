'use client';

import { useEffect, useRef, useState } from 'react';
import type { HostInvitationItem } from '@/lib/contracts';
import { EMAIL_UNKNOWN_HELP } from '@/features/email/labels';

type SendOp = { requestId: string; settled: boolean };

export function SendInvitationButton({
  item,
  onSent,
}: {
  item: HostInvitationItem;
  onSent: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const opRef = useRef<SendOp | null>(null);
  const locked = item.emailStatus === 'unknown' || item.emailStatus === 'sending';
  const heldUntil = item.lastSendAttemptAt ? Date.parse(item.lastSendAttemptAt) + 60_000 : 0;
  const heldRemaining = Number.isFinite(heldUntil) ? Math.max(0, Math.ceil((heldUntil - now) / 1000)) : 0;
  const localRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const remaining = Math.max(heldRemaining, localRemaining);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [item.lastSendAttemptAt, remaining > 0]);

  async function send() {
    if (pending || locked || remaining > 0) return;
    const op = opRef.current && !opRef.current.settled
      ? opRef.current
      : { requestId: crypto.randomUUID(), settled: false };
    opRef.current = op;
    setPending(true);
    setFeedback('');
    try {
      const response = await fetch(`/api/host/invitations/${item.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: op.requestId }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 0) throw new Error('network');
      op.settled = true;
      if (typeof body.retryAfterSeconds === 'number') {
        setCooldownUntil(Date.now() + body.retryAfterSeconds * 1000);
      }
      setFeedback(typeof body.message === 'string' ? body.message : 'Máy chủ không trả kết quả gửi rõ ràng.');
      onSent();
    } catch {
      op.settled = false;
      setFeedback('Chưa kết nối được máy chủ. Bấm Kiểm tra lại để dùng cùng mã yêu cầu, không tạo lần gửi mới nếu máy chủ đã nhận.');
    } finally {
      setPending(false);
    }
  }

  const label = pending
    ? 'Đang xử lý…'
    : locked
      ? 'Không gửi lại'
      : remaining > 0
        ? `Chờ ${remaining} giây`
        : opRef.current && !opRef.current.settled
          ? 'Kiểm tra lại'
          : item.emailStatus === 'pending'
            ? 'Gửi lời mời'
            : 'Gửi lại';

  return (
    <div className="send-action">
      <button
        type="button"
        className="button-secondary edit-btn"
        onClick={send}
        disabled={pending || locked || remaining > 0}
        aria-label={`${label} cho ${item.guestName}`}
      >
        {label}
      </button>
      {item.emailStatus === 'unknown' && <p className="field-help">{EMAIL_UNKNOWN_HELP}</p>}
      {remaining > 0 && <p className="field-help">Cần chờ {remaining} giây trước lần gửi tiếp theo.</p>}
      {feedback && <p className="field-help" role="status">{feedback}</p>}
    </div>
  );
}
