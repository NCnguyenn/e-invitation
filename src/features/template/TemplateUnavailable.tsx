export function TemplateUnavailable({ pending = false }: { pending?: boolean }) {
  return (
    <div className="app-status" role="status">
      <h1>{pending ? 'Đang tải mẫu thiệp' : 'Mẫu thiệp không khả dụng'}</h1>
      <p>
        {pending
          ? 'Vui lòng chờ trong giây lát.'
          : 'Mã mẫu chưa được đăng ký. Hệ thống không hiển thị mẫu khác để tránh sai thiệp.'}
      </p>
    </div>
  );
}
