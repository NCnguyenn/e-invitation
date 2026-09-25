'use client';

export default function InviteError({ reset }: { error: Error; reset: () => void }) {
  return <main className="app-status">
    <h1>Không tải được thư mời</h1>
    <p>Dịch vụ đang gặp sự cố nên chưa xác định được thư mời. Đây không có nghĩa là liên kết không tồn tại.</p>
    <button type="button" onClick={reset}>Thử lại</button>
  </main>;
}
