# Bước 8 — Triển khai và bàn giao bản test

Trạng thái: đang nghiệm thu local; chưa có URL Netlify đã xác nhận, chưa deploy hoặc gửi email thật trong lượt này. Các mục dưới đây là hướng dẫn/điều kiện, không phải bằng chứng đã thực hiện.

## Kết quả thực chạy trong Bước 8

| Kiểm tra | Kết quả |
| --- | --- |
| Unit | 74/74 đạt sau sửa guard email/Origin production |
| Integration Supabase test | 59/59 đạt; email dùng transport giả lập, không gửi ra ngoài |
| E2E toàn bộ | 44/45 đạt. Full journey mới đạt cả desktop/mobile. Một ca editor-mobile timeout URL sau 5 giây khi nút vẫn “Đang đăng nhập…”; đã sửa test chờ/kiểm tra HTTP login, chưa chạy lại được |
| TypeScript | `node ./node_modules/typescript/bin/tsc --noEmit`: thoát 0 sau sửa test |
| Build production | `node ./node_modules/next/dist/bin/next build`: thoát 0, các API/thiệp động được build |
| Production local chỉ đọc | Asset public không chứa hai khóa riêng đã cấu hình; login, redirect dashboard, API Host 401, GET logout 405, preview 404 và privacy headers đạt. Hai ca Guest token không tồn tại chưa đạt: runtime không truy cập được Supabase; probe riêng báo EACCES. Không coi đây là smoke pass |
| Deploy preflight | Chặn đúng vì thiếu SITE_URL. Không tự lấy APP_BASE_URL localhost làm URL bàn giao |
| Brevo sender | Kiểm tra chỉ đọc HTTP 200, sender cấu hình tồn tại và active; chưa gửi thử |

Lệnh chạy lại E2E bị automatic approval review từ chối thực thi vì hết hạn mức xét duyệt; không phải kết luận thao tác không an toàn. Không bypass hoặc đánh dấu PASS. Netlify CLI thử khởi động báo EXDEV khi đổi tên file cấu hình trong AppData, chưa tạo được phiên đăng nhập/site link. Bản production local thử nghiệm đã được dừng sau kiểm tra.

Các sửa bổ sung để bàn giao: chặn transport stub trên production/hosting hoặc project chưa ghim; từ chối mode có khoảng trắng để tránh chuyển nhầm sang gửi thật; Origin production chỉ nhận SITE_URL đã cấu hình; privacy headers cho toàn bộ API Host; tắt Playwright trace có thể chứa credential; integration email chỉ dọn attempt/counter của chính lượt test.

## Đối chiếu 16 mục nghiệm thu MVP

“Đạt local” dưới đây không đồng nghĩa đã xác minh trên Netlify. Checklist yêu cầu gốc chưa đánh dấu hoàn thành toàn MVP.

| # | Yêu cầu | Bằng chứng/trạng thái |
| --- | --- | --- |
| 1 | Login/logout, chặn người ngoài | E2E auth đạt; production ẩn danh đạt |
| 2 | Phân quyền Host A/B | Integration và full journey desktop/mobile đạt |
| 3 | Thời gian/địa chỉ lưu bền | Full journey và editor desktop đạt; editor-mobile chờ chạy lại sau sửa chờ login |
| 4 | Upload/thay nhạc, phát Guest, không nhạc | Integration Storage và E2E audio đạt; chưa nghe trên điện thoại thật |
| 5 | Preview không ghi RSVP | E2E preview/guest đạt |
| 6 | Email thật tới hộp thư + link HTTPS | Chờ site, hộp thư được phép, gửi thật và xác nhận nhận thư |
| 7 | Email trùng/gửi lại/error/unknown | Integration/email E2E đạt bằng mock transport; chưa gửi thật |
| 8 | Guest chọn và ghi chú | E2E guest/full journey đạt |
| 9 | Cảm ơn sau lưu thật | E2E guest và receipt database đạt |
| 10 | Host nhận phản hồi qua polling | E2E responses/full journey đạt |
| 11 | Mở link ở phiên khác vẫn khóa | E2E guest/full journey đạt |
| 12 | Hai phản hồi đồng thời chỉ một thắng | Integration RSVP hai kết nối đạt; chưa nghiệm thu hai tab trên site đã deploy |
| 13 | Timeout đọc lại, không giả thành công | E2E guest ca mất response sau lưu đạt |
| 14 | Riêng tư, secret, dữ liệu khách khác | Integration/projection, asset scan local và headers đạt; Guest production phụ thuộc Supabase bị EACCES; chưa kiểm tra Netlify |
| 15 | 360 px/desktop, build/typecheck, luồng chính | Full journey cả hai kích thước đạt, đã xem ảnh; còn một ca E2E cần chạy lại |
| 16 | URL/login/tài khoản/link Guest/hướng dẫn | Hướng dẫn đã viết; URL, Host bàn giao và link thật còn chờ |

## Cấu hình triển khai

Dự án cần Next.js runtime cho Auth/API/SSR. Không kéo thả `index.html`, không static export và không thêm redirect SPA `/* → /index.html`.

`netlify.toml` cấu hình build `npm run check:deploy && npm run build`, publish `.next`, Node 24. Netlify tự áp adapter Next.js theo [tài liệu nền tảng](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/). Cần kiểm tra log build của site thật trước khi khẳng định tương thích runtime thành công.

Chọn một site test với URL ổn định `https://<tên-site>.netlify.app` hoặc domain đã xác minh. Không dùng URL deploy ngẫu nhiên trong email. `SITE_URL` phải khớp URL ổn định này; hiện `.env.local` còn `APP_BASE_URL` và thiếu `SITE_URL`, không tự suy ra URL từ biến cũ.

Đặt biến tại Netlify Project configuration → Environment variables, context Production của **site test**. Biến bí mật phải khả dụng ở Functions; các biến kiểm tra build và public Supabase cũng cần ở Builds. Không ghi secret vào `netlify.toml`. Theo [hướng dẫn environment của Netlify](https://docs.netlify.com/build/frameworks/use-environment-variables-with-frameworks/), custom biến đặt trong TOML không tự trở thành biến runtime Functions.

| Biến | Giá trị/nguồn |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Project Supabase test đã chọn |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Anon key của đúng project |
| SUPABASE_SERVICE_ROLE_KEY | Khóa riêng server của đúng project |
| BREVO_API_KEY | Khóa riêng server đã cấu hình |
| BREVO_SENDER_EMAIL / BREVO_SENDER_NAME | Sender đã xác minh |
| SITE_URL | Origin HTTPS ổn định, không path/query |
| EMAIL_TRANSPORT | `brevo` hoặc bỏ trống; không dùng `stub` trên site |

`SUPABASE_TARGET=test` dùng cho công cụ test local; không cần để chạy ứng dụng bàn giao. Không đưa `EMAIL_TRANSPORT=stub`, mật khẩu fixture, file `.env.local`, trace hoặc test-results lên hosting. Hai cờ test không phải bằng chứng có quyền gửi email ra ngoài.

Các migration phải đã áp theo thứ tự tên file. Supabase Auth: signup OFF, Site URL trỏ URL đã chọn, chỉ thêm redirect URL cần dùng, không wildcard rộng. Ứng dụng hiện đăng nhập email/mật khẩu; không xây signup/reset tự phục vụ.

## Kiểm tra trước và sau deploy

Local, chạy unit/integration/E2E tuần tự; E2E dùng database/Storage test thật và email transport giả lập. Kiểm tra `npm run typecheck`, `npm run build`; sau build chạy:

```powershell
npm start -- --hostname 127.0.0.1 --port 3200
# Terminal khác
npm run test:production
```

`test:production` chỉ đọc: kiểm tra public build assets không có khóa riêng đã cấu hình, login/redirect/API ẩn danh, token không tồn tại, privacy headers, preview production 404 và GET logout 405. Nó không gửi thư hoặc chứng minh toàn bộ luồng trên Netlify.

Sau deploy, đặt `SMOKE_BASE_URL` bằng URL thật rồi chạy lại `npm run test:production`. Không chạy toàn bộ fixture E2E trên site bàn giao: các test đó chủ động thay dữ liệu và mật khẩu tài khoản fixture.

Smoke có xác thực trên site thật:

1. Host được cấp đăng nhập, sửa địa chỉ/ngày giờ; reload kiểm tra tồn tại.
2. Upload MP3 rồi thay MP3 lần hai; nghe thử. Guest chỉ tải nhạc sau thao tác Play.
3. Tạo lời mời tới **hộp thư thử đã được người dùng cho phép**; sender và SITE_URL đúng.
4. Kiểm tra Brevo đã tiếp nhận, người nhận xác nhận thư tới inbox/spam; nút mở đúng HTTPS và token. Không coi 201 là đã vào inbox.
5. Guest gửi lựa chọn và ghi chú; chỉ sau receipt mới hiện cảm ơn. Host thấy đúng phản hồi qua polling.
6. Mở link bằng phiên khác: chỉ thấy receipt đầu tiên. Gửi lại email không thay token/RSVP.
7. Host B không đọc/sửa event/invitation Host A. Logout chặn dashboard.
8. Kiểm tra điện thoại thật (bao gồm thao tác phát nhạc); Chromium 360 px không thay bằng chứng Safari/iPhone thật.

## Cấp tài khoản khách test

Không bàn giao tài khoản `mvp-step2-host-*` vì test tự đổi mật khẩu và chỉnh event của chúng. Cần người dùng xác nhận email Host/tên sự kiện trước khi cấp tài khoản riêng.

Người quản lý tạo Auth user đã xác nhận qua Supabase Dashboard/Admin API, kiểm tra profile `role=host`, `lifecycle_status=active`; tạo một event có `user_id` đúng. Không để Host tự signup hoặc tự tạo event. Cấp/reset mật khẩu bằng Dashboard/Admin API và chuyển qua kênh riêng; không ghi vào Markdown, commit hoặc chat công khai.

Hướng dẫn khách:

- Đăng nhập tại `<SITE_URL>/login` bằng tài khoản được cấp.
- **Thiệp & thông tin:** sửa nội dung, xem trước, lưu; thêm/thay nhạc MP3 tối đa 10 MiB.
- **Khách mời:** tên/email/lời mời → gửi; gửi lại dùng cùng link và tuân thủ 60 giây chờ. Không gửi lại khi kết quả unknown.
- **Phản hồi:** theo dõi tổng/danh sách, tìm/lọc; cập nhật khoảng 10 giây khi trang đang hiển thị, hoặc bấm Làm mới.
- Guest chỉ gửi một lần; Host không có chức năng sửa/reset RSVP.

Xử lý unknown theo `docs/BREVO_SEND_CONTRACT.md`; không xóa ledger/counter để mở khóa. Trần 300 suất/ngày là giới hạn ứng dụng, không phải quota Brevo còn lại. Kiểm tra mức sử dụng thật trên Dashboard Netlify/Supabase/Brevo, không suy ra quota từ số khách.

## Bằng chứng bàn giao cần điền

| Mục | Trạng thái |
| --- | --- |
| Site ID / URL HTTPS ổn định | Chờ người dùng chọn site |
| Quyền Netlify trên máy | Chưa có CLI session/token hoặc site link được xác nhận |
| Sender Brevo | API `/v3/senders`: HTTP 200, sender cấu hình tồn tại và active |
| Email người nhận thử | Chờ người dùng xác nhận |
| Host/event bàn giao | Chờ người dùng xác nhận; không dùng fixture |
| Deploy ID / phiên bản | Chưa deploy; branch `codex/mvp-e-invitation`, base commit `cc8f959`, mã MVP còn chưa commit |
| Supabase Auth Site URL / redirect | Chờ URL thật và xác minh Dashboard |
| Email thật đến hộp thư + link HTTPS | Chưa thử trong lượt Bước 8 |
| Smoke site đã deploy / điện thoại thật | Chưa thực hiện |

Chỉ đổi trạng thái hoàn tất khi các bằng chứng tương ứng đã có. Không dùng kết quả transport giả lập để đánh dấu email thật đạt.
