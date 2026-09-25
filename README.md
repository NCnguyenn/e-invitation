# E-Invitation MVP

Đã có mã đến Bước 7: Host đăng nhập, sửa thiệp, tạo khách, RSVP một lần, danh sách phản hồi, upload/phát nhạc, và gửi email qua Brevo với ledger chống trùng. Bước 8 đang nghiệm thu và chuẩn bị Netlify; chưa có bằng chứng deploy hoặc email thật trong lượt nghiệm thu này. Theo dõi trạng thái trong `docs/STEP8_DEPLOY_HANDOVER.md`.

## Chạy bản xem trước

Cần Node.js 22 trở lên (đã kiểm tra bằng Node 24.15.0).

```powershell
npm ci
npm run dev
```

Mở http://localhost:3000/preview để xem template bằng dữ liệu mẫu. Đây là route dành riêng cho development; khi chạy bản build production, route này trả 404. Trang gốc chuyển đến đăng nhập hoặc dashboard theo phiên.

Preview có dữ liệu mẫu để kiểm tra thiết kế. Nút phản hồi bị khóa; nhạc chưa được kết nối. Không gửi email, không gọi database, không lưu localStorage. Tên khách và thông tin sự kiện được truyền qua `GuestInvitation`; không lấy tên từ query string.

## Dùng dashboard với dữ liệu thật

Đặt biến theo `.env.example` vào `.env.local`. Áp các migration theo thứ tự tên file trên project test, gồm `supabase/migrations/202609270001_mvp_email_ledger.sql`, và tắt public signup. Không lưu khóa hoặc mật khẩu trong Git. Host phải được cấp tài khoản, profile active và một event trước khi sử dụng.

Mở http://localhost:3000/login, đăng nhập bằng tài khoản đã cấp. Tại **Thiệp & thông tin**, sửa tiêu đề, ngày/giờ Việt Nam, địa điểm, địa chỉ và liên kết Google Maps. **Xem trước** chỉ cập nhật bản nháp ở cạnh form; **Lưu thay đổi** ghi vào Supabase. Tải lại trang sẽ lấy dữ liệu đã lưu. Tên khách trong preview là tên mẫu, không tạo khách hay ghi RSVP. **Khách mời** tạo rồi gửi email; **Phản hồi** chỉ đọc RSVP đã có.

`SITE_URL` là nguồn duy nhất để tạo link `/invite/{token}` trong email: HTTPS công khai, không dấu `/` cuối, không lấy từ `APP_BASE_URL` hay Origin của request. Thiếu `SITE_URL`, API key hoặc sender thì máy chủ từ chối trước khi giữ suất. Localhost không phải bản test email từ xa hoàn chỉnh.

## Kiểm tra

```powershell
npm run typecheck
npm run test:unit
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

E2E tự mở và đóng server riêng tại cổng 3100. Integration và E2E Auth/editor cần Supabase test thật, `SUPABASE_TARGET=test` và URL khớp `supabase/test-project.json`; chúng tạo/cập nhật fixture có namespace riêng. Chạy tuần tự hai bộ này vì dùng chung tài khoản test. Đợi E2E/server test dừng trước khi kiểm tra TypeScript/build để tránh đọc file kiểu đang được Next.js sinh lại.

## Deploy và kiểm tra production

Cấu hình trong `netlify.toml`; không deploy HTML tĩnh vì Auth/API cần Next.js runtime. Đặt biến theo `.env.example` ở Netlify với phạm vi Builds và Functions; `SITE_URL` phải là URL HTTPS ổn định đã chọn. Không dùng `EMAIL_TRANSPORT=stub` trên hosting.

`npm run check:deploy` chặn thiếu cấu hình hoặc chọn transport giả lập. `npm run test:production` kiểm tra chỉ đọc server production local ở cổng 3200; đặt `SMOKE_BASE_URL` khi kiểm tra site thật. Công cụ quét secret chỉ kiểm tra `.next/static` local và các response đã lấy, không thay kiểm thử có đăng nhập/gửi email thật.

Chi tiết cấu hình, cấp tài khoản và checklist sau deploy: `docs/STEP8_DEPLOY_HANDOVER.md`.

## Cấu trúc chính

- `src/features/template/`: giao diện, album/lightbox, đếm ngược theo giờ Việt Nam và điều khiển nhạc. Chế độ preview không nhận callback ghi phản hồi; chế độ guest dành chỗ cho form thật ở Bước 4.
- `src/lib/contracts.ts`: kiểu dữ liệu dùng chung theo kế hoạch MVP.
- `src/features/events/`: form Host, giao diện dashboard và truy vấn event bằng session/RLS; API ở `src/app/api/host/event/route.ts`.
- `public/templates/wedding-floral-01/`: bản sao ảnh gốc; không sửa `images/`.
- `public/fonts/`: font tự host cùng giấy phép. Có thể tái tạo bundle bằng `node scripts/prepare-template-assets.mjs` sau `npm ci`.
- `.env.example`: tên biến kết nối. `SITE_URL` dùng cho link email; không còn `APP_BASE_URL`. Hợp đồng Brevo và cách đối soát unknown nằm ở `docs/BREVO_SEND_CONTRACT.md`.

Giữ nguyên `index.html`, `config.js`, `style.css`, `script.js` làm tham chiếu. Next.js không nạp các script gốc có customizer/localStorage. Thiệp không tải Google Fonts, Font Awesome CDN hoặc iframe Maps; nút chỉ đường chỉ mở Maps khi người dùng bấm.

Theo dõi tiến độ trong `docs/superpowers/plans/2026-09-24-mvp-e-invitation.md`; kết quả kiểm tra và điều kiện còn thiếu trong `docs/MVP_TEST_HANDOVER.md`.
