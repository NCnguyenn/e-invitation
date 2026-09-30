'use client';

import { useEffect } from 'react';

export default function InviteError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Surface the real error to the console/Sentry so invitation failures are
    // diagnosable in production instead of being silently swallowed.
    console.error('[invite] render error', error);
  }, [error]);

  return <main className="app-status">
    <h1>Không tải được thư mời</h1>
    <p>Dịch vụ đang gặp sự cố nên chưa xác định được thư mời. Đây không có nghĩa là liên kết không tồn tại.</p>
    <button type="button" onClick={reset}>Thử lại</button>
  </main>;
}
