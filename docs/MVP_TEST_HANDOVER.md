# Trạng thái triển khai MVP

## Bước 8 — Đang nghiệm thu, chưa deploy

Đã bổ sung `netlify.toml`, preflight cấu hình, smoke production chỉ đọc và full-journey desktop/mobile. Kết quả mới: unit **74/74**, integration **59/59**, typecheck/build đạt. E2E toàn bộ **44/45**; ca editor-mobile chờ chạy lại sau sửa test chờ HTTP login. Lệnh chạy lại chưa được thực thi do hệ thống xét duyệt hết hạn mức.

Chưa có site/quyền Netlify, SITE_URL và hộp thư thử được xác nhận. Sender Brevo đã kiểm tra active bằng API; chưa gửi email thật trong lượt này. Production local qua các ca ẩn danh/headers/secret scan; hai ca Guest chưa đạt vì truy cập Supabase trong sandbox báo EACCES. **Không đánh dấu Bước 8/MVP hoàn tất.**

Chi tiết bằng chứng, đối chiếu 16 tiêu chí và hướng dẫn triển khai: [STEP8_DEPLOY_HANDOVER.md](STEP8_DEPLOY_HANDOVER.md). Các mục phía dưới là lịch sử các bước trước, không thay kết quả nghiệm thu này.

Cập nhật ngày 26/09/2026. **Bước 6 đã triển khai toàn diện mã nguồn và chuẩn bị migration trên project test.** Host upload/thay nhạc MP3 trực tiếp lên private storage bucket `audio`, finalize kiểm tra metadata qua server, nghe thử qua session; Guest nghe nhạc qua signed URL theo token với cơ chế giới hạn tần suất nguyên tử (30 request / 60 phút). Không tải nhạc trước thao tác người dùng. Không deploy, không commit.

## Bước 6 — Upload và phát nhạc thật (Host Audio & Guest Playback)

- **Bucket lưu trữ âm thanh (`audio`):**
  - Giữ chế độ riêng tư tuyệt đối (`public = false`), giới hạn dung lượng 10 MiB (10.485.760 bytes), chỉ cho phép MIME `audio/mpeg`.
  - Phân quyền RLS nghiêm ngặt: Host chỉ có quyền SELECT/INSERT/UPDATE trên đường dẫn chuẩn `{user_id}/{event_id}/music.mp3` thuộc sự kiện của chính mình. Chặn Host khác truy cập hoặc ghi đè.
  - Tải lên trực tiếp từ trình duyệt của Host lên Supabase Storage qua JWT người dùng (`cacheControl: '0'`), tuyệt đối không stream dữ liệu nhị phân qua Next.js/Netlify.
- **Server API cho Host:**
  - `POST /api/host/audio/prepare`: Xác thực session Host, kiểm tra MIME và kích thước file, trả về `{ bucket: 'audio', path: '{user_id}/{event_id}/music.mp3' }`.
  - `POST /api/host/audio/finalize`: Xác thực session Host, kiểm tra sự tồn tại và metadata của file trong storage bằng service role, cập nhật nguyên tử `events.music_path`. Trạng thái lỗi finalize hiển thị nút thử lại trên cùng object.
  - `POST /api/host/audio/preview`: Cung cấp signed URL 3600 giây cho Host nghe thử mà không cần tạo mock token hay tiêu tốn quota của khách.
- **Server API & RPC cho Guest:**
  - `POST /api/guest/[token]/audio`: Kiểm tra token, gọi RPC `consume_audio_request_slot(p_token)` nguyên tử. Trả về signed URL 3600 giây (`expiresIn`, `expiresAt`) nếu được phép; trả về 429 kèm header `Retry-After` nếu vượt quá giới hạn 30 request / 60 phút.
  - RPC `consume_audio_request_slot`: Viết bằng PL/pgSQL với `SECURITY DEFINER`, `search_path = ''`, khóa bản ghi `FOR UPDATE`, theo dõi cửa sổ trượt 60 phút và đếm số lượt yêu cầu. Thu hồi quyền từ `PUBLIC, anon, authenticated` và chỉ cấp quyền `EXECUTE` cho `service_role`.
  - Không rò rỉ `music_path` hay thông tin nội bộ trong API projection của khách.
- **Client Playback (`AudioPlayer` & `GuestAudioControl`):**
  - Không tải trước nhạc: `<audio>` sử dụng `preload="none"` và không chứa thuộc tính `src` hoặc signed URL trong HTML ban đầu.
  - Khi người dùng click nút phát, client mới gọi API lấy signed URL theo yêu cầu (on-demand).
  - Bộ đệm an toàn (safety buffer) 60 giây trước khi signed URL hết hạn để chủ động làm mới.
  - Xử lý mượt mà khi trình duyệt chặn tự động phát (`NotAllowedError`), chuyển trạng thái về dừng kèm nút Play để người dùng tương tác lại.
  - Khi gặp mã lỗi 429, hiển thị thông báo giới hạn kèm bộ đếm lùi thời gian thử lại (`Retry-After`).
  - Lỗi âm thanh hoặc sự kiện không có nhạc tuyệt đối không làm ảnh hưởng hoặc chặn luồng gửi RSVP của khách.
- **Giao diện Host (`MusicUploader` & `EventEditor`):**
  - Tích hợp trực tiếp vào cột chỉnh sửa sự kiện, hiển thị trực quan trạng thái âm thanh: "Chưa có nhạc nền" / "Đã có nhạc nền".
  - Hỗ trợ chọn tệp MP3, tải lên, hiển thị tiến trình: Chuẩn bị $\to$ Đang tải lên $\to$ Đang hoàn tất $\to$ Đã lưu.
  - Nút "Nghe thử" phát nhạc trực tiếp trong dashboard.
  - Nút "Thay nhạc" cho phép ghi đè tệp MP3 mới mà không làm mất các thông tin form sự kiện chưa lưu.

### Trạng thái Migration Bước 6
Migration `supabase/migrations/202609260002_mvp_consume_audio_request_slot.sql` đã được người dùng thực thi thành công trên **Supabase SQL Editor** (`Success. No rows returned`). Toàn bộ cơ chế atomic rate limit slot, reset window 60 phút và cấp signed URL cho khách mời đã kích hoạt hoàn chỉnh trên database test.

### Kết quả kiểm tra Bước 6

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, không lỗi kiểu dữ liệu (`tsc --noEmit`). |
| `npm run test:unit` | **56/56**. Gồm 41 test cũ + 15 test mới trong `audio.test.ts` & `validation.test.ts` (kiểm tra MIME MP3, chuẩn hóa MIME metadata tham số/in hoa, từ chối đuôi .mp3 giả MIME, giới hạn 10 MiB, canonical audio path, metadata validation, on-demand url resolution, 429 retry-after calculation [1, 3600]s, autoplay gesture recovery). |
| `npm run test:integration` | **45/45** (100% PASS trên Supabase test thật). Bao gồm 11/11 test trong `storage.test.ts`: Host upload trực tiếp bằng JWT, thay nhạc tại cùng canonical path xác minh nội dung đổi thật, từ chối metadata/object sai, RLS chặn Host khác, chứng minh bucket private, preview không cần token khách, Guest nhận signed URL hợp lệ, atomic rate limiting tại slot 29/30 chặn request đồng thời, reset window 60 phút và bảo toàn RSVP đã chốt. |
| `npm run test:e2e` | **39/39** (100% PASS trong một lượt trên cả Chromium Desktop 1440px và Mobile 360px). Gồm 33 test cũ + 6 test mới trong `audio.spec.ts` xác minh: mạng cách ly hoàn toàn không tải nhạc hay signed URL trước tương tác người dùng, Host upload MP3 trực tiếp tới Storage $\to$ finalize $\to$ nghe thử $\to$ reload giữ trạng thái $\to$ Guest mở thiệp phát nhạc thật $\to$ Guest RSVP bình thường khi sự kiện không có nhạc. |
| `npm run build` | Đạt, Next.js 16 build thành công với Turbopack; các route `/api/host/audio/*` và `/api/guest/[token]/audio` đều dynamic và tối ưu. |

### Thao tác kiểm tra thủ công Bước 6

1. Đăng nhập `/login` bằng tài khoản Host test.
2. Tại màn hình **Thiệp & thông tin**, cuộn tới thẻ **Nhạc nền sự kiện**.
3. Chọn một tệp MP3 hợp lệ (kích thước $\le$ 10 MiB), bấm **Tải lên**: quan sát tiến trình "Đang tải lên...", kiểm tra trên DevTools Network thấy request POST trực tiếp lên Supabase Storage (`/storage/v1/object/audio/...`), không qua Next.js server.
4. Sau khi hoàn tất, thông báo "Đã lưu nhạc thành công" hiển thị; bấm **Nghe thử** để phát nhạc kiểm tra âm thanh.
5. Thử chọn một tệp MP3 khác và bấm **Tải lên** để thay nhạc; kiểm tra nhạc mới được cập nhật và phát lại chính xác.
6. Mở tab **Khách mời**, sao chép liên kết thiệp của một khách mời.
7. Mở cửa sổ ẩn danh mới truy cập liên kết; mở DevTools Network tab: xác nhận ban đầu không có request tải tệp `.mp3` hay gọi API lấy signed URL. Thẻ `<audio>` có `preload="none"`.
8. Bấm nút biểu tượng đĩa nhạc / Play: quan sát request gọi `/api/guest/[token]/audio` để lấy signed URL và bắt đầu phát nhạc.
9. Thử gửi RSVP khi đang phát nhạc hoặc khi sự kiện không có nhạc: xác nhận luồng phản hồi RSVP hoạt động hoàn toàn độc lập và không bao giờ bị nghẽn bởi âm thanh.

## Bước 5 — Danh sách khách mời & theo dõi phản hồi của Host

- Dashboard mở mục **Phản hồi** (`/dashboard?section=responses`) và liên kết đầy đủ trong sidebar Host.
- **Server API `GET /api/host/invitations`:**
  - Hỗ trợ phân trang máy chủ chuẩn 50 khách/trang (`page=1, 2...`), sắp xếp ổn định `created_at DESC, id ASC` tránh trùng/lọt bản ghi.
  - Lọc trạng thái `status`: `all`, `pending`, `accepted`, `declined`.
  - Tìm kiếm `query` theo tên khách (`guest_name`) hoặc email (`guest_email`). Thoát ký tự đặc biệt PostgREST (`escapePostgrestIlike`) chống lỗi ngữ pháp `PGRST100` và injection.
  - Trả về cấu trúc chuẩn: `{ items, page, pageSize, totalPages, filteredTotal, totals }` với `totals` là tổng toàn sự kiện (`total = pending + accepted + declined`).
  - Phân quyền Host chặt chẽ qua RLS và session, Host A không thể xem khách của Host B.
- **Server API `PATCH /api/host/invitations/[id]`:**
  - Cho phép Host sửa `guest_name`, `guest_email`, `invitation_note` khi và chỉ khi `has_send_history = false` và `email_status NOT IN ('sending', 'unknown')`.
  - Từ chối mọi trường hệ thống hoặc bảo mật (`token`, `status`, `responded_at`, `guest_message`, `event_id`, v.v.).
  - Bắt lỗi trùng email trong cùng sự kiện trả 409 `duplicate_email`, đã có lịch sử gửi trả 409 `invitation_locked`, không tìm thấy / ID sai trả 404 `not_found`.
  - Giữ nguyên `token` và trạng thái RSVP ban đầu sau khi sửa.
- **Cơ chế Live Polling (`ResponsesPoller` & `useResponses`):**
  - Polling tự động chu kỳ 10 giây không dùng WebSocket, chỉ kích hoạt khi tab đang mở và hiển thị (`document.visibilityState === 'visible'`).
  - Dừng polling khi chuyển tab/thu nhỏ cửa sổ, phục hồi ngay lập tức khi người dùng quay lại tab.
  - Ngăn request gối đầu bằng cờ `inFlight` và `AbortController`.
  - Khi mất mạng hoặc server lỗi tạm thời, giữ nguyên dữ liệu đã nạp gần nhất (snapshot) và hiển thị cảnh báo offline/stale, không làm trắng màn hình; tự động phục hồi khi mạng kết nối lại.
  - Dừng hoàn toàn và chuyển hướng về `/login` nếu nhận mã 401 Unauthorized.
- **Giao diện Host (`ResponseTable` & `GuestTable`):**
  - 4 thẻ thống kê: Tổng khách mời, Chưa phản hồi, Đồng ý, Không tham gia.
  - Bảng phản hồi hiển thị: Tên khách, Lời mời riêng, Trạng thái (badge trực quan), Thời gian phản hồi (giờ Việt Nam), Lời nhắn của khách.
  - Bảng danh sách khách mời trong tab Khách mời hiển thị: Tên, Email, Trạng thái gửi thư (đọc từ database: `sent` $\to$ Đã gửi, `sending` $\to$ Đang gửi, còn lại $\to$ Chưa gửi), nút Sửa thông tin (mở modal chỉnh sửa) và nút sao chép liên kết cá nhân.
  - Hỗ trợ đầy đủ màn hình di động 360 px: bảng cuộn ngang nội bộ (`overflow-x: auto`), không làm tràn thanh cuộn toàn trang (`document.documentElement.scrollWidth <= window.innerWidth`).

### Kết quả kiểm tra cuối Bước 5

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, không lỗi kiểu dữ liệu (`tsc --noEmit`). |
| `npm run test:unit` | **41/41**. Gồm 25 test cũ + 16 test mới cho polling lifecycle, visibility change, stale snapshot, in-flight guard, search escaping, query & update validation, page clamping sync & duplicate fetch prevention. |
| `npm run test:integration` | **34/34** trên Supabase test. Gồm 24 test cũ + 10 test mới trong `host-invitations.test.ts` (phân quyền Host A/B, fixture 50+ khách phân trang, totals toàn sự kiện, tìm kiếm ký tự đặc biệt, PATCH trước/sau send history, từ chối email trùng, system fields). |
| `npm run test:e2e` | **33/33** trong một lượt duy nhất. Gồm 25 test cũ + 8 test mới trong `host-responses.spec.ts` trên cả Chromium Desktop (1440 px) và Mobile (360 px): Host tạo khách $\to$ Guest gửi RSVP $\to$ Host tự động thấy phản hồi qua polling không cần F5 $\to$ Khách tải lại vẫn khóa form $\to$ Host tìm kiếm, lọc, sửa thông tin khách $\to$ chịu lỗi mạng mất kết nối giữ snapshot $\to$ không tràn ngang 360 px. |
| `npm run build` | Đạt, Next.js 16 build thành công với Turbopack; các route `/api/host/invitations`, `/api/host/invitations/[id]`, `/dashboard` đều tối ưu. |

Ảnh minh họa E2E: `test-results/host-responses-desktop.png`, `test-results/host-responses-mobile.png`, `test-results/host-guests-table-desktop.png`, `test-results/host-guests-table-mobile.png`. Không đưa vào Git.

### Thao tác kiểm tra thủ công Bước 5

1. Đăng nhập `/login` bằng tài khoản Host test.
2. Vào tab **Khách mời** (`/dashboard?section=guests`): kiểm tra danh sách khách đã có, trạng thái gửi email hiển thị đúng ("Chưa gửi" / "Đã gửi").
3. Thử tạo một khách mới; bấm nút **Sửa** tại dòng khách vừa tạo, thay đổi tên/lời mời riêng trong modal rồi bấm **Lưu thay đổi** $\to$ bảng cập nhật thông tin mới.
4. Mở tab **Phản hồi** (`/dashboard?section=responses`): quan sát 4 thẻ số liệu tổng quan và bảng danh sách phản hồi.
5. Sao chép liên kết cá nhân của một khách chưa phản hồi, mở trong tab ẩn danh khác và gửi RSVP "Tôi sẽ tham gia" kèm lời nhắn.
6. Giữ nguyên màn hình Host tại tab Phản hồi (không bấm F5 hay tải lại trang): trong vòng ~10-15 giây, dòng khách mời tự động chuyển sang trạng thái "Đồng ý" và hiển thị lời nhắn của khách.
7. Thử nhập từ khóa vào ô tìm kiếm hoặc bấm các nút lọc trạng thái ("Chưa phản hồi", "Đồng ý", "Từ chối") $\to$ bảng lọc chính xác và số liệu tổng quan toàn sự kiện vẫn giữ nguyên.
8. Thu nhỏ cửa sổ trình duyệt xuống kích thước 360 px (hoặc bật Device Mode trên DevTools) $\to$ kiểm tra bảng có thanh cuộn ngang nội bộ, trang không bị vỡ bố cục hay tràn mép ngoài.



- Dashboard có mục **Khách mời**. Form tạo tên, email, lời mời riêng qua `POST /api/host/invitations`. Session và event của Host được kiểm tra trước khi ghi bằng service role. Không nhận `eventId`/`userId`/`token`/`status` từ client. Email trùng trả 409 cùng ID và token cũ, kể cả hai request đồng thời.
- Sau khi tạo, UI hiện liên kết `/invite/{token}` để mở hoặc sao chép. Thông báo ghi rõ email chưa được gửi.
- `/invite/[token]` đọc invitation thật, dùng `InvitationTemplate` ở `mode="guest"`. Token sai hoặc không tồn tại cùng trả 404. Event/Host không active cũng trả 404 và không ghi RSVP. Lỗi dịch vụ trả 503, không giả thành không tồn tại.
- Projection không trả email, `music_path`, `userId`. Metadata chỉ có tiêu đề và địa điểm công khai. API khách có `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
- Form RSVP không chọn sẵn, tên chỉ đọc, không có số người đi cùng. Nút khóa khi đang gửi. Cảm ơn chỉ hiện sau receipt. Mất phản hồi thì GET lại; lỗi trước khi lưu thì giữ nội dung và không tự gửi lại POST.
- RPC `submit_rsvp_once` đã áp thành công lên database test: `SECURITY DEFINER`, `search_path` rỗng, `EXECUTE` chỉ cho `service_role`. Cưỡng chế ghi nguyên tử có điều kiện, khóa `FOR UPDATE`, đảm bảo hai request gửi đồng thời chỉ một request ghi thành công và request thua cuộc nhận `already_responded`.

### Kết quả kiểm tra cuối Bước 4

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, không lỗi kiểu dữ liệu. |
| `npm run test:unit` | **25/25**. Validation khách/RSVP, projection an toàn, ngày giờ, Origin. |
| `npm run test:integration` | **24/24** trên Supabase test: email trùng đồng thời, phân quyền Host A/B, hai kết nối gửi RSVP đồng thời chỉ một saved và một already_responded, RPC chặn anon/authenticated, khóa danh tính lời mời đã gửi. |
| `npm run test:e2e` | **25/25** trong một lượt: 6 ca guest RSVP trên mobile 360 px và desktop 1440 px, 2 ca preview, 6 ca editor, 11 ca auth. |
| `npm run build` | Đạt, Next.js build thành công; các route `/invite/[token]`, `/api/guest/[token]`, `/api/guest/[token]/rsvp`, `/api/host/invitations` đều dynamic. |

Ảnh form Host và thiệp Guest sau khi gửi RSVP: `test-results/host-guests-desktop.png`, `test-results/host-guests-mobile.png`, `test-results/guest-desktop.png`, `test-results/guest-mobile.png`. Không đưa vào Git.

### Thao tác kiểm tra thủ công Bước 4

1. Mở `/login`, đăng nhập bằng tài khoản Host test.
2. Vào tab **Khách mời**, nhập tên, email, lời mời riêng $\to$ bấm **Tạo thư mời**.
3. Sao chép liên kết cá nhân `/invite/[token]` hiển thị bên dưới.
4. Mở cửa sổ ẩn danh mới hoặc trình duyệt khác, truy cập link vừa sao chép.
5. Kiểm tra thiệp hiện đúng tên khách và lời mời riêng; form RSVP chưa chọn sẵn.
6. Chọn "Tôi sẽ tham gia" (hoặc "Tôi không thể tham gia"), nhập ghi chú và bấm **Gửi xác nhận**.
7. Kiểm tra thông báo cảm ơn và trạng thái hiển thị đúng; nút gửi biến mất.
8. Tải lại trang (F5) hoặc mở lại ở thiết bị khác: trạng thái và ghi chú đã gửi vẫn hiển thị, không thể gửi lại hay chỉnh sửa.

## Bước 3 — Thông tin sự kiện và xem trước

- Dashboard theo mockup đã duyệt: sidebar xanh đậm, form nền kem và khung xem trước thiệp; bố cục thích ứng desktop/mobile.
- Host sửa tiêu đề, ngày/giờ Việt Nam, địa điểm, địa chỉ, liên kết Google Maps. Lưu thật vào Supabase; dữ liệu còn đúng sau tải lại và đăng nhập ở phiên khác.
- GET/PATCH `/api/host/event` dùng userId từ session đã xác minh, client Supabase theo phiên và RLS. Payload chỉ nhận các trường được phép; không nhận ID/chủ sở hữu do client chỉ định. Mutation kiểm tra Origin; API trả `private, no-store`.
- Validation cả client và server: độ dài, ngày tồn tại, múi giờ, HTTPS và domain/path Maps cho phép. Form khóa khi lưu và giữ nội dung khi lỗi.
- Xem trước dùng cùng InvitationTemplate với dữ liệu event/bản nháp và tên khách mẫu; lịch/đếm ngược theo ngày mới. Không tạo invitation, không gửi hoặc lưu RSVP.
- Đã sửa tràn ngang của template. Kiểm tra ảnh chụp thực tế ở 1440 px và 360 px; tiêu đề dài được ngắt dòng.
- Ở cuối Bước 3, mục Khách mời/Phản hồi còn khóa. Bước 4 đã mở mục Khách mời; Phản hồi vẫn khóa.

### Kết quả kiểm tra cuối Bước 3

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, không lỗi. |
| `npm run test:unit` | **19/19**: ngày giờ, Origin, guard fixture và validation event. |
| `npm run test:integration` | **16/16** trên Supabase test, gồm RLS, khóa RSVP, khóa danh tính lời mời đã gửi và signup OFF. |
| `npm run test:e2e` | **19/19** trong một lượt: 2 preview, 6 editor desktop/mobile, 11 auth. |
| `npm run build` | Đạt, route dashboard/API event dynamic. |

Test lưu/đọc và phân quyền dùng database thật. Chỉ ca kiểm tra UI khi mất mạng chủ động chặn request. Cảnh báo cookie/refresh không hợp lệ trong E2E đến từ ca chủ động làm hỏng phiên. File kiểu tự sinh trong `.next/dev/types` có lần bị hỏng; đã xóa riêng thư mục đó, chạy `next typegen`, typecheck và build lại thành công, không thay đổi mã nguồn để bỏ qua kiểm tra kiểu.

Review độc lập không phát hiện lỗi quan trọng; góp ý ngắt dòng tiêu đề dài đã sửa. Ảnh ở `test-results/event-editor-editor.png` và `test-results/event-editor-editor-mobile.png`; kết quả test không đưa vào Git. Chromium giả lập mobile, chưa kiểm tra iPhone/Safari thật hoặc URL đã deploy.

### Thao tác kiểm tra thủ công

1. Chạy `npm run dev`; mở `/login` bằng tài khoản Host được cấp, có profile active và một event.
2. Sửa thông tin tại **Thiệp & thông tin**. Ngày/giờ nhập theo Việt Nam; database lưu TIMESTAMPTZ.
3. Bấm **Xem trước** để xem bản nháp. Bấm **Lưu thay đổi** để cập nhật database.
4. Tải lại hoặc đăng nhập phiên khác để kiểm tra dữ liệu đã lưu. Host chưa có event sẽ thấy thông báo liên hệ người thiết kế.

## Bản sửa sau rà soát Bước 2

- Test ghi dữ liệu bắt buộc có `SUPABASE_TARGET=test` và URL khớp project được ghim trong `supabase/test-project.json`.
- Fixture chỉ dùng namespace email dành riêng, từ chối override sang tài khoản khác; không tự xóa sự kiện của Host không có event.
- Đã chuẩn bị migration `202609250001_mvp_sent_invitation_identity_lock.sql`: khóa tên/email/lời mời sau lần gửi đầu tiên, vẫn cho cập nhật trường hệ thống. Không sửa migration lõi.
- Test mới đã tái hiện lỗi trên database trước bản sửa: Host vẫn sửa được tên invitation đã gửi. Người dùng đã áp migration bổ sung; lượt integration cuối 16/16 xác nhận khóa đã có hiệu lực.
- E2E dùng cookie thật của project, kiểm tra cookie hỏng, refresh qua proxy và refresh thất bại; không ghi trace Auth chứa credential.
- Sửa lỗi form đăng nhập gửi GET trước khi hydration: dùng POST và khóa input/nút cho tới khi JavaScript sẵn sàng. Có test riêng khi JavaScript tắt; đã quan sát test thất bại trước sửa.
- Các lượt kiểm tra trước từng gặp lỗi mạng/sandbox, preview desktop và migration chưa áp. Đã chạy lại toàn bộ sau khắc phục; dùng bảng kết quả cuối Bước 3 phía trên để nghiệm thu.

**Bằng chứng từ người dùng:** SQL Editor báo thành công khi chạy migration bổ sung; log integration lúc 10:56:29 ngày 25/09/2026 đạt 16/16. Lượt chạy lại của agent ở cuối Bước 3 cũng đạt 16/16. Lỗi preview desktop cũ đã được xử lý và E2E toàn bộ đạt 19/19.

## Đã có từ Bước 1

- Nhánh `codex/mvp-e-invitation`, Next.js 16.3.6, React 19.3.0, TypeScript 7.0.2; dependency khóa phiên bản và package-lock.
- Template chuyển từ thiết kế gốc, dữ liệu nhận qua `GuestInvitation`; Gallery, Countdown, AudioPlayer tách riêng.
- Preview chỉ development, có nhãn dữ liệu mẫu, không có cơ chế ghi RSVP. Bản production không dùng fixture dự phòng.
- Ảnh/font nội bộ; giấy phép font có trong `public/fonts/`. Các file HTML/CSS/JS gốc không thay đổi.
- Bỏ CDN, iframe Maps, customizer, sổ lời chúc, số người đi cùng và phần quà tặng khỏi template MVP. Không chặn phóng to trang.

## Bước 2 đã áp trên project test

- `@supabase/supabase-js` 2.117.1, `@supabase/ssr` 0.12.7, `server-only` 0.0.1.
- Migration `supabase/migrations/202609240001_mvp_core.sql` đã chạy trên SQL Editor của project test (`Success. No rows returned`). Có bảng `profiles`, `events`, `invitations`, RLS, bucket `audio` private.
- Đăng ký công khai đã tắt: `GET /auth/v1/settings` trả `disable_signup: true`. Công tắc **Allow new users to sign up** ở `Authentication → Sign In / Providers` đang OFF.
- Client Supabase tách browser/server/admin. Admin có `server-only`. Proxy Next.js 16 gọi `getClaims()`. `requireHost()` xác minh bằng `getUser()` và profile host đang active.
- `/login`, `/dashboard`, `POST /api/auth/login`, `POST /api/auth/logout`. Mutation cookie kiểm tra Origin (kể cả khi `request.url` lệch so với header `Host`/`x-forwarded-host`). Dashboard đã bổ sung editor ở Bước 3.
- Fixture tạo Host A/B và Host chưa có sự kiện qua Admin API; mật khẩu không ghi vào SQL hay Markdown.

## Kết quả kiểm tra trước lượt sửa bổ sung (lịch sử)

| Kiểm tra | Kết quả |
| --- | --- |
| `tsc --noEmit` | Thoát 0. |
| `npm run test:unit` | 8 test đạt: 3 ngày giờ, 5 Origin. |
| `npm run test:integration` | 15/15 đạt. RLS Host A/B, anon, cột bảo vệ, khóa RSVP, constraint Maps, storage audio. `disable_signup=true`. Session Host refresh được, JWT giả bị từ chối. |
| Playwright `tests/e2e/auth.spec.ts` `--project=auth` | 8/8 đạt: Origin lạ 403, GET logout 405, dashboard ẩn danh về `/login`, cookie phiên giả về `/login`, sai mật khẩu báo chung, Host A đăng nhập thấy Event A không thấy Event B, đăng xuất chặn dashboard, Host không có sự kiện thấy thông báo trống. |
| Playwright `tests/e2e/preview.spec.ts` | 2/2 đạt (mobile 360×800, desktop 1440×1000). |
| `npm run build` | Đạt trên Next.js 16.3.6. `/`, `/login`, `/dashboard` và API auth là dynamic. `/preview` static. |

Ảnh chụp preview ở `test-results/preview-mobile.png` và `test-results/preview-desktop.png`; thư mục kết quả không đưa vào Git. Kiểm thử E2E dùng Chromium giả lập, chưa phải thiết bị iPhone/Safari thật.

## Bước 7 — Gửi email và chống gửi trùng

Cập nhật 25/09/2026. Migration `supabase/migrations/202609270001_mvp_email_ledger.sql` đã chạy trên project test ghim `https://fbhfcsvvpacwfxpyntyx.supabase.co`. Đã kiểm RPC `email_budget_date`, `reserve_email_send`, `claim_email_send`, `finalize_email_send`, `expire_stale_email_sends` và bảng ledger có trong schema cache. Không reset database, không sửa migration cũ.

Host bấm **Gửi lời mời** tạo khách rồi gọi `POST /api/host/invitations/[id]/send` với `requestId`. Brevo chỉ được gọi từ server sau khi giữ suất và CAS `reserved` → `sending`. Không dùng khóa idempotency của Brevo để tự retry. `sent` nghĩa là Brevo đã tiếp nhận, không phải đã vào hộp thư. Unknown khóa gửi lại. Runbook đối soát: `docs/BREVO_SEND_CONTRACT.md`.

### Kết quả kiểm tra Bước 7

| Lệnh | Kết quả |
| --- | --- |
| `npm run test:unit` | **69/69**. Thoát 0. Gồm 13 test email: escape HTML, ngày giờ Việt Nam, SITE_URL, phân loại response, không gửi idempotency key, không retry POST. |
| `npm run test:integration` | **59/59**. Thoát 0. Gồm 14 test ledger trên Supabase test với transport giả: đồng thời cùng requestId một attempt/một suất/một transport call; hai requestId chỉ một attempt mở; replay không gửi thêm; requestId dùng cho invitation khác bị chặn; counter cô lập 1999-05-20 ở 299 chỉ giữ một suất; rejected không hoàn suất; Host A/B và anon bị chặn; stale 2 phút thành unknown; lỗi ghi DB sau tiếp nhận không gửi lại; snapshot không đổi; gửi lại giữ token/RSVP; xóa fixture không giảm counter. |
| `npm run test:e2e` | **43/43**. Thoát 0. Desktop 1440 và mobile 360. Email E2E dùng `EMAIL_TRANSPORT=stub`, không gọi Brevo. Gồm tiếp nhận, replay 200/200, cooldown 429/429, timeout/rejected/unknown, gửi lại cùng link, RSVP đã chốt chỉ xem receipt. |
| `npm run typecheck` | Thoát 0. |
| `npm run build` | Thoát 0. Next.js 16.3.6. Route `/api/host/invitations/[id]/send` là dynamic. |

Bằng chứng gửi thật: không có. Không có `messageId` từ Brevo. Mọi kết quả trên là mock/stub hoặc database test.

### Điều kiện còn thiếu

- `.env.local` có tên `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` nhưng chưa có `SITE_URL`. Còn `APP_BASE_URL`, không dùng để tạo link.
- Chưa xác minh sender trên dashboard Brevo và chưa có hộp thư thử được phép. Không gửi tới email fixture hoặc khách thật.
- Chưa deploy. Localhost không được dùng để báo hành trình email từ xa đã đạt. Phần mở link từ email thật chờ Bước 8 khi có URL HTTPS công khai.
- Không có system-admin, webhook, cron, gửi hàng loạt hoặc Realtime.

### Kiểm tra thủ công sau khi đủ điều kiện

1. Đặt `SITE_URL` HTTPS công khai trong môi trường server, không dán API key vào chat.
2. Xác nhận một hộp thư thử. Gửi đúng một thư tới hộp đó.
3. Đối soát Brevo theo thời gian, người nhận và `messageId` nếu có. Chỉ ghi đã tiếp nhận khi có bằng chứng đó.
4. Mở link trong thư trên điện thoại, gửi RSVP, kiểm Host thấy phản hồi. Việc này cần URL deploy, thuộc Bước 8 nếu chưa có URL.

Host thật cho khách dùng chưa cấp ngoài fixture test. Fixture `mvp-step2-host-*` chỉ dùng kiểm thử. Chưa gọi hoặc suy đoán quota Brevo. Không ghi secret vào tài liệu.
