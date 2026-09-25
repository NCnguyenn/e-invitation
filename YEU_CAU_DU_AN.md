# TÀI LIỆU ĐẶC TẢ YÊU CẦU & KIẾN TRÚC DỰ ÁN (SPEC v1.2)
## WEBSITE THƯ MỜI ĐIỆN TỬ (E-INVITATION SYSTEM)

Phiên bản 1.2 — cập nhật ngày 24/09/2026. Bản này hoàn thiện yêu cầu triển khai, sửa luồng gửi email, quyền Storage, validation, migration và đặc tả giám sát tài nguyên tại mục 7. Mô hình sản phẩm không đổi. Đây là đặc tả để lập trình và nghiệm thu, không phải xác nhận hệ thống đã được triển khai hoặc kiểm thử.

Nguồn chính thức và ngày đối chiếu được ghi tại mục 10. Số liệu tài khoản thực tế chỉ được hiển thị sau khi đọc từ API chính thức; trường hợp chưa có API phù hợp thì dẫn tới Usage/Billing của nền tảng. Hạn mức trong tài liệu chỉ là thông tin tham chiếu có ngày kiểm tra, không được dùng giả làm dữ liệu tài khoản đang chạy.

---

## 0. QUYẾT ĐỊNH ĐÃ KHÓA

1. Mỹ thuật (tên cô dâu chú rể trên layout, câu chuyện, album, hoa rơi, font) nằm trong template code và `/public/templates/[template_key]/`. Host không upload album. `index.html` nếu có trong repo chỉ là bản thiết kế tham chiếu, không phải runtime.
2. Một host có nhiều sự kiện. v1 host không tự tạo sự kiện và không đổi `template_key`. Developer tạo sự kiện và gán template.
3. `/system-admin` vừa xem quota, vừa tạo host, tạo sự kiện, đổi template, xóa kèm dọn file. Không phải nơi thiết kế thiệp.
4. File nhạc và banner upload từ trình duyệt thẳng vào Supabase Storage. Không gửi byte file qua Netlify Function hay Server Action.
5. Trình duyệt không được INSERT/DELETE `events` hoặc `invitations`, và không được sửa token, trạng thái email, RSVP.
6. Gửi lại email dùng lại token và invitation cũ, nhưng mỗi lần gửi chủ động có một bản ghi lịch sử riêng. Dùng khóa database, mã yêu cầu và trạng thái `unknown` để xử lý bấm đúp, timeout và phục hồi.
7. Gói Brevo Free luôn có nhãn "Sent with Brevo". Domain riêng không gỡ nhãn này.
8. v1 không có cron, không có trang quên mật khẩu, không có webhook bounce.
9. Google Maps là link ngoài, không iframe. Trang thư mời không nhúng font hay script bên thứ ba.
10. Link chia sẻ được hiện tiêu đề sự kiện và banner công khai. Không đưa tên khách, email, lời nhắn riêng, RSVP vào Open Graph.
11. Admin tách số liệu API nền tảng, hạn mức công bố và thống kê nội bộ. Không suy quota từ số khách, số file, lượt RSVP, số deploy hoặc dung lượng repo; không thay dữ liệu thiếu bằng số 0.
12. Quyền sửa trực tiếp từ trình duyệt chỉ áp dụng cho các cột được cấp rõ tại mục 5. Mọi ràng buộc của các cột đó phải được cưỡng chế ở database; kiểm tra giao diện/server action đơn thuần không đủ.

Không làm trong v1: quên mật khẩu tự phục vụ, khách tự đăng ký, webhook Brevo, cron, upload album bởi host, iframe bản đồ, số người đi cùng, QR check-in, đa ngôn ngữ. UI tiếng Việt.

---

## 1. TỔNG QUAN DỰ ÁN

* **Tên dự án:** Website Thư Mời Điện Tử Cá Nhân Hóa (E-Invitation).
* **Mô hình triển khai:** **Bespoke Invitation as a Service** (Coder thiết kế mỹ thuật cao cấp theo yêu cầu riêng. Khách hàng vận hành gửi thư và quản lý phản hồi RSVP).
* **Mục tiêu:** Tạo một nền tảng thư mời trực tuyến sang trọng, chạy được trên điện thoại và desktop, gửi thư qua email và theo dõi RSVP kèm lời chúc gần thực.
* **Mục tiêu chi phí vận hành:** **0 VNĐ** khi hệ thống nằm trong hạn mức Free của Netlify, Supabase, Brevo và GitHub.
* **SLA:** Gói Free của Netlify, Supabase và Brevo không có cam kết uptime. Chính sách hạn mức có thể đổi. "0 VNĐ" là mục tiêu cho sự kiện vừa và nhỏ. Nếu cần sẵn sàng cao hoặc quy mô thương mại, nâng gói trả phí là đường vận hành bình thường, không phải lỗi kiến trúc.

---

## 2. PHÂN ĐỊNH VAI TRÒ & QUY TRÌNH NGHIỆP VỤ

### 2.1. Phía Coder (Developer)

* **Template Registry:** Mỗi mẫu có `template_key` (ví dụ `wedding-floral-01`, `luxury-dark`, `client-maihoa-custom`). Next.js nạp đúng component theo key của sự kiện. v1 phải có ít nhất key `wedding-floral-01` trong registry code. Key không có trong registry thì trang thư mời trả lỗi server "Mẫu thiệp chưa được đăng ký", không render trang trắng.
* **Hợp đồng props của template:**
  * Sự kiện: `title`, `event_date`, `timezone`, `banner_url`, `venue_name`, `venue_address`, `google_map_url`.
  * Khách: `guest_name`, `invitation_note` (có thể rỗng).
  * RSVP: trạng thái hiện tại, `guest_message`, hàm gửi phản hồi.
  * Asset tĩnh: file trong `/public/templates/[template_key]/`. Album nằm ở đây, không có bảng gallery.
  * Nhạc không nằm trong HTML ban đầu. Nút phát mới xin signed URL.
* **Ảnh:**
  * Asset trang trí và album của mẫu nằm trong `/public/templates/[template_key]/`. File trong `/public` là công khai với bất kỳ ai có URL trực tiếp.
  * Ảnh thường, không nhạy cảm được để trong `/public`.
  * Ảnh cần riêng tư cao nằm ở bucket private và signed URL hoặc proxy server. v1 không có luồng upload ảnh riêng tư ngoài nhạc.
  * Banner host upload là ảnh công khai có chủ đích, vì cần hiện trên thiệp và preview link.
* **GitHub repo để Private.**
* **Tắt Public Signup trong Supabase Auth Settings** (disable email signups), không chỉ giấu trang `/signup`.
* **Tài khoản:**
  * Developer đầu tiên: tạo auth user, sau đó dùng SQL admin đổi profile của đúng UUID sang developer và SELECT kiểm tra, theo mục 5.2. Trigger luôn ghi `role = 'host'`; user không được tự sửa `profiles`.
  * Host do developer tạo trong `/system-admin` qua Admin API. Mật khẩu hiện một lần. v1 không gửi mật khẩu bằng email.
  * Đổi mật khẩu hoặc cấp lại mật khẩu host: developer làm trên Supabase Dashboard. Không có trang quên mật khẩu.
* **Xóa dữ liệu:** `ON DELETE CASCADE` không xóa file Storage. Mọi lệnh xóa event hoặc host đi qua server action: kiểm tra quyền, xóa object Storage, rồi mới xóa row.
* **Hạ tầng:** Next.js (TypeScript, Tailwind, App Router), Supabase Auth/Postgres/Storage/Realtime, RLS, Brevo API v3, GitHub Private, Netlify. Quản trị vận hành qua `/system-admin`.

### 2.2. Phía Khách hàng (Host)

Host đăng nhập bằng email và mật khẩu tại `/login`, rồi vào `/dashboard`.

Dashboard là danh sách sự kiện của host. Sự kiện hiện tiêu đề, ngày, `template_key` (chỉ đọc) và số RSVP. Không có nút tạo sự kiện. Nếu chưa có sự kiện, hiện: "Chưa có sự kiện. Liên hệ người thiết kế để tạo sự kiện."

Trang một sự kiện: `/dashboard/events/[eventId]`.

1. **Host được sửa:** `title`, `event_date`, `timezone`, nhạc, banner, `venue_name`, `venue_address`, `google_map_url`.
2. **Host không được sửa trực tiếp:** `template_key`, `user_id`, token, đường dẫn file, trạng thái vòng đời sự kiện, các trường điều khiển gửi email, trạng thái RSVP, lời chúc của khách.
3. **Nhạc:** upload `.mp3`, tối đa 10 MiB (10.485.760 byte), MIME `audio/mpeg`. Path cố định `{user_id}/{event_id}/music.mp3`. File mới ghi đè object cũ. Host có quyền SELECT giới hạn ở file thuộc sự kiện của mình để upsert hoạt động; bucket vẫn private với khách. Byte file không đi qua Netlify. Ghi đè không cung cấp lịch sử phiên bản; nếu cần khôi phục nhạc cũ, host phải upload lại.
4. **Địa điểm:** để trống thì ẩn khối bản đồ. Có link thì chỉ hiện liên kết chữ, mở tab mới, `rel="noopener noreferrer"`. Không iframe.
5. **Banner:** tùy chọn. Mặc định lấy asset của template. Nếu upload: JPEG, PNG hoặc WebP, tối đa 2 MiB (2.097.152 byte), path `{user_id}/{event_id}/banner.[ext]`. Chỉ xóa banner khác đuôi sau khi server xác minh object mới và cập nhật thành công đường dẫn trong database. Nếu dọn file lỗi, giữ banner mới và ghi việc dọn còn tồn để developer chạy lại.
6. **Xem trước:** ngay trong trang sự kiện, sau đăng nhập, dùng cùng template component. Không tạo URL preview công khai.
7. **Mời khách:**
   * Email được `trim()` và chuyển thường trước khi lưu.
   * Mỗi sự kiện chỉ một row cho một email, unique index `(event_id, lower(guest_email))`.
   * Email đã có thì không tạo row mới. UI báo rõ và hiện nút "Gửi lại email cho khách này".
   * Nhập tên khách, email, lời nhắn riêng tối đa 500 ký tự, lưu raw text.
   * Email khách chỉ được sửa khi invitation chưa từng có lần gửi. Sau đó, đổi người nhận phải qua action thay người nhận: xác nhận, khóa invitation, sinh token mới, đặt lại RSVP/lời chúc và vô hiệu link cũ. Lịch sử gửi được giữ nguyên. Không cho đổi khi còn lần gửi chưa rõ kết quả; developer phải xử lý trước.
8. **Gửi email:**
   * Nút bị khóa cho đến khi request kết thúc.
   * Gửi lại dùng cùng `token` và cùng row.
   * API Brevo trả thành công chỉ có nghĩa Brevo đã nhận yêu cầu. v1 không có webhook tự cập nhật bounce theo từng khách; số bounce từ báo cáo API được hiển thị riêng đúng phạm vi.
9. **RSVP realtime:** số khách có lần gửi được tiếp nhận, đồng ý, từ chối, chưa phản hồi; tổng lượt gửi lại là chỉ số riêng từ ledger. Danh sách gồm tên, email, `email_status`, trạng thái RSVP, lời chúc, thời gian gửi, thời gian phản hồi. Client subscribe bằng JWT của host và lọc `event_id`, không nghe toàn bộ bảng.

### 2.3. Phía người được mời (Guest)

* Không có tài khoản.
* Email có nút "Xem Thư Mời".
* Trang `/invite/[token]`:
  * Token 32 byte từ CSPRNG, hex, đúng 64 ký tự. Không `expires_at`.
  * Token không đủ 64 ký tự hex thì không cần hỏi database, nhưng vẫn trả cùng một 404 với token không tồn tại: "Thư mời không tồn tại hoặc đã bị gỡ."
  * `<meta name="robots" content="noindex, nofollow" />`.
  * `Cache-Control: private, no-store, no-cache, must-revalidate`.
  * `Referrer-Policy: no-referrer`.
  * Không font CDN, không script bên thứ ba, không iframe bản đồ.
* Màn chào có nút "Mở Thư Mời". Chạm nút mở thiệp và xin signed URL nhạc, thời hạn 60 phút. Không nhúng URL vào HTML ban đầu. Trình duyệt có thể chặn phát sau thao tác bất đồng bộ; nếu `play()` bị từ chối thì hiện nút Play để khách chạm lại. Không chặn việc đọc thiệp hoặc RSVP vì lỗi nhạc.
* RSVP: "Tôi sẽ tham gia" hoặc "Tôi không thể tham gia", lời chúc tối đa 1.000 ký tự. Được đổi phản hồi. Mỗi lần đổi ghi `responded_at = now()`.
* Trang có hiện `guest_name` và `invitation_note` nếu lời nhắn không rỗng.

### 2.4. Route

| Route | Ai vào | Ghi chú |
| :--- | :--- | :--- |
| `/login` | Công khai | Email + mật khẩu. Không có đăng ký, không có quên mật khẩu. |
| `/dashboard` | Host đã đăng nhập | Danh sách sự kiện. |
| `/dashboard/events/[eventId]` | Host sở hữu sự kiện | Cấu hình, xem trước, khách mời, gửi thư. |
| `/invite/[token]` | Người có link | Không đăng nhập. |
| `/system-admin` | `role = developer` | Host bị chuyển về `/dashboard`. Khách chưa đăng nhập về `/login`. |

Kiểm tra quyền ở server cho từng action/route handler, kể cả khi trang đã được bảo vệ bằng middleware/layout. Xác thực session bằng phương thức kiểm chứng của Supabase Auth; không chỉ tin dữ liệu cookie do client gửi. Action dùng cookie phải kiểm tra Origin/CSRF phù hợp. Route RSVP và xin nhạc dùng POST, xác minh token và không nhận `event_id`/`user_id` làm bằng chứng quyền.

### 2.5. Email

* Người gửi: `BREVO_SENDER_NAME <BREVO_SENDER_EMAIL>`, lấy từ biến môi trường. Không hardcode địa chỉ cá nhân trong repo.
* Tiêu đề: `Thư mời: {event_title}`.
* Biến được HTML-escape khi chèn vào HTML: `guest_name`, `event_title`, ngày giờ đã format theo `timezone` của sự kiện và locale `vi-VN`, `venue_name`, `invitation_note`, URL thư mời.
* Nút dẫn tới `{SITE_URL}/invite/{token}`. `SITE_URL` là biến server, không có tiền tố `NEXT_PUBLIC_` nếu không cần lộ thêm. Không ghép URL từ header request.
* Gửi lại không tạo token mới.

Luồng gửi (mỗi request chỉ gửi cho một người nhận):

```text
1. Xác thực host, kiểm tra sự kiện thuộc host và đang active.
2. Tạo/tìm invitation theo unique email; xung đột đồng thời phải lấy lại row cũ.
3. Trong một transaction: khóa bộ đếm ngày, rồi khóa invitation;
   kiểm tra request_id đã có, lần gửi đang xử lý và last_send_attempt_at;
   giữ một suất gửi nội bộ và tạo email_send_attempts trước khi gọi Brevo.
4. Commit transaction. Chỉ tiến trình thắng khóa được gọi Brevo.
5. Gửi request với khóa chống trùng ổn định của attempt và payload đã chốt.
6. Phản hồi Brevo xác nhận tiếp nhận: lưu messageId, accepted_at;
   cập nhật invitation.email_status = sent và sent_at.
7. Bị từ chối chắc chắn: attempt = rejected, invitation = failed.
8. Timeout, mất kết nối hoặc server dừng sau khi bắt đầu gọi:
   attempt/invitation = unknown, không tự kết luận failed và gửi lại.
```

Quy tắc bắt buộc:

* `request_id` là UUID tạo cho một thao tác gửi chủ động; retry HTTP của thao tác đó dùng lại cùng ID. Bấm gửi lại có chủ đích sau khi lần cũ đã kết thúc mới tạo ID mới. Unique `(actor_id, request_id)` bảo đảm xử lý lặp trả về kết quả cũ.
* `last_send_attempt_at` được ghi khi giữ suất, áp dụng khoảng cách 60 giây cả khi gửi thất bại. `sent_at` chỉ là thời điểm tiếp nhận gần nhất, không dùng đếm tổng lượt gửi.
* Chính sách ứng dụng mặc định giới hạn 300 lần gửi chủ động được giữ suất/ngày `Asia/Ho_Chi_Minh`. Suất đã giữ không được trả lại trong ngày, kể cả rejected/unknown, để tránh vượt trần khi lỗi hoặc xóa dữ liệu. Đây là giới hạn nội bộ thận trọng, không phải số email Brevo đã gửi hoặc quota còn lại.
* Thống kê được Brevo tiếp nhận đếm từng attempt có bằng chứng tiếp nhận, theo `accepted_at`; số chưa rõ kết quả hiển thị riêng. Xóa host/event không được làm giảm bộ đếm ngày hoặc xóa bằng chứng đếm của ngày hiện tại.
* `reserved` hoặc `sending` quá 2 phút được chuyển sang `unknown` khi mở dashboard hoặc gọi action đối soát; invitation tương ứng cũng thành unknown. Không có cron; việc chuyển trạng thái không tự tạo request gửi mới. Callback/kết quả đến muộn chỉ được cập nhật đúng attempt, không ghi đè kết quả của attempt mới hơn.
* v1 không tự retry request gửi có kết quả không rõ. Developer kiểm tra log Brevo theo messageId nếu có, người nhận và thời gian; chỉ kết luận tiếp nhận/từ chối khi có bằng chứng. Nếu không thể xác minh, giữ `unknown`; action "Cho phép gửi lại dù có thể trùng" cần xác nhận riêng và lưu người quyết định, thời điểm, lý do. Lần mới vẫn phải qua giới hạn nội bộ.
* Khóa chống trùng không bảo đảm exactly-once vô thời hạn. Tài liệu Brevo về batch dùng `headers.idempotencyKey`, trong khi API reference có ví dụ `Idempotency-Key`. Khi viết adapter phải kiểm thử đúng payload/endpoint sử dụng và lưu hợp đồng đã xác minh; không mặc định hai cách viết có cùng tác dụng. Không dựa vào khóa này để tự retry khi chưa xác minh hỗ trợ.
* Báo cáo SMTP, tín dụng trong `/account` và hạn mức gửi là các khái niệm khác nhau. Chỉ chặn theo quota nền tảng khi API trả trường đã xác minh đúng ngữ nghĩa; không lấy `300 - COUNT(invitations)` hoặc `300 - requests` làm số còn lại. Phản hồi hết hạn mức từ Brevo phải dừng gửi và hướng dẫn kiểm tra dashboard. Giới hạn nội bộ không bảo đảm Brevo không xếp hàng khi tài khoản còn được dùng bởi ứng dụng khác hoặc lệch chu kỳ reset.

---

## 3. CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ | Mục đích |
| :--- | :--- | :--- |
| Frontend | Next.js App Router, bản stable còn được hỗ trợ tại lúc triển khai | Khóa phiên bản cụ thể trong package/lockfile, kiểm tra tương thích runtime Netlify; không coi `14+` là yêu cầu phiên bản đủ an toàn. |
| Ngôn ngữ | TypeScript | Chặn lỗi kiểu. |
| Styling | Tailwind CSS | Responsive. Font trang thư mời tự host. |
| Database và Realtime | Supabase PostgreSQL và Realtime | Dữ liệu quan hệ, subscribe RSVP, RLS. |
| Auth | Supabase Auth | Host và developer. Tắt public signup. |
| Storage | Supabase Storage | Bucket `audio` private. Bucket `banners` public read. |
| Email | Brevo API v3 | Email giao dịch. |
| Hosting | Netlify + GitHub Private | CI/CD, HTTPS. |

Deploy Next.js bằng runtime Netlify đang hỗ trợ cho App Router. Không giả định Netlify nhận body upload 10 MB.

Biến môi trường đặt theo môi trường local/staging/production, không commit giá trị; chỉ commit `.env.example` chứa tên biến. Production đặt trong cấu hình Netlify:

| Biến | Phía |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Được lộ cho trình duyệt. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Được lộ cho trình duyệt. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chỉ server. |
| `BREVO_API_KEY` | Chỉ server. |
| `BREVO_SENDER_EMAIL` | Chỉ server. |
| `BREVO_SENDER_NAME` | Chỉ server. |
| `SITE_URL` | Chỉ server. Không có dấu `/` cuối. |

Giám sát dùng thêm `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_ORG_SLUG` ở server để gọi các endpoint chỉ đọc tại mục 7. Chọn quyền tối thiểu theo endpoint; token này khác service-role key. Chỉ cấp quyền đọc analytics/entitlements cần dùng, không cấp quyền sửa/xóa dự án. Thiếu token phải hiện "Chưa kết nối", không tạo số giả.

Các liên kết dashboard của đúng tài khoản/team/org/project được cấu hình phía server và kiểm tra domain chính thức. Netlify quota v1 dùng dashboard đối chiếu, không cần tạo token Netlify chỉ để dựng số quota. GitHub v1 dùng làm repo nguồn, không bắt buộc GitHub Actions/Packages/LFS.

---

## 4. HẠN MỨC FREE VÀ CÁCH VẬN HÀNH

### 4.1. Điểm nghẽn

Các giá trị dưới đây là tham chiếu từ nguồn chính thức đã đọc ngày 24/09/2026, không phải số đo tài khoản của dự án. Trước khi chạy production phải xác nhận gói thực tế và chu kỳ trong dashboard. Mục 7 quy định cách hiển thị.

1. **Netlify Free theo credit, 300 credit/tháng, hard limit:**
   * Tài khoản legacy có thể dùng cơ chế khác. Không tự gán mọi tài khoản Free vào gói credit.
   * Production deploy: 15 credit/lần. Deploy Preview và branch deploy: 0 credit deploy. Bản deploy lỗi không tốn credit.
   * Compute: 10 credit/GB-giờ. Bandwidth: 20 credit/GB. Web request: 2 credit/10.000 request.
   * Hết 300 credit thì các site trong tài khoản có thể bị pause đến chu kỳ sau.
   * Nhiều site trên cùng tài khoản không tách quota.
   * Function đồng bộ: trần payload buffered 6 MB, không nâng được. File nhị phân bị base64 nên trần thực tế khoảng 4.5 MB. Vì vậy nhạc 10 MB và banner không được upload qua Function.
   * Ảnh trong `/public` giảm egress Supabase nhưng vẫn tốn credit bandwidth và request của Netlify.
2. **Supabase Free:**
   * Tham chiếu Free: 500 MB database/project, 1 GB Storage, 50.000 MAU, 2 triệu Realtime message/tháng; 200 kết nối Realtime đồng thời. Hạn mức theo tổ chức và theo project phải được phân biệt theo từng chỉ số trong dashboard; không nhân quota tổ chức với số project.
   * Egress gồm hai quota tách nhau: 5 GB uncached và 5 GB cached. Không phải một cục 5 GB dùng chung, cũng không phải vô hạn phía CDN.
   * Trần file của gói/cấu hình phải được kiểm tra trước deploy. Ứng dụng giới hạn chặt hơn: nhạc 10 MiB, banner 2 MiB theo số byte mục 5.3.
   * Egress dễ đầy trước database vì nhạc và ảnh. Nén MP3 khoảng 128 kbps. Ảnh template dùng WebP.
   * Project Free có thể pause khi không hoạt động. Developer kiểm tra trạng thái và quy trình Resume/restore hiện hành trong dashboard trước sự kiện; không coi Free là cam kết lưu trữ và khôi phục vô thời hạn.
3. **Brevo Free:**
   * Tối đa 300 email/ngày cho cả tài khoản, dùng chung mọi sự kiện, không phải 300 email/host. Email không dùng không cộng sang ngày sau.
   * Transactional vượt hạn mức có thể vào hàng đợi của Brevo. v1 không dựa vào hàng đợi này. Dừng gửi theo giới hạn nội bộ tại mục 2.5 và phản hồi thật từ Brevo; không tuyên bố bộ đếm nội bộ phản ánh quota tài khoản.
   * Tối đa 100.000 contact.
   * Mọi email gói Free luôn có nhãn "Sent with Brevo". Xác thực domain riêng không gỡ nhãn. Muốn gỡ phải lên Starter kèm add-on, hoặc Standard trở lên.
   * Domain riêng và SPF, DKIM, DMARC vẫn nên làm để thư vào inbox. Đó là việc vận hành DNS, không phải tính năng code của v1, và không biến gói Free thành email không nhãn.
4. **Giám sát cuối:** `/system-admin` chết theo nếu Netlify hoặc Supabase pause. Email cảnh báo và dashboard của nhà cung cấp là nguồn cuối.

---

## 5. CƠ SỞ DỮ LIỆU, PHÂN QUYỀN VÀ STORAGE

Phần này là hợp đồng dữ liệu đích của v1.2. Các đoạn SQL khởi tạo/migration rời rạc của v1.1 được thay bằng hợp đồng thống nhất dưới đây; không copy SQL của bản cũ để nâng database production. Khi triển khai phải viết migration có phiên bản, kiểm tra schema nguồn và chạy các ca nghiệm thu ở mục 9. Bản đặc tả không thay thế migration đã kiểm thử.

### 5.1. Bảng nghiệp vụ

Các cột id của bảng nghiệp vụ dùng UUID, mặc định `gen_random_uuid()`, trừ profiles.id lấy từ auth user; bảng có khóa ngày/khóa ghép dùng đúng khóa được ghi riêng. Thời gian dùng `TIMESTAMPTZ`; `created_at`/`updated_at` NOT NULL, mặc định `now()`; trigger server tự cập nhật `updated_at`. Trường ghi “tùy chọn” và mọi FK ON DELETE SET NULL phải cho phép NULL; các trường còn lại NOT NULL trừ khi mô tả khác.

| Bảng | Cột và ràng buộc |
| :--- | :--- |
| `profiles` | `id` PK/FK tới `auth.users`, ON DELETE CASCADE; `role` chỉ `host/developer`, mặc định host; `lifecycle_status` chỉ `active/deleting`, mặc định active; created_at, updated_at. |
| `events` | `id` PK; `user_id` FK auth.users, ON DELETE CASCADE; `title` VARCHAR(255), không trống sau trim; `template_key` VARCHAR(50); `event_date` TIMESTAMPTZ; `timezone` VARCHAR(100), mặc định Asia/Ho_Chi_Minh; `banner_path` và `music_path` TEXT tùy chọn; `venue_name` VARCHAR(255), `venue_address` TEXT tối đa 2.000 ký tự, `google_map_url` TEXT tối đa 2.048 ký tự, đều tùy chọn; `lifecycle_status` active/deleting, mặc định active; created_at, updated_at. |
| `invitations` | `id` PK; `event_id` FK events, ON DELETE CASCADE; `guest_name` VARCHAR(255), dài 1–255 sau trim; `guest_email` VARCHAR(255), trim/lowercase và hợp lệ; `invitation_note` TEXT tùy chọn ≤500; `token` VARCHAR(64), unique, CHECK đúng 64 ký tự hex thường; `status` pending/accepted/declined, mặc định pending; `guest_message` TEXT tùy chọn ≤1.000; `responded_at` tùy chọn; `email_status` pending/sending/sent/failed/unknown, mặc định pending; `sent_at` và `last_send_attempt_at` tùy chọn; `current_send_attempt_id` UUID tùy chọn; các cột cửa sổ rate limit phía dưới; created_at, updated_at. |
| `email_send_attempts` | `id` PK; `invitation_id` UUID FK invitations, ON DELETE SET NULL; `actor_id` UUID FK auth.users, ON DELETE SET NULL; `request_id` UUID; `idempotency_key` UUID unique; `status` reserved/sending/accepted/rejected/unknown; `budget_date` DATE; `started_at`, `accepted_at`, `finished_at`, `resolved_at` tùy chọn; `provider_message_id` TEXT tùy chọn; `error_code` TEXT đã loại thông tin nhạy cảm; `payload_snapshot` JSONB chứa payload bất biến trong thời gian xử lý; `resolution` TEXT tùy chọn; `resolved_by` UUID FK auth.users ON DELETE SET NULL; created_at, updated_at. |
| `email_daily_counters` | `budget_date` DATE PK theo ngày Việt Nam; `reserved_attempts` INTEGER mặc định 0, CHECK từ 0 đến 300; updated_at. Không FK tới host/event để xóa nghiệp vụ không làm giảm bộ đếm. |
| `maintenance_jobs` | `id` PK; `kind` delete_event/delete_host/cleanup_assets; `target_id` UUID không FK cascade; `object_prefixes` JSONB chỉ chứa bucket/path cần dọn; `status` pending/running/failed/completed; `last_error_code` tùy chọn; `created_by` UUID FK auth.users ON DELETE SET NULL; created_at, updated_at. Không lưu mật khẩu, token thư mời hoặc API key. |

`current_send_attempt_id` FK tới email_send_attempts, ON DELETE SET NULL. Do FK vòng, migration tạo cả hai bảng trước rồi thêm FK. Mỗi invitation có tối đa một attempt chưa được giải quyết: partial unique index trên invitation_id khi status thuộc reserved/sending/unknown và resolved_at IS NULL. Accepted/rejected kết thúc attempt và có resolved_at. Action cho phép gửi lại dù có thể trùng đặt resolved_at/resolved_by/resolution nhưng giữ status unknown của attempt cũ; UI vẫn thể hiện đó là kết quả chưa xác minh.

Thêm `invitations.has_send_history BOOLEAN NOT NULL DEFAULT false`, chỉ server được chuyển false → true khi tạo attempt và không đặt lại khi dọn ledger. Cờ này ngăn sửa email trực tiếp sau khi lịch sử chi tiết hết thời hạn lưu. `payload_snapshot` được NULL sau khi dọn theo chính sách, nhưng bắt buộc có trước khi bắt đầu gọi Brevo. `maintenance_jobs.last_error_code` và `email_send_attempts.error_code` được NULL nếu không có lỗi.

Index bắt buộc: `events(user_id)`; `invitations(event_id)`; unique `invitations(event_id, lower(guest_email))`; unique token; unique `email_send_attempts(actor_id, request_id)`; index attempt theo invitation_id, accepted_at và budget_date. Khi xóa actor, request cũ không còn có thể được replay bởi tài khoản đó.

Các cột rate limit của invitations:

- `rsvp_window_started_at` và `audio_window_started_at`: TIMESTAMPTZ tùy chọn.
- `rsvp_updates_in_window` và `audio_requests_in_window`: INTEGER NOT NULL DEFAULT 0, CHECK ≥0.
- Đếm và cập nhật nghiệp vụ trong cùng transaction/UPDATE có điều kiện; thời gian lấy từ database.

`music_path`/`banner_path` chỉ lưu object path của bucket tương ứng, không lưu URL tùy ý hoặc signed URL. Server tự suy ra path từ user_id/event_id và đuôi đã kiểm tra. Props `banner_url` là URL public do server tạo từ banner_path hoặc asset template, không phải cột cho host tự ghi.

### 5.2. Auth, RLS và quyền ghi

1. Trigger tạo profile sau khi tạo auth user luôn ghi role host, bỏ qua role do user metadata khai báo. Dùng SECURITY DEFINER với search_path rỗng và tên bảng đầy đủ. Bootstrap developer đầu tiên bằng SQL admin, sau đó đọc lại profile để kiểm tra.
2. Tắt public signup ở Supabase Auth. Khi tạo host qua Admin API, developer xác nhận email chủ động và cấu hình tài khoản đăng nhập được ngay; mật khẩu hiện một lần, không lưu vào bảng nghiệp vụ/log.
3. Bật RLS trên toàn bộ bảng ứng dụng. Thu hồi quyền mặc định trước khi cấp lại; rà cả quyền cấp cho PUBLIC và quyền từng cột từ bản cũ.
4. `anon` không có SELECT/INSERT/UPDATE/DELETE trên bảng ứng dụng. Guest chỉ dùng route server xác minh token.
5. `authenticated` được SELECT profile của mình; SELECT events/invitations thuộc host đang active. Developer được SELECT events/invitations toàn hệ thống để hỗ trợ, còn danh sách tài khoản quản trị đi qua action kiểm tra role.
6. Host chỉ được UPDATE trực tiếp các cột events: title, event_date, timezone, venue_name, venue_address, google_map_url. RLS kiểm tra sở hữu cả USING/WITH CHECK và trạng thái host/event active.
7. Host chỉ được UPDATE trực tiếp guest_name, guest_email, invitation_note của invitation thuộc mình. Trigger từ chối sửa guest_email khi has_send_history = true. Khi đang gửi hoặc còn unknown chưa giải quyết, từ chối sửa cả ba trường để payload đang gửi không lệch dữ liệu.
8. Trigger database cưỡng chế trim/lowercase, độ dài, email, timezone IANA hợp lệ và allowlist Google Maps ở mục 6. Trigger chống sửa các cột ngoài whitelist cho authenticated. Không chỉ dựa vào kiểm tra ở giao diện.
9. Không cấp INSERT/DELETE events/invitations hoặc UPDATE profile cho authenticated. Không cấp quyền bảng/Realtime cho client đối với email_send_attempts, email_daily_counters, maintenance_jobs và các bảng giám sát mục 7. Host chỉ nhận projection lịch sử gửi đã lọc qua server.
10. Service role chỉ ở server, dùng cho action admin; tạo thư mời/thay người nhận; gửi/đối soát email; RSVP/nhạc theo token; xác nhận file; xóa/dọn dữ liệu; cache giám sát. Mỗi entry point kiểm tra quyền trước khi dùng client đặc quyền; lấy actor_id từ session đã xác thực, không từ body.
11. RPC đặc quyền cho giữ suất email, chuyển trạng thái attempt, RSVP/rate limit và maintenance chỉ cấp EXECUTE cho service_role; REVOKE EXECUTE khỏi PUBLIC, anon, authenticated. SECURITY DEFINER nếu cần phải đặt search_path rỗng, schema đầy đủ và không có SQL động từ input.
12. Chỉ publish invitations cho Realtime. Host subscribe với JWT và event_id; RLS vẫn là lớp phân quyền. Khi reconnect, tải lại snapshot để bù sự kiện bị bỏ lỡ. Guest không subscribe database.

Khóa gửi email theo thứ tự thống nhất: bộ đếm ngày → invitation → attempt. Transaction tạo counter bằng INSERT ON CONFLICT, SELECT FOR UPDATE counter, khóa invitation, kiểm tra replay request_id trước khi từ chối vì trần/cooldown, rồi mới tăng counter và giữ suất cho request mới. Không giữ transaction/database lock trong lúc gọi HTTP Brevo. Trạng thái attempt được cập nhật bằng compare-and-set reserved → sending trước HTTP; chỉ tiến trình chuyển được trạng thái mới được gửi. Ghi kết quả attempt và projection invitation trong cùng transaction, chỉ cập nhật projection khi current_send_attempt_id còn đúng.

Action thay người nhận phải khóa invitation cùng cách với luồng gửi, kiểm tra unique email mới, đặt email_status pending, sent_at/current_send_attempt_id NULL và reset status/guest_message/responded_at. Giữ has_send_history và last_send_attempt_at để không bỏ qua chính sách đã gửi/cooldown. Thu hồi token thuần túy chỉ đổi token; không tự xóa RSVP nếu không thay người nhận.

### 5.3. Storage và xác nhận file

| Bucket | Public | Giới hạn từng file | MIME |
| :--- | :--- | :--- | :--- |
| audio | Không | 10.485.760 byte | audio/mpeg |
| banners | Có, tải ảnh bằng URL public | 2.097.152 byte | image/jpeg, image/png, image/webp |

Không tắt RLS storage.objects. Mỗi policy của host phải đồng thời kiểm tra:

- Đúng bucket và path đầy đủ: `{auth.uid()}/{event_id}/music.mp3` hoặc `{auth.uid()}/{event_id}/banner.(jpg|jpeg|png|webp)`; không chấp nhận thư mục tùy ý.
- Event tồn tại, user_id = auth.uid(), event và profile đều active.
- Policy UPDATE có cả USING và WITH CHECK để không đổi path sang event/bucket khác.
- Cấp SELECT, INSERT, UPDATE, DELETE cho đúng object thuộc host, phục vụ upsert và dọn file. Không cấp SELECT audio cho anon. Không cần policy SELECT public liệt kê banners: public bucket đã phục vụ ảnh qua URL; danh sách object vẫn giới hạn theo host.

Supabase yêu cầu SELECT và UPDATE khi upsert object đã tồn tại; nguồn S9 ở mục 10. Private nghĩa là khách cần signed URL, không có nghĩa chủ sở hữu cũng bị cấm đọc.

Luồng upload:

1. Server kiểm tra session, sở hữu và lifecycle; trả path do server tính.
2. Trình duyệt upload trực tiếp bằng JWT host; Supabase kiểm tra policy, MIME và số byte. Client có timeout/hủy upload và báo lỗi rõ.
3. Server xác nhận lại sở hữu, lifecycle, path và object metadata bằng quyền server; không tin URL/path tùy ý trong body. Sau đó cập nhật music_path/banner_path.
4. Nếu bước 3 lỗi, UI báo “Đã upload, chưa xác nhận”; action thử xác nhận lại cùng path, không tạo file ngoài quy ước. Thiệp tiếp tục dùng đường dẫn đã lưu. Riêng ghi đè cùng path có thể đã thay byte cũ; v1 không bảo đảm rollback nội dung file.
5. Banner khác đuôi chỉ dọn sau khi đường dẫn mới đã commit. Dọn thất bại ghi maintenance_jobs để thử lại khi developer thao tác. Cache ảnh dùng phiên bản updated_at trong URL hiển thị và kiểm tra thực tế sau thay ảnh; không hứa CDN cập nhật tức thì.
6. Trước khi ký nhạc, server dựng path dự kiến từ event, đối chiếu music_path và object tồn tại. Không ký path của event/host khác dù dữ liệu cũ bị sai.

### 5.4. Xóa và xử lý dang dở

Developer xác nhận tên sự kiện/host trước khi xóa. Không cho tự xóa tài khoản developer đang dùng hoặc xóa developer cuối cùng bằng chức năng xóa host.

1. Transaction đặt lifecycle_status = deleting và tạo maintenance_job trước khi xóa file. Host bị chặn cập nhật/upload/gửi thư mới; guest nhận cùng trang thư mời không còn khả dụng.
2. Đợi/đối soát attempt đang gửi; không giả định xóa dữ liệu sẽ hủy email đã được Brevo tiếp nhận. Việc xóa không rollback email.
3. Dùng Storage API liệt kê có phân trang và xóa toàn bộ prefix được lưu trong job ở cả hai bucket. Không DELETE trực tiếp storage.objects để thay cho xóa object.
4. Chỉ xóa row event hoặc auth user sau khi dọn thành công. Nếu lỗi, giữ trạng thái deleting và job failed; nút “Thử lại” tiếp tục cùng job, xử lý object đã vắng mặt như thành công.
5. Upload đang bay có thể hoàn tất sau lần dọn đầu vì Storage và Postgres không chung transaction. Job giữ prefix để quét lại sau khi row đã xóa; chỉ đánh completed sau lần kiểm tra lại. Trang maintenance có action quét prefix của job cũ để xử lý file đến muộn, không cần cron.
6. Trước xóa host/event, xóa payload_snapshot chứa dữ liệu cá nhân; giữ attempt tối thiểu và counter để thống kê ngày không bị giảm. FK SET NULL tách lịch sử tối thiểu khỏi dữ liệu đã xóa.

### 5.5. Migration từ bản cũ

Có hai migration riêng: khởi tạo database trống và nâng schema đang tồn tại. Không dùng CREATE TABLE nguyên khối cho database đã có dữ liệu.

Migration nâng cấp phải:

1. Sao lưu và kiểm tra schema/policy/grant/trigger/publication hiện tại; xác định phiên bản thực tế, không suy từ tên file spec.
2. Thêm các bảng/cột mới, enum/check unknown và lifecycle; cập nhật function/trigger bằng CREATE OR REPLACE; tạo lại trigger/policy có kiểm tra tồn tại; thu hồi grant cũ trước khi cấp whitelist mới.
3. Chuyển music_url/banner_url cũ sang object path chỉ khi URL/path khớp bucket, host và event. Signed URL không được giữ làm dữ liệu lâu dài; dữ liệu không chuyển được phải báo cáo để xử lý, không tự trỏ sang tài sản khác.
4. Chuẩn hóa email/tên; phát hiện trùng email sau chuẩn hóa và dữ liệu không hợp lệ trước khi thêm unique/check. Không tự xóa khách hoặc gộp RSVP để migration chạy qua.
5. Không tái dựng lịch sử gửi đầy đủ từ sent_at vì dữ liệu đó không tồn tại. Đánh dấu mốc bắt đầu thống kê chính xác; số trước mốc là “Không có lịch sử đầy đủ”. Khi chuyển giữa ngày, khóa gửi phần còn lại của ngày Việt Nam bằng counter 300 nếu không có chứng cứ đầy đủ để khởi tạo.
6. Invitation sending cũ chuyển unknown để developer đối soát. Invitation có sent_at cũ hoặc dấu vết đã thử gửi phải đặt has_send_history = true; không tạo giả một attempt được Brevo xác nhận. Trường hợp không xác định được lịch sử thì khóa sửa email trực tiếp bằng cờ này và dùng action thay người nhận khi cần.
7. Giữ nguyên token hợp lệ và link đang dùng; không xoay token hàng loạt. Cập nhật publication có kiểm tra membership trước khi ADD TABLE.
8. Chạy migration trên bản sao dữ liệu, kiểm tra phân quyền sau migration và kế hoạch khôi phục. Migration tracker đảm bảo bản đã áp dụng không chạy lại; không gọi việc chạy lại một script CREATE POLICY là idempotent.


---

## 6. VALIDATION, RATE LIMIT, PREVIEW LINK

* Secret chỉ ở biến môi trường server tương ứng local/staging/production. Không `NEXT_PUBLIC_` cho service role, Management token hay Brevo. Không commit.
* Lưu raw text đã validate. Không escape trước khi insert.
* React escape khi render JSX. Cấm `dangerouslySetInnerHTML` với dữ liệu người dùng.
* Chỉ HTML-escape khi chèn chuỗi vào HTML email.
* Email: trim, lowercase, định dạng email. Tên khách 1 đến 255 ký tự sau trim.
* `invitation_note` tối đa 500. `guest_message` tối đa 1.000.
* Google Maps: chỉ `https`, không userinfo, không port ngoài 443. Host chính xác: `maps.google.com`, `maps.app.goo.gl`, hoặc `google.com`/`www.google.com` khi pathname là `/maps` hay bắt đầu `/maps/`. Không kiểm tra bằng chuỗi chứa domain; từ chối `google.com.evil.example`, `google.com@evil.example` và `/maps-evil`. Link sai từ chối lưu. Server và database phải cưỡng chế cùng allowlist cho quyền UPDATE trực tiếp; không fetch URL khách cung cấp.
* Tiêu đề 1–255 ký tự sau trim; timezone phải là tên IANA được hỗ trợ. Thời gian nhập theo timezone của sự kiện rồi chuyển UTC để lưu, tránh phụ thuộc timezone máy host. Chuỗi tùy chọn rỗng chuẩn hóa NULL; độ dài tính theo ký tự Unicode nhất quán với PostgreSQL char_length.
* MP3: MIME `audio/mpeg`, đuôi `.mp3`, tối đa 10.485.760 byte, path đúng mục 5.3.
* Banner: `image/jpeg`, `image/png`, `image/webp`, tối đa 2.097.152 byte, path đúng mục 5.3.
* Trang `/invite/[token]`, `/dashboard`, `/system-admin`: noindex, no-store, `Referrer-Policy: no-referrer`.
* Không có endpoint công khai trả toàn bộ danh sách khách.

Rate limit đếm trên row `invitations` hoặc bằng câu SQL. Không đếm trong bộ nhớ process. Không thêm Redis ở v1.

| Việc | Trần | Cách đếm |
| :--- | :--- | :--- |
| Gửi hoặc gửi lại một thư | 1 lần chủ động / 60 giây | `last_send_attempt_at`, request_id và khóa attempt chưa giải quyết; tính cả lỗi gửi. |
| Giữ suất gửi toàn ứng dụng | 300 lần chủ động / ngày Việt Nam | email_daily_counters cập nhật nguyên tử; giữ lịch sử email_send_attempts. Đây là giới hạn nội bộ, không phải quota Brevo. |
| Đổi RSVP | 20 lần / token / 60 phút | `rsvp_window_started_at`, `rsvp_updates_in_window` |
| Xin signed URL nhạc | 30 lần / token / 60 phút | `audio_window_started_at`, `audio_requests_in_window` |

Cửa sổ RSVP và nhạc: dùng giờ database; nếu trống hoặc đã qua ít nhất 60 phút thì đặt lại mốc và đếm bằng 1. Nếu chưa hết hạn và đã chạm trần thì trả 429 kèm Retry-After, không ghi RSVP và không tạo URL. Kiểm tra/tăng bộ đếm phải cùng transaction hoặc UPDATE có điều kiện. RSVP ghi cùng transaction; signed URL chỉ tạo sau khi giữ lượt thành công. Lỗi tạo URL vẫn giữ lượt để không bị retry vô hạn.

Open Graph của `/invite/[token]`:

* `og:title` = tiêu đề sự kiện.
* `og:description` = "Thư mời tham dự". Không có tên khách hay lời nhắn riêng.
* `og:image` = banner công khai, hoặc ảnh mặc định của template nếu host chưa upload.
* Không đưa email, RSVP, lời chúc vào meta.

Hệ quả đã chấp nhận: Zalo hoặc Facebook có thể hiện tiêu đề và banner. Danh tính khách không nằm trong preview.

---

## 7. SYSTEM ADMIN VÀ GIÁM SÁT TÀI NGUYÊN THẬT

Route `/system-admin` chỉ dành cho developer; từng action kiểm tra role ở server. Host chuyển về /dashboard, người chưa đăng nhập về /login. Mục tiêu là theo dõi đúng dữ liệu nền tảng cung cấp, không dựng một bảng quota có vẻ đầy đủ bằng số ước lượng.

### 7.1. Quản trị nghiệp vụ

- Tạo host, tạo event, chọn template đã có trong registry, đổi template và xem danh sách khách để hỗ trợ.
- Hiện mật khẩu host một lần; không trả mật khẩu/API key trong API danh sách, logs hoặc cache.
- Xóa host/event qua quy trình mục 5.4; xem và thử lại các maintenance_job lỗi.
- Đối soát email unknown; hiển thị bằng chứng nguồn, người xử lý và thời gian.
- Tổng số host/event/khách và RSVP lấy từ database ứng dụng, đặt trong khối “Hoạt động ứng dụng”. Không gọi những số này là MAU, Realtime message hoặc usage của nền tảng.
- Danh sách có phân trang phía server, mặc định 50 dòng; tìm kiếm/lọc theo host, sự kiện, trạng thái. Không tải toàn bộ khách lên trình duyệt chỉ để tính tổng.

### 7.2. Quy tắc nguồn dữ liệu — bắt buộc

Ba nhóm thông tin phải hiển thị tách biệt:

| Nhóm | Nguồn được chấp nhận | Cách hiển thị |
| :--- | :--- | :--- |
| Số đo nền tảng | API chính thức đã xác minh endpoint, quyền, field, đơn vị và phạm vi | Nhãn “Nguồn: API [nền tảng]”, thời điểm lấy, kỳ đo, tài khoản/team/org/project. |
| Hạn mức công bố | Trang pricing/quota chính thức có URL và ngày kiểm tra | Nhãn “Hạn mức công bố, kiểm tra ngày …”; là thông tin tham khảo riêng, không giả làm quota được đọc trực tiếp của tài khoản. |
| Hoạt động ứng dụng | Bảng nghiệp vụ và ledger của ứng dụng | Nhãn “Nội bộ ứng dụng”; không dùng thay usage/billing của nền tảng. |

**Cấm**: số mẫu trên production, random, dữ liệu seed, dùng missing/null thành 0, nhập tay mức đã dùng rồi ghi “đồng bộ”, lấy số invitation suy ra email còn lại, lấy file size suy egress, lấy lượt RSVP suy Realtime message, lấy số auth user suy MAU, lấy số deploy nhân đơn giá suy tổng credit thực tế.

Chỉ hiện thanh `đã dùng / hạn mức` và phần trăm nếu hai giá trị đều có nguồn API chính thức, cùng loại metric, cùng đơn vị, phạm vi và kỳ đo; mẫu số >0. Nếu API chỉ cho giá trị còn lại thì hiện riêng giá trị đó, không suy ngược tổng đã dùng. Không ghép mẫu số tham khảo từ pricing vào một thanh được trình bày như quota tài khoản.

Không tự tính số tài nguyên còn lại trong v1. Nếu nền tảng không trả số đó, hiện “Nền tảng chưa cung cấp số còn lại qua kết nối này”. Tỷ lệ dùng/hạn mức nếu đủ điều kiện chỉ là phép trình bày trên hai số nền tảng, phải giữ được nguồn của cả hai.

Chu kỳ tháng theo nền tảng, không tự reset ngày 1; ngày gửi Brevo không tự coi là ngày Việt Nam. Timezone/kỳ đo không rõ thì hiện “Chưa xác định chu kỳ”, tắt tỷ lệ và cảnh báo quota. Giữ nguyên cached/uncached egress thành hai chỉ số; không cộng thành một “pool còn lại”.

### 7.3. Ma trận kết nối đã đối chiếu

Đối chiếu tài liệu công khai ngày 24/09/2026; chưa phải xác nhận đã kết nối tài khoản thật của dự án.

| Nền tảng / chỉ số | Nguồn và cơ chế v1 | Giới hạn diễn giải |
| :--- | :--- | :--- |
| Netlify: tổng credit, credit còn lại, chu kỳ, phân bổ deploy/compute/bandwidth/request | Team → Usage & billing → Credit usage breakdown và tài liệu S1–S3. V1 cung cấp nút mở dashboard đúng team. Chưa xác minh endpoint quota tương ứng trong OpenAPI đã đọc; trạng thái `dashboard_only`. | Không ghi khẳng định “Netlify không có API” cho mọi thời điểm. Không lấy endpoint nội bộ bắt từ DevTools/cookie, không scrape trang đăng nhập. Không dựng quota từ số deploy. |
| Supabase: database quota, Storage usage, cached/uncached egress, MAU, Realtime message và peak connections | Usage/Billing đúng organization và project; các mục S4–S5. V1 đánh dấu `dashboard_only` cho quota chưa có field API được xác minh. Vẫn phải hiển thị đầy đủ các dòng tài nguyên này và link đối chiếu. | Không nhầm quota tổ chức với project. Không dùng metrics hạ tầng thay số tính phí. |
| Supabase: disk utilization | API chính thức `GET /v1/projects/{ref}/config/disk/util`, các field `metrics.fs_size_bytes`, `fs_avail_bytes`, `fs_used_bytes`, timestamp; nguồn S6. | Đặt trong khối “Hạ tầng database”, không gọi fs_size là quota database Free 500 MB và không gọi fs_used là Storage bucket usage. |
| Supabase: lượt gọi dịch vụ | `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts`; result có timestamp, total_auth_requests, total_realtime_requests, total_rest_requests, total_storage_requests; nguồn S7. | Hiển thị đúng tên “Lượt gọi API”. total_realtime_requests không phải số Realtime message tính phí; total_auth_requests không phải MAU. |
| Supabase: entitlement | `GET /v1/organizations/{slug}/entitlements`; nguồn S8. Đọc feature.key/type, hasAccess và config đúng schema. | Entitlement có thể là quyền bật tính năng boolean, không mặc định là numeric quota. Field không có ngữ nghĩa/đơn vị đã xác minh thì không hiển thị thành hạn mức. |
| Brevo: gói và credits | `GET https://api.brevo.com/v3/account`; đọc plan[].type, creditsType, credits và planVerticals khi có; nguồn S10. | Chọn đúng gói email, không dùng phần SMS/Chat. Nếu chưa xác minh credits là allocation, sendLimit hay remaining cho tài khoản đó, hiện nhãn “Credits API trả về (creditsType: …)” ở phần chi tiết; không gọi là “email còn lại hôm nay”. |
| Brevo: báo cáo SMTP | `GET https://api.brevo.com/v3/smtp/statistics/aggregatedReport` với khoảng ngày rõ ràng; requests, delivered, hardBounces, softBounces, blocked nếu API trả; nguồn S11. | Đây là thống kê transactional theo phạm vi API, không mặc định bao gồm marketing campaign hoặc bằng số quota đã dùng. Không lấy 300 trừ requests/delivered. Bounce tổng hợp không cập nhật trạng thái từng invitation khi chưa đối soát được. |
| GitHub: nguồn code và tài nguyên tính phí nếu dùng | V1 deploy bằng Netlify Git integration, không yêu cầu Actions/Packages/LFS. Hiện link Billing & licensing của chủ repo; nguồn S14. Nếu bật dịch vụ tính phí sau này, bổ sung adapter theo REST API billing được tài liệu hóa của đúng loại tài khoản. | Không khẳng định “GitHub đang dùng 0” chỉ vì ứng dụng không có dữ liệu. Không gán quota Actions cho Netlify build hoặc coi kích thước repo local là số sử dụng billing. |

Các endpoint Supabase dùng base URL `https://api.supabase.com` và token Management. Phải kiểm tra quyền đọc được tài liệu hóa cho từng endpoint (ví dụ analytics_usage_read cho api-counts, infra_disk_config_read cho disk, organization_admin_read cho entitlements). Không tự đổi sang service-role key nếu Management API báo thiếu quyền.

Số liệu disk/api-counts/gói Brevo/báo cáo SMTP có adapter API trong v1. Các dòng quota `dashboard_only` là chức năng theo dõi có giới hạn đã công bố, không phải dashboard realtime đầy đủ. Chỉ đổi sang tự đồng bộ khi có endpoint chính thức, phản hồi thật và test mapping đạt yêu cầu mục 9. Không hứa đồng bộ mọi quota của mọi nền tảng khi nguồn chưa cung cấp đủ.

### 7.4. Hợp đồng của mỗi metric

Mỗi metric trả về từ server có các trường sau; trường không lấy được dùng NULL, không dùng số giả:

| Trường | Ý nghĩa |
| :--- | :--- |
| provider, metric_key, display_name | Nền tảng và định danh ổn định, không đánh đồng các metric khác loại. |
| scope_type, scope_id, environment | account/team/organization/project; đúng ID cấu hình; staging/production được phân biệt. |
| value, unit | Số gốc đã validate; giữ đơn vị byte, request, message, credit theo nguồn. Chuyển đơn vị chỉ để hiển thị và phải ghi MB hay MiB đúng quy đổi. |
| limit, remaining | Chỉ có khi API trả đúng trường đã xác minh; không suy từ pricing hoặc dữ liệu nội bộ. |
| period_start, period_end, period_timezone | Kỳ của nguồn; NULL nếu nguồn không cung cấp. Phân biệt gauge tại thời điểm và số tích lũy trong kỳ. |
| provider_updated_at, fetched_at | Thời điểm nguồn nếu có và thời điểm ứng dụng lấy. Không coi fetched_at là thời điểm nền tảng chốt billing. |
| source_kind, source_url, endpoint, field_path | api/documentation/internal/dashboard; đường dẫn truy nguyên cho giá trị. Không chứa token query, Authorization header hoặc secret. |
| status, last_attempt_at, error_code | Trạng thái đồng bộ, lần thử gần nhất và mã lỗi đã làm sạch. |
| mapping_version, source_checked_at | Phiên bản adapter và ngày kiểm tra ngữ nghĩa tài liệu. |

Registry của adapter định nghĩa endpoint, field mapping, scope, unit, loại số đo, quyền cần cấp và cách xử lý thiếu trường. Không lấy một field “na ná tên” làm fallback. Schema thay đổi thì ngừng hiển thị metric đó, báo `invalid_response` và giữ bản cũ với nhãn dữ liệu cũ.

Trạng thái giao diện:

- `fresh`: lần đọc API thành công còn trong TTL của ứng dụng; không có nghĩa nhà cung cấp cập nhật tức thời.
- `stale`: có snapshot cũ; hiển thị thời điểm thật và cảnh báo chưa đồng bộ.
- `not_connected`: thiếu cấu hình/credential.
- `forbidden`: API trả 401/403; yêu cầu developer kiểm tra credential/quyền.
- `rate_limited`: API 429, tuân thủ Retry-After nếu có.
- `unavailable`: timeout/5xx; không suy ra hệ thống đang hết quota.
- `invalid_response`: sai schema, scope, đơn vị hoặc trường thiếu.
- `dashboard_only`: chưa có mapping API quota được xác minh; nút mở nguồn chính thức.
- `not_applicable`: tính năng không dùng theo cấu hình đã xác nhận, không đồng nghĩa usage tài khoản bằng 0.

Một metric thành công không làm cả nền tảng thành “Đã đồng bộ đầy đủ”. Hiện trạng thái từng dòng và số lượng chỉ số thực sự kết nối được.

### 7.5. Lấy dữ liệu, lưu cache và phân quyền

- Route server đọc metrics chỉ cho developer; không trả raw account payload có email quản trị, SMTP credential hoặc marketingAutomation key. Chỉ trả whitelist field đã chuẩn hóa.
- Registry và URL API do server quản lý theo allowlist; client không được truyền URL để server tùy ý fetch. Dashboard link cũng phải thuộc domain chính thức.
- Không có cron. Mở admin thì đọc snapshot; snapshot quá 5 phút mới gọi nguồn. Nút “Làm mới” được server giới hạn một lần/60 giây theo kết nối, có single-flight để nhiều tab không gọi trùng.
- Có thể tự làm mới mỗi 5 phút khi tab admin đang hiển thị; dừng khi tab ẩn. Timeout mỗi nguồn 10 giây, kết quả nguồn này không chặn nguồn khác; tuân thủ rate limit thực tế nhà cung cấp.
- Dùng bảng `provider_metric_snapshots`: khóa (provider, scope_id, metric_key), payload đã lọc theo mục 7.4, fetched_at và updated_at. Bật RLS, không grant cho anon/authenticated; server developer đọc qua service role. Chỉ giữ snapshot gần nhất, không sao chép toàn bộ response có secret.
- Dùng bảng `provider_sync_state`: khóa (provider, scope_id), last_attempt_at, next_allowed_at, lease_until, lease_token UUID, last_error_code. RPC chỉ service_role lấy lease có điều kiện trước khi gọi API; ghi kết quả phải đúng lease_token để response đến muộn không ghi đè snapshot mới. Lease có hạn và được thu hồi theo thời gian DB, không khóa vĩnh viễn khi function chết.
- Bộ nhớ process chỉ hỗ trợ hiệu năng, không là nguồn khóa duy nhất vì Netlify chạy nhiều instance.
- Không xóa giá trị cũ khi API lỗi rồi thay bằng 0; giữ fetched_at cũ và status stale kèm lỗi lần mới. Không tự đổi fetched_at khi chỉ đọc cache.
- Thông báo “đã dùng cao” chỉ dựa trên tỷ lệ đủ điều kiện mục 7.2. Ngưỡng 80%/95% là chính sách cảnh báo của ứng dụng, phải ghi rõ; không nhận là cảnh báo do nhà cung cấp phát ra. Dữ liệu stale/thiếu scope/thiếu kỳ không được hiện trạng thái xanh “an toàn”.
- V1 không gửi email cảnh báo riêng, không mua thêm credit, không nâng gói, không bật auto-recharge. Theo dõi cảnh báo sẵn có từ nền tảng và dashboard của họ khi ứng dụng không truy cập được.

### 7.6. Điều kiện nghiệm thu trang theo dõi

Developer phải đối chiếu các metric API với dashboard của **đúng tài khoản, đúng kỳ và đúng đơn vị**; lưu bằng chứng đã che thông tin nhạy cảm. Nếu nguồn cập nhật trễ, ghi thời điểm/khoảng trễ quan sát được, không điều chỉnh số cho khớp.

Từng dòng phải có nguồn, trạng thái, thời gian và đường dẫn kiểm chứng. Dòng chưa kết nối là chưa kết nối; trang có các đường dẫn chính thức nhưng chưa có credential thật không được báo “giám sát hoạt động thành công”.

---

## 8. VẬN HÀNH, DỮ LIỆU VÀ TRẢI NGHIỆM

### 8.1. Quy mô và mục tiêu miễn phí

Chưa có số liệu nhu cầu thực tế của chủ dự án để bảo đảm mức 0 VNĐ. Khi triển khai, lập hồ sơ vận hành từ thông tin thật: số host/event, khách mỗi event, lượt mở dự kiến, dung lượng thiệp/album/nhạc và số lần deploy. Không biến con số thử tải thành cam kết sức chứa Free.

Mục tiêu nghiệm thu kỹ thuật ban đầu: phân trang danh sách với 1.000 invitation/event; thử các thao tác đồng thời ở mục 9. Đây là bộ dữ liệu kiểm thử được chọn để đánh giá chức năng, không phải quy mô sử dụng đã được khách xác nhận hoặc quota của nhà cung cấp.

Sử dụng font tự host, ảnh tối ưu, lazy-load album, không tải nhạc trước thao tác mở thiệp. Không dùng Supabase Image Transformation nếu gói thực tế không hỗ trợ; tạo ảnh tối ưu khi chuẩn bị asset.

### 8.2. Giữ và xóa dữ liệu

Mặc định giữ event và RSVP đến khi host yêu cầu hoặc developer xóa; không tự xóa theo ngày sự kiện. Khi bàn giao phải thông báo chính sách này và cách yêu cầu xóa.

Payload gửi email chỉ giữ trong thời gian cần xử lý/đối soát, tối đa 7 ngày nếu attempt đã kết thúc; attempt unknown chưa xử lý phải được developer rà soát. Dọn theo action admin, không giả là tác vụ tự chạy. Không lưu toàn bộ payload/email HTML trong logs.

Attempt tối thiểu và counter giữ 90 ngày để đối soát nội bộ; xóa qua maintenance action sau thời hạn. Việc xóa theo yêu cầu host loại payload chứa dữ liệu cá nhân ngay, giữ số đếm không định danh của ngày hiện tại. Không thu thập IP khách hoặc thống kê mở email ngoài yêu cầu v1.

Token là quyền truy cập: ai có link có thể đọc thiệp và thay RSVP. Có action developer thu hồi/đổi token theo yêu cầu host; thao tác gửi lại bình thường không đổi token. Không đưa token đầy đủ, signed URL, lời nhắn/email vào log hoặc công cụ analytics. Link đã chia sẻ có thể được bên nhận lưu lại; noindex không phải cơ chế xác thực.

### 8.3. Sao lưu và ứng phó sự cố

- Trước migration và trước đợt gửi chính, developer sao lưu database và file Storage theo công cụ/quyền gói hiện có, lưu ở nơi riêng tư. Kiểm tra khôi phục trên môi trường tách biệt; repo Git không phải backup database/Storage.
- Trước sự kiện, mở thử link guest trên điện thoại, đăng nhập host, gửi một email thử có phép, kiểm tra RSVP/nhạc/banner và đọc quota từ dashboard chính thức.
- Khi nền tảng pause/quota đầy: thông báo lỗi rõ, giữ dữ liệu; developer kiểm tra dashboard rồi quyết định resume/chờ/nâng gói. Không tự tạo hoạt động giả để lách chính sách Free.
- Trang admin phụ thuộc hạ tầng ứng dụng, không phải hệ thống giám sát độc lập 24/7. Link dashboard và người chịu trách nhiệm vận hành phải được bàn giao ngoài ứng dụng.
- Có environment staging/production tách cấu hình và dữ liệu; staging gửi email chỉ tới danh sách thử được cho phép, không gửi cho khách thật.

### 8.4. Yêu cầu giao diện tối thiểu

UI tiếng Việt; hoạt động ở chiều rộng 360 px trở lên và desktop. Nút RSVP có loading/success/error, bảo toàn lời chúc khi request lỗi, không báo lưu thành công trước phản hồi server. Nhạc có Play/Pause và trạng thái không có nhạc; URL hết hạn được xin lại trong rate limit.

Các nút có nhãn rõ, thao tác bàn phím được, có trạng thái focus, ảnh nội dung có alt; hiệu ứng tôn trọng prefers-reduced-motion. Trang thiệp không ép nghe nhạc để đọc nội dung.

---

## 9. TIÊU CHÍ NGHIỆM THU BẮT BUỘC

Các ca dưới đây là yêu cầu kiểm thử khi hiện thực hóa, chưa được coi là đã chạy chỉ vì đặc tả đã hoàn thiện.

| Nhóm | Ca kiểm tra và kết quả phải đạt |
| :--- | :--- |
| Phân quyền | Host A gọi REST/RPC/Storage trực tiếp với JWT không đọc/sửa/upload được dữ liệu host B; không tự đổi role/template/token/RSVP/email_status hoặc path file. |
| Validation | Gọi thẳng Supabase với Google Maps ngoài allowlist, timezone không hợp lệ, email sai, chuỗi vượt độ dài hoặc guest_name trống bị từ chối; không chỉ test form. |
| Signup | Signup công khai bị tắt; tài khoản host tạo bởi developer đăng nhập được; mật khẩu không có trong logs/danh sách/cache. |
| Upload | Upload nhạc lần đầu và ghi đè lần hai thành công; file vượt byte/MIME/path sai hoặc event không tồn tại bị chặn; anon không đọc/list audio. |
| Asset | Không ký URL nhạc của event khác; upload thành công nhưng finalize lỗi có thể xác nhận lại; banner mới commit trước khi dọn cũ; lỗi dọn có job thử lại. |
| Gửi trùng | Hai request cùng request_id chỉ tạo một attempt và tối đa một lần gọi API đang thực thi. Hai người bấm đồng thời cùng invitation không vượt khóa. |
| Bộ đếm | Gửi 100 người và gửi lại 100 lần phải có 200 attempt; nếu Brevo xác nhận cả 200 thì accepted count = 200. Xóa event không giảm counter ngày. |
| Đồng thời | Khi counter = 299, 10 request gửi mới đồng thời chỉ một request giữ thêm được suất. Cả lỗi gửi cũng áp dụng cooldown 60 giây. |
| Phục hồi | Dừng server sau reserved/sending, timeout sau khi Brevo có thể đã nhận, hoặc lỗi ghi DB sau 201: không tự gửi lại; hiện unknown để đối soát. Kết quả đến muộn không ghi đè attempt mới. |
| RSVP/nhạc | 21 request RSVP và 31 request xin nhạc đồng thời trong một cửa sổ chỉ tối đa 20/30 được chấp nhận; request vượt trần không ghi RSVP/tạo signed URL. |
| Link và riêng tư | Token sai format và không tồn tại trả cùng 404; no-store/noindex/referrer đúng ở response thực; OG không có tên/email/lời nhắn/RSVP; không nhúng URL nhạc lúc đầu. |
| Thay người nhận | Email đã gửi không sửa trực tiếp được; action thay người nhận đổi token, vô hiệu link cũ và reset RSVP; gửi lại cùng người giữ token. |
| Xóa | Lỗi giữa xóa Storage và DB không báo thành công; thử lại idempotent; prefix còn được theo dõi để dọn file đến muộn; không xóa developer cuối. |
| Metrics thật | Đối chiếu endpoint/field/scope/kỳ/unit với tài khoản thật; không dùng response mẫu trong tài liệu làm số production. Không tính quota từ dữ liệu nghiệp vụ. |
| Metrics lỗi | Kiểm tra thiếu token, 401/403, 429, timeout, null, thiếu field, đổi gói và snapshot cũ: trạng thái đúng, không tự điền 0 hoặc hiển thị xanh. |
| Metrics ngữ nghĩa | Không dùng fs_used_bytes làm Storage usage, API auth request làm MAU, realtime request làm message hoặc Brevo requests làm quota còn lại. |
| Refresh | Hai tab admin không gọi nguồn liên tục; khóa có hạn và kết quả cũ không đè mới; một nguồn lỗi không làm mất số liệu nguồn khác. |
| Migration | Database trống và bản sao schema cũ đều đạt đúng quyền/cột/index/trigger; không mất token/RSVP, không bịa lịch sử gửi cũ. |
| Trải nghiệm | Mobile 360 px, desktop, trình duyệt chặn autoplay, mất mạng, Realtime reconnect và danh sách 1.000 khách vẫn có xử lý rõ. |
| Phát hành | Build/typecheck và kiểm thử các luồng trên pass; chỉ sau đó mới đánh dấu hệ thống sẵn sàng production. |

---

## 10. NGUỒN CHÍNH THỨC ĐÃ ĐỐI CHIẾU

Ngày đọc: **24/09/2026**. Đây là ngày kiểm tra, không giả là ngày phát hành của nguồn. Nếu nền tảng thay đổi API/gói, phải kiểm tra lại mapping và ghi ngày mới trước khi cập nhật đặc tả/adapter. Việc đọc tài liệu công khai không chứng minh credential của dự án đã hoạt động.

| Mã | Nguồn | Dùng để kiểm chứng |
| :--- | :--- | :--- |
| S1 | [Netlify — How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) | Credit Free, chu kỳ, legacy và các hạng mục sử dụng. |
| S2 | [Netlify — Monitor usage](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/monitor-usage-for-credit-based-plans/) | Theo dõi ở Team Usage & billing. |
| S3 | [Netlify — OpenAPI](https://open-api.netlify.com/) | Phạm vi endpoint công khai đã rà; chưa xác minh mapping quota credit cho v1. |
| S4 | [Supabase — Pricing](https://supabase.com/pricing) và [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase) | Hạn mức công bố, phạm vi tổ chức/project. |
| S5 | [Supabase — Manage your usage](https://supabase.com/docs/guides/platform/manage-your-usage) và [Cached/uncached egress](https://supabase.com/blog/storage-500gb-uploads-cheaper-egress-pricing) | Tách từng loại tài nguyên và hai quota egress. |
| S6 | [Supabase — Get disk utilization](https://supabase.com/docs/reference/api/v1-get-disk-utilization) | Endpoint, fs_* field và quyền đọc. |
| S7 | [Supabase — Usage API counts](https://supabase.com/docs/reference/api/v1-get-project-usage-api-count) | Các field đếm request, không phải quota billing. |
| S8 | [Supabase — Organization entitlements](https://supabase.com/docs/reference/api/v1-get-organization-entitlements) | Quyền/tính năng theo gói, không mặc định là numeric quota. |
| S9 | [Supabase — Storage access control](https://supabase.com/docs/guides/storage/security/access-control) | RLS và quyền SELECT/UPDATE khi upsert. |
| S10 | [Brevo — Get account details](https://developers.brevo.com/reference/get-account) | Gói, creditsType, credits và thông tin tài khoản. |
| S11 | [Brevo — Aggregated SMTP report](https://developers.brevo.com/reference/get-aggregated-smtp-report) | Báo cáo transactional theo khoảng thời gian. |
| S12 | [Brevo — Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) | Email/ngày, contact và branding của Free. |
| S13 | [Brevo — Idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails) và [Send transactional email](https://developers.brevo.com/reference/send-transac-email) | Khóa chống trùng và hợp đồng gửi; cần kiểm thử adapter cụ thể. |
| S14 | [GitHub — Billing and licensing](https://docs.github.com/en/billing/get-started/introduction-to-billing) | Dashboard và cơ chế đọc billing chính thức. |
| S15 | [Supabase — Realtime limits](https://supabase.com/docs/guides/realtime/limits) | Giới hạn kết nối đồng thời; phân biệt với tổng message tháng. |
