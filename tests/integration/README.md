# Kiểm thử tích hợp

Bước 2 có `authorization.test.ts` và `auth-session.test.ts`. Các test này cần migration `supabase/migrations/202609240001_mvp_core.sql` đã áp lên project Supabase test và đăng ký công khai đã tắt.

## Điều kiện chạy

- `.env.local` có `SUPABASE_TARGET=test` cùng ba biến Supabase của ứng dụng.
- URL phải khớp chính xác project đã chỉ định trong `supabase/test-project.json`. File này chỉ chứa URL công khai, không chứa khóa. Không tự thay đổi pin theo URL bất kỳ khi chạy test.
- Áp migration bổ sung `supabase/migrations/202609250001_mvp_sent_invitation_identity_lock.sql` sau migration lõi.
- Dữ liệu fixture chỉ dùng namespace email `mvp-step2-host-{a,b,none}.<project>@example.com`. Override email ngoài namespace bị từ chối trước khi ghi dữ liệu. Mật khẩu fixture có thể được luân chuyển khi chạy test; không dùng các tài khoản này làm tài khoản khách thật.
- Host `none` phải không có event; test sẽ dừng nếu có, không tự xóa event.

Chạy `npm run test:integration`. Không chạy đồng thời với E2E auth vì cả hai dùng chung fixture. Service role chỉ dùng để chuẩn bị/kiểm tra fixture, không thay JWT Host trong thao tác đang kiểm tra quyền. Test mới xác minh cả Host và server không sửa tên/email/lời mời đã gửi, nhưng vẫn cập nhật được trạng thái gửi lại và bộ đếm nhạc.

E2E auth tắt trace để tránh ghi mật khẩu/cookie/refresh token vào artifact. Kiểm tra refresh chỉnh thời điểm hết hạn trong dữ liệu session đã lưu, giữ token ký thật, rồi truy cập dashboard: phải có refresh token mới, cookie mới và phiên hoạt động sau reload. Đây là kiểm tra đường xử lý refresh thật, không phải chờ JWT ký thật hết hạn theo đồng hồ.

Kết quả nghiệm thu hiện tại được ghi trong `docs/MVP_TEST_HANDOVER.md`.
