# Kế hoạch triển khai MVP E-Invitation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Thực hiện tuần tự theo các mốc dưới đây; đây là kế hoạch, chưa phải lệnh bắt đầu triển khai.

**Goal:** Có bản HTTPS cho khách test: Host đăng nhập bằng tài khoản được cấp, sửa thông tin/nhạc, gửi email mời, xem phản hồi; Guest chỉ gửi RSVP một lần.

**Architecture:** Tái sử dụng thiết kế HTML/CSS hiện có thành template trong Next.js. Supabase phụ trách Auth/Postgres/Storage; route server xác thực quyền, xử lý RSVP nguyên tử và gửi email qua Brevo. Dashboard dùng polling 10 giây, không làm system-admin hoặc giám sát quota trong MVP.

**Tech Stack:** Next.js App Router, TypeScript, CSS hiện có được tách phạm vi, Supabase, Brevo, Netlify. Kiểm thử nghiệp vụ bằng Vitest, kiểm thử trình duyệt bằng Playwright; phiên bản cụ thể được kiểm tra và khóa khi thực hiện bước 1.

**Căn cứ:** [YEU_CAU_MVP.md](../../../YEU_CAU_MVP.md), [YEU_CAU_DU_AN.md](../../../YEU_CAU_DU_AN.md). Khi hai tài liệu khác nhau về RSVP/phạm vi, yêu cầu MVP được ưu tiên.

**Thư mục dự án:** `D:\Personal_Project\e-invitatio-main`.

## Global Constraints

- “Mỗi Host được cấp một sự kiện trong đợt MVP”; Host không tự tạo tài khoản/sự kiện.
- “RSVP một lần”: trạng thái, ghi chú và thời điểm phản hồi không được ghi đè sau lần thành công đầu tiên.
- “Không dùng dữ liệu mẫu hoặc localStorage để giả lập kết quả trong bản bàn giao test.”
- MP3 tối đa 10.485.760 byte, MIME audio/mpeg; byte upload đi trực tiếp từ trình duyệt tới Supabase Storage.
- Token 32 byte ngẫu nhiên, biểu diễn 64 ký tự hex; gửi lại email giữ token và RSVP.
- Ghi chú Guest tối đa 1.000 ký tự; lời mời riêng tối đa 500; tên 1–255 sau trim; email trim/lowercase.
- Timezone sự kiện cố định Asia/Ho_Chi_Minh; lưu thời điểm bằng TIMESTAMPTZ.
- Polling 10 giây khi tab Phản hồi đang hiển thị; phân trang 50 dòng.
- Không có system-admin, metrics, đăng ký, quên mật khẩu tự phục vụ, upload album/banner, gửi hàng loạt, reset RSVP, cron hoặc webhook.
- Không thay đổi yêu cầu MVP để né lỗi tích hợp. Không coi giao diện chạy bằng mock là mốc bàn giao.
- Chỉ thay đổi schema trên môi trường test đã xác định; không reset database từ xa hoặc dùng dữ liệu khách thật cho fixture kiểm thử.
- Mọi lệnh và file triển khai dưới đây là kế hoạch cần thực hiện; chưa tồn tại chỉ vì được nêu trong tài liệu.

---

## 0. Hiện trạng và điều kiện đầu vào

Đã đọc repo: có index.html, style.css, script.js, config.js, thư mục images và music.mp3; chưa có package.json hoặc cấu trúc ứng dụng Next.js.

Các phần cần chuyển:
- script.js đang dùng localStorage cho lời chúc; cần thay bằng API/database.
- index.html có customizer, số người đi cùng, sổ lời chúc công khai và iframe Maps; loại khỏi runtime MVP.
- style.css có Google Fonts import; index.html có Font Awesome CDN. Đóng gói font thực sự dùng và thay icon bằng asset nội bộ.
- Tên Guest hiện có thể lấy từ query; tên runtime phải lấy từ invitation theo token.

### Chuẩn bị ngay từ đầu

- [x] Xác định project Supabase dành cho test và người có quyền cấu hình Auth/database/Storage.
- [ ] Xác định tài khoản Brevo, API key và sender có thể xác minh. Bắt đầu xác minh sender sớm; không chờ đến lúc giao diện hoàn tất.
- [ ] Xác định tài khoản Netlify/repo GitHub để deploy và URL test ổn định.
- [ ] Xác định một sự kiện thử, thông tin nội dung và hai hộp thư được phép nhận email thử.
- [x] Tạo hai Host test A/B để kiểm tra phân quyền; mỗi Host một sự kiện.
- [x] Secret Supabase đặt vào môi trường local, không ghi vào file kế hoạch, commit hoặc chat. Biến Netlify chuẩn bị ở Bước 8.
- [x] Ghi các mục đã sẵn sàng/chưa sẵn sàng trong docs/MVP_TEST_HANDOVER.md khi thực hiện.

**Không chặn công việc độc lập:** Có thể làm bước 1 trong lúc chủ tài khoản chuẩn bị quyền truy cập. Bước 2 cần Supabase test; bước 7 cần sender Brevo hợp lệ; bước 8 cần quyền deploy. Thiếu các điều kiện này phải ghi đúng điểm đang bị chặn, không thay bằng kết nối giả.

## 1. Bản đồ file triển khai

Các đường dẫn dưới đây tính từ thư mục dự án; giữ các file HTML/JS/CSS gốc làm tham chiếu trong quá trình chuyển.

| File / nhóm file | Trách nhiệm |
| :--- | :--- |
| package.json, package-lock.json, tsconfig.json, next.config.ts, .env.example, .gitignore | Khởi tạo app, khóa dependency, scripts, cấu hình và tên biến môi trường. |
| src/app/layout.tsx, src/app/page.tsx, src/app/globals.css | Khung ứng dụng; route gốc chuyển về login/dashboard theo phiên. |
| src/app/login/page.tsx, src/app/dashboard/page.tsx | Hai màn hình Host, gồm kiểm tra session phía server. |
| src/app/invite/[token]/page.tsx, src/app/invite/[token]/not-found.tsx | Trang thiệp Guest, metadata và lỗi token. |
| src/features/template/InvitationTemplate.tsx, template.css, content.ts | Chuyển giao diện thiệp và nội dung mỹ thuật từ file gốc. |
| src/features/template/AudioPlayer.tsx, Gallery.tsx, Countdown.tsx | Nhạc, album/lightbox và thời gian; mỗi component có trách nhiệm riêng. |
| public/templates/wedding-floral-01/, public/fonts/ | Bản sao asset cần dùng và font được phép tự host; template_key kế thừa để tương thích v1.2. |
| src/lib/contracts.ts, validation.ts, http.ts | Kiểu dữ liệu, validation dùng chung và phản hồi lỗi. |
| src/lib/supabase/browser.ts, server.ts, admin.ts | Supabase client theo môi trường; admin chỉ được import ở server. |
| src/features/auth/server.ts, LoginForm.tsx | Xác thực Host và giao diện đăng nhập. |
| src/features/events/server.ts, EventEditor.tsx, MusicUploader.tsx | Đọc/sửa event, upload/finalize và giao diện cấu hình. |
| src/features/invitations/server.ts, InviteForm.tsx, GuestTable.tsx | Tạo khách, phân trang/tìm kiếm và form mời. |
| src/features/guest/server.ts, RsvpForm.tsx, ResponseReceipt.tsx | Đọc thư mời, gọi RPC RSVP một lần, form và kết quả chỉ đọc. |
| src/features/responses/ResponseTable.tsx, useResponses.ts | Bảng phản hồi và polling có dừng khi ẩn tab. |
| src/features/email/server.ts, render.ts | Gửi qua Brevo, ledger, xử lý kết quả và HTML email. |
| src/app/api/host/**/route.ts, src/app/api/guest/[token]/**/route.ts | Route handlers theo bảng giao tiếp mục 2. |
| supabase/migrations/202609240001_mvp_core.sql | Schema lõi, RLS, RPC RSVP, Storage policies. |
| supabase/migrations/202609240002_mvp_email.sql | Ledger gửi email, bộ đếm ngày, RPC giữ suất/chuyển trạng thái. |
| tests/integration/, tests/unit/, tests/e2e/ | Kiểm thử quyền, database, email và hành trình trình duyệt. |
| vitest.config.ts, playwright.config.ts | Cấu hình kiểm thử; không cho test tích hợp chạy nhầm production. |
| docs/MVP_TEST_HANDOVER.md | Cấu hình bàn giao, kết quả test và hướng dẫn thao tác. |

Chỉ thêm cơ chế refresh session của Next.js/Supabase phù hợp phiên bản đã chọn khi thực hiện; kiểm tra tài liệu chính thức lúc đó, không sao chép middleware từ phiên bản không tương thích.

## 2. Giao tiếp giữa các phần

### Kiểu dữ liệu dùng chung

Định nghĩa trước trong src/lib/contracts.ts:

```ts
export type RsvpStatus = 'pending' | 'accepted' | 'declined';
export type RsvpDecision = Exclude<RsvpStatus, 'pending'>;
export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';

export type RsvpReceipt = {
  status: RsvpDecision;
  guestMessage: string | null;
  respondedAt: string;
};

export type ApiFailure = {
  code: string;
  message: string;
  retryAfterSeconds?: number;
};

export type SubmitRsvpResult =
  | { kind: 'saved'; receipt: RsvpReceipt }
  | { kind: 'already_responded'; receipt: RsvpReceipt }
  | { kind: 'not_found' };

export type HostEvent = {
  id: string;
  title: string;
  eventDate: string;
  timezone: 'Asia/Ho_Chi_Minh';
  venueName: string | null;
  venueAddress: string | null;
  googleMapUrl: string | null;
  hasMusic: boolean;
};

export type GuestInvitation = {
  event: HostEvent;
  guestName: string;
  invitationNote: string | null;
  status: RsvpStatus;
  receipt: RsvpReceipt | null;
};
```

HostEvent là projection, không chứa service-role key, đường dẫn private hoặc dữ liệu của khách khác. DTO gửi client dùng camelCase, mapper server chuyển từ tên cột snake_case.

### Route thống nhất

| Route | Input | Output / quyền |
| :--- | :--- | :--- |
| POST /api/auth/login | email, password | Đặt session cookie, không trả mật khẩu; lỗi đăng nhập chung. |
| POST /api/auth/logout | Không | Hủy phiên, kiểm tra Origin; UI về login. |
| GET /api/host/event | Session | HostEvent của Host; không có event trả trạng thái rỗng rõ ràng. |
| PATCH /api/host/event | title, eventDate, venueName, venueAddress, googleMapUrl | Cập nhật whitelist cho event của session. |
| POST /api/host/audio/prepare | MIME, size | Path cố định do server xác định sau kiểm tra quyền. |
| POST /api/host/audio/finalize | Không nhận path tùy ý | Xác minh object dự kiến, lưu music_path. |
| POST /api/host/audio/preview | Session | Signed URL để Host nghe thử, không tạo token Guest giả. |
| GET /api/host/invitations | page, query, status | Các dòng, tổng dòng và tổng theo RSVP của event; lọc dữ liệu ở server. |
| POST /api/host/invitations | guestName, guestEmail, invitationNote | Tạo pending; email trùng trả 409 cùng ID dòng cũ thuộc Host. |
| PATCH /api/host/invitations/[id] | Tên/email/lời mời | Chỉ khi chưa từng gửi và invitation thuộc Host. |
| POST /api/host/invitations/[id]/send | requestId UUID | Gửi/gửi lại, xác thực session/sở hữu; giữ token/RSVP. |
| GET /api/guest/[token] | Token | GuestInvitation, no-store; dùng cả khi cần đọc lại sau timeout. |
| POST /api/guest/[token]/rsvp | decision, guestMessage | 200 saved; 409 kèm receipt cũ; 404 token sai; 422 input sai. |
| POST /api/guest/[token]/audio | Token | Signed URL 60 phút; 429 khi vượt trần. |

Form “Gửi lời mời” gọi tạo khách rồi gọi send bằng requestId được giữ cho cùng thao tác. Nếu tạo thành công mà send lỗi, giữ dòng pending/failed/unknown và hiện đúng trạng thái. Không xóa dòng đã tạo hoặc tạo thêm dòng để thử lại.

Chữ ký server để các bước dùng thống nhất:
- `requireHost(): Promise<{ userId: string }>` — từ session đã xác minh, lỗi 401 nếu không hợp lệ.
- `readHostEvent(userId: string): Promise<HostEvent | null>`.
- `readGuestInvitation(token: string): Promise<GuestInvitation | null>`.
- `submitRsvpOnce(token: string, decision: RsvpDecision, guestMessage: string | null): Promise<SubmitRsvpResult>`.
- `sendInvitation(userId: string, invitationId: string, requestId: string): Promise<{ emailStatus: EmailStatus; attemptId: string }>`.

## Bước 1 — Có ứng dụng chạy được và giữ giao diện thiệp

**Phụ thuộc:** Không cần credential để chuyển giao diện; không báo đã kết nối dữ liệu ở bước này.

**Files:** package/config ở mục 1; src/app/layout.tsx; src/features/template/*; public/templates/wedding-floral-01/; public/fonts/; src/lib/contracts.ts.

- [x] Kiểm tra working tree, tạo nhánh codex/mvp-e-invitation khi bắt đầu thực hiện, bảo toàn thay đổi sẵn có.
- [x] Khởi tạo Next.js ngay trong repo bằng cách thêm cấu hình có kiểm soát, không chạy scaffold ghi đè index.html/script.js/style.css/config.js.
- [x] Chọn bản stable được hỗ trợ và khóa dependency. Tạo scripts dev, build, typecheck, test:unit, test:integration, test:e2e; tách test tích hợp khỏi test không cần dịch vụ.
- [x] Tạo .env.example chỉ gồm tên biến của MVP; đưa .env.local và báo cáo test vào .gitignore.
- [x] Chuyển cấu trúc thiệp sang InvitationTemplate; bóc Gallery/Countdown/AudioPlayer khỏi DOM script toàn cục.
- [x] Đổi asset path sang /templates/wedding-floral-01/; tự host các font thực sự dùng, giữ giấy phép cần thiết; bỏ CDN/iframe/customizer/sổ lời chúc/số người đi cùng.
- [x] Cho template nhận GuestInvitation và chế độ preview. Preview không có callback ghi RSVP; dữ liệu fixture chỉ dùng development/test, không fallback production.
- [x] Kiểm tra 360 px và desktop: bố cục, ảnh, lightbox, giảm chuyển động; bỏ chặn zoom trên viewport.
- [x] Chạy `npm run typecheck` và `npm run build`; sửa đến khi pass.

**Kết quả đạt:** App build được; giao diện thiệp giữ thiết kế có sẵn; preview chưa kết nối không được đưa cho khách như bản hoàn chỉnh.

**Đã thực hiện ngày 25/09/2026:** typecheck/build đạt; unit và E2E preview đạt; HTTP production `/preview` trả 404. Chi tiết trong [MVP_TEST_HANDOVER.md](../../MVP_TEST_HANDOVER.md). Bước 2 đã hoàn thành trên project test.

## Bước 2 — Database, phân quyền và đăng nhập thật

**Phụ thuộc:** Bước 1 và Supabase test sẵn sàng.

**Files:** 202609240001_mvp_core.sql; src/lib/supabase/*; src/features/auth/*; login/dashboard pages; api/auth routes; tests/integration/authorization.test.ts.

- [x] Viết test bằng JWT Host A/B và anon: đọc/sửa chéo event bị chặn; client không sửa role/token/RSVP/music_path.
- [x] Tạo profiles/events/invitations theo hợp đồng MVP, FK/index/unique/check; bổ sung cột bảo vệ RSVP và bộ đếm xin nhạc.
- [x] Thêm trigger profile mặc định host, chuẩn hóa email/tên, updated_at; validation database cho các cột Host được sửa trực tiếp.
- [x] Bật RLS và thu hồi grant thừa. RPC đặc quyền chỉ service_role được EXECUTE; không cho client truy cập ledger qua table.
- [x] Tắt public signup; tạo hai auth user test đã xác nhận theo cơ chế Admin và gán một event cho mỗi user, không lưu mật khẩu vào SQL seed.
- [x] Viết requireHost bằng session kiểm chứng; server/client/admin Supabase tách module, admin có server-only.
- [x] Làm login, logout, bảo vệ dashboard và route Host; CSRF/Origin cho mutation có cookie.
- [x] Kiểm tra sai mật khẩu, phiên hết hạn, đăng xuất và Host chưa có event.
- [x] Chạy bộ integration bao gồm tests/integration/authorization.test.ts, kiểm tra bằng role thật; service role không được dùng thay JWT Host trong test quyền.

**Kết quả đạt:** Host đăng nhập thật và chỉ thấy event của mình. Chưa có API email cũng không ảnh hưởng mốc này.

**Trạng thái thực hiện:** Hoàn tất trên project test. Migration bổ sung `202609250001_mvp_sent_invitation_identity_lock.sql` đã được người dùng áp; nghiệm thu lại đạt 16/16 integration và 11/11 E2E auth trong bộ E2E cuối Bước 3. Guard môi trường test và các ca cookie/refresh đã được kiểm tra. Chi tiết trong [MVP_TEST_HANDOVER.md](../../MVP_TEST_HANDOVER.md).

## Bước 3 — Host sửa thông tin và xem trước thiệp

**Phụ thuộc:** Bước 2.

**Files:** src/features/events/server.ts, EventEditor.tsx; api/host/event; dashboard; src/lib/validation.ts; tests/unit/validation.test.ts; tests/e2e/event-editor.spec.ts.

- [x] Viết test title rỗng/quá 255, link Maps giả domain/userinfo/port sai và ngày giờ Việt Nam chuyển UTC.
- [x] Thực hiện GET/PATCH event theo userId từ session, không tin user_id/event_id tùy ý client gửi.
- [x] Làm tab Thiệp & thông tin, form tiêu đề/ngày giờ/địa điểm/địa chỉ/link Maps; khóa nút trong lúc lưu, giữ input khi lỗi.
- [x] Lấy thời gian từ eventDate để render đồng bộ lịch/đếm ngược; không giữ ngày cũ từ config.js.
- [x] Nút Xem trước render cùng InvitationTemplate với tên mẫu; không tạo invitation hoặc gọi RSVP.
- [x] Tải lại trang và kiểm tra bằng phiên khác: dữ liệu còn đúng; Host B không xem được preview Host A.
- [x] Chạy unit validation và E2E editor riêng, sau đó chạy toàn bộ unit/E2E để kiểm tra hồi quy.

**Kết quả đạt:** Khách hàng đã đăng nhập và thao tác được với thông tin thật; đây là mốc xem giao diện Host đầu tiên.

**Hoàn tất ngày 25/09/2026:** UI theo mockup đã duyệt; kiểm tra thực tế desktop 1440 px/mobile 360 px. Typecheck/build đạt, unit 19/19, integration 16/16, E2E 19/19 (editor 6, auth 11, preview 2). Chưa deploy hoặc triển khai Bước 4. Chi tiết và cách thao tác trong [MVP_TEST_HANDOVER.md](../../MVP_TEST_HANDOVER.md).

## Bước 4 — Tạo khách mời, mở thiệp và khóa RSVP một lần

**Trạng thái thực hiện:** Hoàn tất trên project test. Migration RPC `202609260001_mvp_submit_rsvp_once.sql` đã áp. Nghiệm thu đạt 24/24 integration và 25/25 E2E.

**Phụ thuộc:** Bước 3. Chưa cần Brevo; dùng link invitation do dữ liệu test tạo để kiểm tra luồng.

**Files:** src/features/invitations/server.ts, InviteForm.tsx; src/features/guest/*; invite/[token] pages; api/host/invitations; api/guest/[token]; api/guest/[token]/rsvp; tests/integration/rsvp.test.ts; tests/e2e/guest.spec.ts.

- [x] Viết test đầu tiên cho hai kết nối DB gửi RSVP ngược nhau: chỉ một kết quả saved, kết quả còn lại already_responded; trạng thái, ghi chú, responded_at cuối cùng cùng thuộc một lần ghi.
- [x] Tạo invitation token bằng CSPRNG, email chuẩn hóa/unique; email trùng trả 409 và ID cũ, không upsert đè dữ liệu đã gửi.
- [x] Thêm submit_rsvp_once RPC ghi UPDATE có điều kiện pending/responded_at NULL; trigger chặn sửa phản hồi đã chốt. Sau ghi, trả receipt thực từ DB.
- [x] Làm submitRsvpOnce mapper ra 200/409/404/422; validate decision và độ dài; token sai định dạng bị loại trước DB.
- [x] Làm readGuestInvitation với projection chỉ của Guest đó; no-store và 404 thống nhất; metadata chỉ có thông tin công khai.
- [x] Form không chọn sẵn, tên chỉ đọc, ghi chú ≤1.000, cảnh báo chỉ gửi một lần. Chỉ đổi sang cảm ơn sau receipt server.
- [x] Khi timeout, GET lại trạng thái: đã trả lời hiện receipt, chưa trả lời giữ form; không retry UPDATE mù.
- [x] Kiểm tra mở lại link ở browser context mới: không có form, chỉ có lựa chọn/ghi chú/thời gian ban đầu; request trực tiếp lần hai vẫn bị từ chối.
- [x] Kiểm tra GET/bot preview không tạo phản hồi, link giả trả 404 và không lộ khách khác.
- [x] Chạy `npm run test:integration -- tests/integration/rsvp.test.ts` và `npm run test:e2e -- tests/e2e/guest.spec.ts`.

**Mẫu assertion bắt buộc trong test tích hợp:**

```ts
const results = await Promise.all([
  submitRsvpOnce(token, 'accepted', 'Tôi tham gia'),
  submitRsvpOnce(token, 'declined', 'Tôi vắng mặt'),
]);
expect(results.filter(r => r.kind === 'saved')).toHaveLength(1);
expect(results.filter(r => r.kind === 'already_responded')).toHaveLength(1);
const afterFirst = await readGuestInvitation(token);
await submitRsvpOnce(token, 'declined', 'Ghi đè trái phép');
expect(await readGuestInvitation(token)).toEqual(afterFirst);
```

Các hàm dùng đúng chữ ký mục 2; token fixture tạo riêng cho test, không dùng link của khách thật.

**Kết quả đạt:** Phần quan trọng nhất đã chạy thật: Guest chỉ có một câu trả lời bền vững giữa mọi thiết bị.

## Bước 5 — Host thấy danh sách và phản hồi

**Trạng thái thực hiện:** Hoàn tất trên project test. Unit 41/41, integration 34/34 trên Supabase test thật, E2E 33/33 (Chromium Desktop 1440px và Mobile 360px), typecheck và production build đạt. Chi tiết trong [MVP_TEST_HANDOVER.md](../../MVP_TEST_HANDOVER.md).

**Phụ thuộc:** Bước 4.

**Files:** src/features/invitations/GuestTable.tsx; src/features/responses/*; api/host/invitations GET/PATCH; tests/e2e/host-responses.spec.ts.

- [x] Làm danh sách khách và tab Phản hồi dùng cùng dữ liệu invitation; phân trang 50, tìm theo tên/email, lọc pending/accepted/declined.
- [x] Tính tổng toàn event ở server; tách khỏi số dòng của trang đang xem. Không lấy count của 50 dòng làm tổng khách.
- [x] Cho sửa tên/email/lời mời chỉ khi has_send_history=false; dùng kiểm tra ở DB và server, không chỉ disable input.
- [x] Viết useResponses: poll 10 giây khi tab Phản hồi active và document visible; dừng khi ẩn tab/logout; hủy request cũ và không để response cũ đè response mới.
- [x] Nút Làm mới tải ngay; lỗi mạng giữ snapshot cũ và hiển thị chưa cập nhật, không điền số 0.
- [x] Test hai browser context: Guest gửi → Host thấy đúng trạng thái/ghi chú/thời gian ở lần tải thành công tiếp theo.
- [x] Test mỗi Guest chỉ đóng góp một đơn vị vào tổng; bộ lọc/tìm kiếm không rò dữ liệu event khác.
- [x] Chạy `npm run test:e2e -- tests/e2e/host-responses.spec.ts`.

**Kết quả đạt:** Luồng Host tạo khách → Guest phản hồi → Host thấy kết quả đã hoàn chỉnh, chưa phụ thuộc gửi email.

## Bước 6 — Upload và phát nhạc thật

**Trạng thái thực hiện:** Hoàn tất nghiệm thu trên project test. Migration `202609260002_mvp_consume_audio_request_slot.sql` đã áp thành công. Unit test 56/56 đạt, integration 45/45 đạt trên Supabase test thật, E2E 39/39 đạt trên Chromium Desktop và Mobile, typecheck và production build đạt. Chi tiết trong [MVP_TEST_HANDOVER.md](../../MVP_TEST_HANDOVER.md).

**Phụ thuộc:** Bước 3 và Storage policies từ bước 2; Guest audio cần bước 4.

**Files:** src/features/events/MusicUploader.tsx; src/features/template/AudioPlayer.tsx; api/host/audio/*; api/guest/[token]/audio; tests/integration/storage.test.ts; tests/e2e/audio.spec.ts.

- [x] Tạo audio bucket private, giới hạn 10.485.760 byte và audio/mpeg; path {user_id}/{event_id}/music.mp3.
- [x] Test Storage bằng JWT Host: INSERT lần đầu, SELECT/UPDATE để ghi đè lần hai; không upload vào event không tồn tại hoặc event khác.
- [x] Làm prepare upload, browser upload trực tiếp, finalize kiểm tra object metadata/path đúng trước khi lưu music_path.
- [x] Finalize lỗi hiện trạng thái đã upload chưa xác nhận; thử lại finalize cùng object. Không truyền byte nhạc qua Next.js/Netlify.
- [x] Host nghe thử bằng route session riêng; Guest nhận signed URL từ token sau thao tác mở/phát.
- [x] Rate limit xin nhạc giữ lượt nguyên tử, 30/token/60 phút; signed URL 60 phút; quá trần 429.
- [x] Xử lý play() bị trình duyệt chặn bằng nút Play; URL hết hạn xin lại có kiểm soát; thiếu nhạc không chặn RSVP.
- [x] Kiểm tra Network: không tải MP3 khi vừa mở trang và không có signed URL trong HTML ban đầu.
- [x] Chạy `npm run test:integration -- tests/integration/storage.test.ts` và kiểm tra Playwright E2E audio (11/11 integration test, 6/6 E2E audio test đạt 100%).

**Kết quả đạt:** Host thay nhạc được, Guest nghe được; không lộ file nhạc của Host khác.

## Bước 7 — Gửi email thật và chống gửi trùng

**Phụ thuộc:** Bước 4–5 và sender Brevo hợp lệ.

**Files:** `supabase/migrations/202609270001_mvp_email_ledger.sql`; `src/features/email/`; `src/app/api/host/invitations/[id]/send/route.ts`; `tests/unit/email-template.test.ts`; `tests/integration/email-send.test.ts`; `tests/e2e/email-send.spec.ts`; `docs/BREVO_SEND_CONTRACT.md`.

- [x] Tạo ledger/counter/RPC; thu hồi quyền client; unique actor_id/request_id và khóa attempt chưa giải quyết. Đã áp trên project test ghim và kiểm bằng RPC.
- [x] Test giả lập transport cho 201, từ chối chắc chắn, timeout, response đến muộn. Không gửi email ra ngoài.
- [x] Giữ suất trong transaction counter ngày → invitation → attempt; replay requestId trả kết quả cũ trước cooldown/trần.
- [x] Compare-and-set reserved → sending, commit rồi mới gọi HTTP; một winner duy nhất được gọi. Integration xác nhận một transport call.
- [x] last_send_attempt_at cả khi lỗi; cooldown 60 giây; trần nội bộ 300 suất/ngày Việt Nam; không hoàn suất; không gọi đây là quota Brevo.
- [x] HTML-escape, SITE_URL server, tiêu đề Thư mời: {event_title}; không lấy origin từ request để tạo link.
- [x] messageId/accepted_at khi tiếp nhận; rejected chỉ khi có bằng chứng; timeout/lỗi không rõ thành unknown; không tự gửi lại.
- [x] Danh sách/gửi phát hiện reserved/sending quá 2 phút thành unknown. Runbook ở `docs/BREVO_SEND_CONTRACT.md`. Không có system-admin.
- [x] Nút Gửi lời mời: tạo rồi gửi; giữ requestId khi kiểm tra lại; gửi lại chủ động dùng requestId mới và giữ token/RSVP.
- [x] Counter cô lập 299 với 10 request: một suất mới. Hai requestId giống nhau: một transport call.
- [x] `npm run test:unit` 69/69 và `npm run test:integration` 59/59, gồm `email-send.test.ts`.
- [ ] Gửi một email thật tới hộp thư thử đã được phép, mở trên điện thoại, xác minh link và phản hồi. Chưa đạt: thiếu `SITE_URL` HTTPS công khai và hộp thư thử được phép. Không thay bằng toast.

**Kết quả hiện tại:** Ledger, UI và test giả lập đã chạy. Hành trình email thật chưa đạt. Gửi lại trong test giả lập giữ token và RSVP.

## Bước 8 — Kiểm thử cuối, deploy và bàn giao test

**Phụ thuộc:** Tất cả các bước chức năng trước; credential deploy sẵn sàng.

**Files:** tests/e2e/full-journey.spec.ts; cấu hình Netlify nếu runtime cần; docs/MVP_TEST_HANDOVER.md.

- [x] Hoàn tất full-journey local với Host A, Host B và Guest dùng browser context khác nhau; database/Storage thật, email transport test được ghi rõ.
- [x] Kiểm tra lại 16 mục checklist trong YEU_CAU_MVP.md; ghi bằng chứng đạt local/chưa đạt vào docs/STEP8_DEPLOY_HANDOVER.md, không tự tick nghiệm thu toàn MVP.
- [ ] Chạy lần lượt: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`, `npm run test:e2e`. Test tích hợp trỏ đúng môi trường test.
- [ ] Kiểm tra mobile 360 px, desktop, mất mạng khi gửi RSVP, session hết hạn, upload lần hai, không có nhạc và hai tab gửi ngược lựa chọn.
- [ ] Kiểm tra JS/HTML public không có service role, Brevo key, customizer hoặc dữ liệu khách khác; no-store/noindex/referrer ở response thật.
- [ ] Chuẩn bị cấu hình deploy và biến môi trường Netlify, xác nhận URL test ổn định; không dùng URL preview tạm hết hiệu lực trong email bàn giao.
- [ ] Khi bước deploy được thực hiện theo quyền đã cấp, deploy bản test và đặt SITE_URL/Auth site URL/allowlist theo URL thật; không thêm wildcard rộng khi không cần.
- [ ] Chạy smoke test trên URL đã deploy: login → sửa địa chỉ/nhạc → email thật → Guest RSVP → Host nhìn thấy → mở lại link không sửa được.
- [ ] Ghi URL, phiên bản/commit, hướng dẫn cấp/reset tài khoản, nguồn kiểm tra quota và cách xử lý unknown. Mật khẩu chuyển riêng, không lưu trong Markdown.
- [ ] Bàn giao cho khách: URL /login, email/mật khẩu do bạn cấp, hướng dẫn ba tab và quy tắc RSVP một lần.

**Kết quả đạt:** Có URL HTTPS ổn định và luồng thật được xác minh sau deploy, sẵn sàng cho khách test. Không đồng nghĩa cam kết SLA production hoặc hoàn tất hệ thống end-to-end v1.2.

**Trạng thái Bước 8:** Đang thực hiện, chưa đạt kết quả bàn giao. Đã có netlify.toml, preflight và script smoke production; unit 74/74, integration 59/59, typecheck/build đạt. E2E 44/45, full journey desktop/mobile đạt; ca editor-mobile đã sửa chờ HTTP login nhưng chạy lại bị automatic approval review chặn do hạn mức. Chờ site/quyền Netlify, SITE_URL, hộp thư thử và Host bàn giao do người dùng xác nhận. Xem [STEP8_DEPLOY_HANDOVER.md](../../STEP8_DEPLOY_HANDOVER.md) để biết bằng chứng và hạn chế đầy đủ.

## 3. Mốc kiểm soát tiến độ

| Mốc | Sau bước | Bạn kiểm tra được gì |
| :--- | :--- | :--- |
| A — Giao diện có dữ liệu thật | 3 | Login, dashboard, sửa event và xem trước thiệp. |
| B — Phản hồi một lần | 5 | Guest trả lời, Host thấy dữ liệu, mở lại link không sửa được. |
| C — Đủ tính năng MVP | 7 | Thêm nhạc và gửi email thật; đi hết hành trình. |
| D — Bàn giao test | 8 | URL HTTPS, test sau deploy, tài khoản và hướng dẫn sử dụng. |

Ưu tiên hoàn thành B trước khi dành thời gian tinh chỉnh hiệu ứng. Chuẩn bị sender từ bước 0 giúp mốc C không bị chặn bởi cấu hình dịch vụ vào cuối quá trình.

Không chốt ngày bàn giao khi chưa biết quyền truy cập dịch vụ/sender và kết quả triển khai. Theo dõi bằng mốc chạy được và checklist, thay vì ghi phần trăm hoàn thành không có bằng chứng.

## 4. Đối chiếu với yêu cầu MVP

| Yêu cầu | Bước thực hiện |
| :--- | :--- |
| Tận dụng thiệp có sẵn, bỏ các thành phần ngoài phạm vi | 1 |
| Bạn cấp tài khoản, Host đăng nhập và chỉ thấy sự kiện của mình | 0, 2 |
| Sửa tiêu đề/thời gian/địa chỉ, preview không ghi RSVP | 3 |
| Tạo khách, email trùng, sửa trước khi gửi | 4, 5 |
| Guest phản hồi một lần, thank-you, mở lại chỉ đọc | 4 |
| Host xem danh sách, tổng, lọc, polling | 5 |
| Thêm/thay nhạc và Guest nghe nhạc | 6 |
| Email thật, gửi lại cùng link, lỗi/unknown/cooldown | 7 |
| Supabase/Brevo/Netlify và URL test | 0, 2, 6, 7, 8 |
| Quyền, validation, dữ liệu thật và riêng tư | 2–8 |
| Không system-admin/metrics/domain riêng/reset RSVP | Global Constraints và toàn bộ phạm vi |
| Checklist và hướng dẫn bàn giao | 8 |

Khi triển khai, mỗi bước chỉ được đánh dấu hoàn thành sau khi kiểm tra kết quả tương ứng. Commit theo mốc chức năng với các file liên quan đã review; không git add toàn bộ thay đổi ngoài phạm vi. Migration email Bước 7 đã áp trên project test. Chưa gửi email thật và chưa deploy.
