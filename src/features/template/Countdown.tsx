'use client';
import { useEffect, useState } from 'react';
import { countdownParts } from './date';
export function Countdown({ eventDate }: { eventDate: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const parts = now === null ? null : countdownParts(Date.parse(eventDate), now);
  return <div className="countdown-container">
    <div className="countdown-title">CÙNG ĐẾM NGƯỢC THỜI GIAN</div>
    <div className="countdown-boxes" role="timer" aria-label="Thời gian đến sự kiện">
      {['Ngày', 'Giờ', 'Phút', 'Giây'].map((label, i) => <div className="countdown-item" key={label}>
        <div className="countdown-number">{parts ? String(parts[i]).padStart(2, '0') : '—'}</div>
        <div className="countdown-label">{label}</div>
      </div>)}
    </div>
  </div>;
}
