import type { RsvpReceipt } from '@/lib/contracts';

export function ResponseReceipt({ receipt }: { receipt: RsvpReceipt }) {
  const label = receipt.status === 'accepted' ? 'Đã xác nhận tham gia' : 'Đã xác nhận không tham gia';
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(receipt.respondedAt));
  return <div className="rsvp-receipt" data-testid="rsvp-receipt">
    <p className="rsvp-thanks">Cảm ơn bạn đã phản hồi!</p>
    <p>Trạng thái của bạn: {label}.</p>
    {receipt.guestMessage && <p className="rsvp-saved-note">{receipt.guestMessage}</p>}
    <p>Thời gian phản hồi: <time dateTime={receipt.respondedAt}>{time}</time></p>
  </div>;
}
