# Hợp đồng gửi Brevo và đối soát kết quả chưa xác định

Áp dụng cho `POST /api/host/invitations/[id]/send`. Đây không phải trang system-admin và không có webhook, cron hay gửi hàng loạt.

## Hợp đồng đã đối chiếu

Nguồn, đọc trực tiếp từ tài liệu Brevo:

- [Send a transactional email](https://developers.brevo.com/reference/send-transac-email)
- [Markdown cùng endpoint](https://developers.brevo.com/reference/send-transac-email.md)
- [Idempotency for batch emails](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)

Adapter chỉ gọi `POST https://api.brevo.com/v3/smtp/email`, header `api-key`, một người nhận, có `sender`, `subject`, `htmlContent`, `textContent`. Không dùng template, không lên lịch, không `messageVersions`.

- HTTP 201 và `messageId` không rỗng, không xuống dòng, tối đa 255 ký tự: tiếp nhận. Lưu `provider_message_id` và `accepted_at`.
- HTTP 202 là “scheduled successfully”. Adapter không gửi `scheduledAt`, nên 202 là `unknown`, không coi là đã gửi.
- HTTP 400 với `code` thuộc nhóm tham số/xác thực/hạn mức đã liệt kê trong `src/features/email/brevo.ts`: từ chối chắc chắn.
- Timeout, mất kết nối, 401, 500, thiếu `code`, `duplicate_request`, `duplicate_parameter`, “Request already processed”: `unknown`. Không tự gọi lại POST.
- `headers.idempotencyKey` trong tài liệu batch không được dùng. Ví dụ `Idempotency-Key` trong trường JSON `headers` của endpoint đơn là custom email header, chưa được xác minh là khóa chống trùng cho payload này. Ledger của ứng dụng là cơ chế chống trùng.

`sent` chỉ có nghĩa Brevo đã tiếp nhận. Không có nghĩa thư đã vào hộp thư hoặc đã được đọc.

## Cấu hình

Server cần `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SITE_URL`.

- `SITE_URL` là HTTPS công khai, không cổng, không đường dẫn, không localhost. Link trong email là `{SITE_URL}/invite/{token}`.
- Không dùng `APP_BASE_URL` hay Origin của request để tạo link.
- Sender phải là sender Brevo đã xác minh. Thiếu cấu hình thì API trả 503 và chưa giữ suất.
- Trần 300 suất/ngày giờ Việt Nam là giới hạn nội bộ của cả ứng dụng, không phải quota Brevo còn lại.

## Khi kết quả là unknown

Không bấm gửi lại trên UI. Nút bị khóa với câu “Chưa xác định kết quả, cần kiểm tra trước khi gửi lại.” Không xóa ledger hoặc counter để mở khóa.

Đối soát trong Brevo Dashboard, transactional logs:

1. Lấy thời điểm `email_send_attempts.started_at` của attempt đang `unknown` hoặc còn `sending` quá 2 phút.
2. Tìm theo email người nhận và khoảng thời gian đó. Không dán token thư mời hoặc API key vào ghi chú/log.
3. Nếu có `provider_message_id`, tìm đúng message id đó.
4. Có message id hoặc log Brevo cho thấy đã tiếp nhận: ghi nhận là đã tiếp nhận, không gửi thêm.
5. Không thấy request và không có message id: vẫn là chưa xác định cho đến khi có bằng chứng. Không tự gửi lại từ ứng dụng.
6. Thao tác developer cho phép gửi lại dù có thể trùng không nằm trong MVP. Nếu sau này làm, phải xác nhận riêng và lưu `resolved_by`, `resolved_at`, `resolution`, giữ status `unknown` của attempt cũ.

Phục hồi tự động chỉ chạy khi Host tải danh sách hoặc gọi gửi: `reserved`/`sending` của chính Host đó, quá 2 phút theo giờ database, chuyển `unknown` nếu chưa có message id. Không có cron và không sửa dữ liệu Host khác.
