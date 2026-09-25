# ĐẶC TẢ MVP — THƯ MỜI ĐIỆN TỬ CHO KHÁCH HÀNG TEST

Phiên bản MVP 1.0 — ngày 24/09/2026.

Tài liệu gốc: [YEU_CAU_DU_AN.md — v1.2](./YEU_CAU_DU_AN.md). Khi lập đặc tả, giao diện tham chiếu là các file tĩnh `index.html`, `script.js`, `config.js`; chúng đã được chuyển khỏi runtime và không còn trong repository phát hành.

Đây là phạm vi rút gọn để sớm có bản chạy thật cho khách test: chủ sự kiện đăng nhập, sửa thông tin/nhạc, gửi email mời và xem phản hồi; người được mời mở thiệp và phản hồi **một lần duy nhất**. Tài liệu này mô tả việc cần triển khai, không xác nhận các tích hợp đã được kết nối.

## 1. Mục tiêu và nguyên tắc chốt

- Có hai khu vực sử dụng: **khách hàng/chủ sự kiện (Host)** và **người được mời (Guest)**. Trang đăng nhập là cửa vào khu vực Host.
- Bạn/developer tạo tài khoản và sự kiện trước, sau đó gửi URL đăng nhập + email + mật khẩu cho khách hàng qua kênh riêng. Không xây giao diện quản trị tài khoản trong MVP.
- Host thao tác trên dữ liệu thật; email mời gửi thật; người nhận mở được link HTTPS từ điện thoại; phản hồi được lưu ở database và xuất hiện bên Host.
- Dùng dịch vụ có sẵn cho đăng nhập, database, lưu nhạc, gửi email và hosting. Không tự xây các dịch vụ hạ tầng này.
- **RSVP một lần:** sau lần gửi xác nhận thành công đầu tiên, cả lựa chọn tham gia/từ chối và ghi chú đều khóa. Mở lại link trên trình duyệt/thiết bị khác vẫn thấy lựa chọn ban đầu, không có form gửi lại.
- Quy tắc RSVP này **thay thế** yêu cầu “được đổi phản hồi” của v1.2 trong phạm vi MVP. Không triển khai nút sửa/reset RSVP cho Host hoặc Guest.
- Các yêu cầu bảo mật cần thiết từ v1.2 vẫn áp dụng. Các tính năng ghi rõ hoãn ở mục 3 không phải điều kiện hoàn thành MVP.
- Không dùng dữ liệu mẫu hoặc localStorage để giả lập kết quả trong bản bàn giao test.

## 2. Phạm vi phải có

| Khu vực | Chức năng bắt buộc |
| :--- | :--- |
| Đăng nhập Host | Email/mật khẩu do bạn cấp; báo lỗi đăng nhập; duy trì phiên; đăng xuất; chặn người chưa đăng nhập. |
| Quản lý sự kiện | Xem thiệp, sửa tiêu đề/ngày giờ, địa điểm/địa chỉ/link Google Maps; lưu và thấy thay đổi trên thiệp. |
| Nhạc | Upload/thay MP3, hiển thị kết quả, nghe thử; Guest phát/tạm dừng được trên thiệp. |
| Mời người tham gia | Nhập tên, email, lời mời riêng; tạo lời mời và gửi email có link cá nhân; xem trạng thái gửi; gửi lại có kiểm soát. |
| Theo dõi phản hồi | Danh sách khách, trạng thái chưa phản hồi/đồng ý/từ chối, ghi chú và thời gian phản hồi; tổng số theo trạng thái. |
| Thiệp Guest | Tận dụng thiết kế hiện có, hiện đúng thông tin sự kiện và tên khách; địa điểm, nhạc, form RSVP khi chưa trả lời. |
| RSVP Guest | Chọn đồng ý hoặc từ chối, ghi chú tùy chọn, gửi xác nhận; chỉ hiện cảm ơn khi đã lưu thật; sau đó chỉ xem trạng thái. |
| Hạ tầng test | URL HTTPS công khai, tài khoản thật, database/storage thật, email gửi thật và dữ liệu tồn tại qua lần tải lại. |

Để làm nhanh, **mỗi Host được cấp một sự kiện trong đợt MVP**; database vẫn giữ quan hệ host → events để mở rộng sau này. Host không có nút tạo sự kiện hoặc chọn template.

## 3. Chưa làm trong MVP

- `/system-admin`, trang giám sát quota, adapter metrics, biểu đồ hạ tầng, tự động cảnh báo.
- Host tự đăng ký, tự tạo sự kiện, tự chọn template, quên mật khẩu tự phục vụ.
- Trình thiết kế thiệp, đổi album/ảnh mỹ thuật, upload banner. Dùng ảnh và thiết kế đã chuẩn bị.
- Import Excel/CSV, gửi hàng loạt, lịch gửi, cron, webhook bounce, theo dõi mở/click email.
- Danh sách nhiều sự kiện trong giao diện Host, phân quyền đội nhóm.
- Sổ lời chúc công khai, số người đi cùng, QR check-in, thanh toán, đa ngôn ngữ.
- Giao diện xóa host/event, quản trị job dọn file, đổi người nhận sau khi đã gửi hoặc reset RSVP.
- Mua tên miền riêng. Dùng URL HTTPS do dịch vụ hosting cấp để khách test; domain riêng là bước sau nếu cần.

Quota được kiểm tra trực tiếp tại dashboard nhà cung cấp. Không xây bảng quota tạm bằng số suy đoán.

## 4. Yêu cầu chuyển thiết kế thiệp sang ứng dụng

Các mô tả trong bảng dưới ghi lại hiện trạng của bản tĩnh tại thời điểm lập đặc tả. Bản triển khai Next.js hiện dùng `src/features/template/` và dữ liệu lấy từ database/API.

| Thành phần | Hiện trạng | Việc làm cho MVP |
| :--- | :--- | :--- |
| Bố cục thiệp | index.html đã có hero, lời mời, lịch, địa điểm, câu chuyện, album và RSVP. | Giữ phong cách/bố cục và asset hiện có, đưa vào trang Guest có dữ liệu động. |
| Cá nhân hóa tên | script.js lấy tên từ query như ?guest hoặc ?to. | Lấy tên và lời mời từ invitation xác định bằng token; query tên không quyết định quyền truy cập. |
| Phản hồi | script.js lưu lời chúc trong localStorage, có nhánh webhook Google Sheets tùy cấu hình. | Thay bằng route server ghi database và đọc trạng thái đã lưu; bỏ luồng localStorage/webhook cũ khỏi đường xử lý RSVP. |
| Form RSVP | Có nhập tên, số người đi cùng và lựa chọn mặc định đồng ý. | Tên lấy từ thư mời và chỉ đọc; bỏ số người đi cùng; không chọn sẵn đồng ý; yêu cầu Guest chủ động chọn. |
| Sổ lời chúc | Có khối hiển thị lời chúc chung. | Bỏ khỏi Guest; ghi chú chỉ Guest đó và Host có quyền xem. |
| Customizer | Có modal thay ảnh/chỉnh nội dung/xuất config. | Không xuất hiện hoặc hoạt động trên trang Guest công khai; phần Host chỉ có những trường ở mục 5. |
| Nhạc | HTML có audio preload=auto và nguồn music.mp3. | Không tải nhạc ban đầu; xin signed URL sau thao tác mở/phát; xử lý trường hợp trình duyệt chặn autoplay. |
| Maps/CDN | Có iframe Google Maps và CSS icon từ CDN. | Bỏ iframe; dùng link Maps ngoài. Đóng gói icon/font/asset cần thiết để trang Guest không phụ thuộc CDN bên thứ ba. |

Các file tĩnh cũ chỉ là tài liệu tham chiếu thiết kế, không phải ứng dụng hoàn chỉnh. MVP chuyển cấu trúc cần thiết sang template dùng chung cho xem trước và Guest; bản runtime hiện nằm trong `src/features/template/`.

## 5. Giao diện khách hàng — Host

### 5.1. Đăng nhập: `/login`

- Form gồm email, mật khẩu, hiện/ẩn mật khẩu và nút “Đăng nhập”.
- Không có đăng ký. Dòng hỗ trợ: “Liên hệ người cung cấp để được cấp hoặc đặt lại mật khẩu.”
- Thành công chuyển `/dashboard`; sai thông tin hiện lỗi chung, không lộ email có tồn tại hay không.
- Đăng xuất kết thúc phiên. Truy cập dashboard/API bằng phiên hết hạn phải yêu cầu đăng nhập lại.

### 5.2. Trang quản lý: `/dashboard`

Một trang quản lý sự kiện được cấp, chia ba tab: **Thiệp & thông tin**, **Khách mời**, **Phản hồi**. Header có tên sự kiện, nút “Xem trước thiệp” và “Đăng xuất”. Nếu chưa có sự kiện, báo liên hệ người cung cấp, không tự tạo dữ liệu.

**Tab Thiệp & thông tin**

- Tiêu đề sự kiện, ngày và giờ; timezone MVP cố định `Asia/Ho_Chi_Minh` để tránh thêm thao tác.
- Tên địa điểm, địa chỉ, link Google Maps; mỗi thay đổi có nút Lưu và trạng thái đang lưu/thành công/lỗi.
- Cập nhật ngày giờ đồng thời cập nhật phần lịch/đếm ngược trên thiệp; không để nội dung hiển thị lấy ngày cũ từ config.js.
- MP3 tối đa 10.485.760 byte, MIME audio/mpeg; nút chọn file, upload/thay nhạc, báo trạng thái và nghe thử.
- Xem trước dùng cùng template và dữ liệu hiện lưu, hiển thị tên khách mẫu. Form RSVP trong preview bị vô hiệu và ghi rõ “Xem trước”; không tạo invitation/RSVP thật.
- Mỹ thuật, tên nhân vật chính, câu chuyện, album do developer chuẩn bị cho sự kiện. Host không chỉnh các phần này trong MVP.

**Tab Khách mời**

- Form: tên khách bắt buộc, email bắt buộc, lời mời riêng tùy chọn tối đa 500 ký tự.
- Nút “Gửi lời mời” tạo invitation rồi gửi email. Khóa nút khi request đang chạy.
- Email trim/lowercase, một email chỉ có một invitation trong cùng sự kiện. Nếu đã có, báo rõ và dẫn tới dòng khách cũ; không tạo dòng trùng.
- Danh sách có tên, email, trạng thái email và nút “Gửi lại”. Gửi lại dùng cùng invitation/token, không thay đổi RSVP đã có.
- Khách chưa từng có lần gửi có thể sửa tên/email/lời mời. Sau lần gửi đầu tiên, MVP chỉ cho xem và gửi lại, không đổi người nhận.
- Phân biệt “Chưa gửi”, “Đang gửi”, “Đã được dịch vụ email tiếp nhận”, “Gửi thất bại”, “Chưa rõ kết quả”. Không ghi “Đã đến hộp thư” chỉ dựa vào HTTP thành công.
- Tìm kiếm tên/email và phân trang 50 dòng. Chỉ gửi từng người trong MVP.

**Tab Phản hồi**

- Các số tổng: tổng khách mời, chưa phản hồi, đồng ý, từ chối. Tính theo invitation, không tính lần gửi lại thành khách mới.
- Bảng có tên, email, trạng thái RSVP, ghi chú và responded_at; lọc theo trạng thái, tìm kiếm tên/email.
- Chỉ đọc, không có nút sửa/xóa/reset câu trả lời.
- Cập nhật bằng polling mỗi 10 giây khi tab đang hiển thị, cộng nút “Làm mới”. Dừng polling khi tab ẩn hoặc đăng xuất. Không cần Supabase Realtime trong MVP.
- Khi mạng/dịch vụ bình thường, phản hồi mới xuất hiện ở lần polling thành công kế tiếp; khi lỗi phải báo chưa cập nhật và giữ dữ liệu cũ, không báo chắc chắn “realtime”.

## 6. Giao diện người được mời — Guest

### 6.1. Email mời và truy cập

Email có tiêu đề `Thư mời: {event_title}`, lời chào tên khách, lời mời riêng nếu có, ngày/địa điểm và nút “Xem thư mời”.

Nút dẫn tới `{SITE_URL}/invite/{token}`. Guest không đăng nhập. Link tồn tại sau khi gửi phản hồi để khách xem lại thiệp.

Token ngẫu nhiên CSPRNG 32 byte, biểu diễn 64 ký tự hex; không dùng ID tăng dần/email/tên khách làm khóa. Token sai hoặc không tồn tại trả cùng thông báo 404. Mọi lần truy cập đều đọc trạng thái hiện tại từ server/database.

### 6.2. Trước khi phản hồi

- Hiện thiệp, tên Guest, lời mời riêng, thời gian, địa điểm và nút mở Google Maps.
- Nhạc tùy chọn: chỉ tải sau thao tác mở/phát; có Play/Pause. Lỗi nhạc không chặn xem thiệp hoặc trả lời.
- Khối RSVP gồm hai lựa chọn “Tôi sẽ tham gia” / “Tôi không thể tham gia”, ô “Ghi chú / lời nhắn” tối đa 1.000 ký tự và nút “Gửi xác nhận”.
- Chọn radio chưa khóa câu trả lời. **Chỉ lần bấm Gửi xác nhận được server lưu thành công mới chốt lựa chọn.**
- Hiện trước nút gửi: “Bạn chỉ có thể gửi phản hồi một lần. Sau khi gửi, lựa chọn và ghi chú sẽ không thể chỉnh sửa.”
- Nút gửi chỉ hoạt động khi có lựa chọn; không tự chọn đồng ý; không ghi RSVP khi mở email/link hoặc khi bot xem preview.

### 6.3. Sau khi phản hồi thành công

Thay form bằng thông báo:

> Cảm ơn bạn đã phản hồi!  
> Trạng thái của bạn: Đã xác nhận tham gia / Đã xác nhận không tham gia.

Hiện ghi chú của chính Guest nếu có và thời gian phản hồi. Thiệp, địa điểm và nhạc vẫn xem được. Không còn nút gửi hoặc trường chỉnh sửa.

Nếu server chưa xác nhận lưu, không hiện cảm ơn. Timeout thì đọc lại trạng thái từ server: đã lưu thì hiện kết quả; chưa lưu thì giữ nội dung form để thử lại.

### 6.4. Mở lại link và chống thay đổi lần hai

- Refresh, đóng/mở lại, ẩn danh hoặc thiết bị khác đều hiện trạng thái đầu tiên từ database; không dựa cookie/localStorage.
- Client cũ còn mở form cũng không thể sửa bằng request trực tiếp. Host gửi lại email không mở khóa phản hồi.
- Hai request đồng thời chọn trái ngược: chỉ request đầu tiên commit thành công được ghi; request còn lại nhận trạng thái đã lưu. Ghi chú cũng không bị ghi đè.
- Không có API công khai lấy danh sách khách hoặc lời nhắn người khác. Link là quyền truy cập của Guest; người có link chuyển tiếp cũng có quyền đó, nên không chia sẻ link cá nhân rộng rãi.

## 7. Dịch vụ tích hợp để chạy bản test

Giữ hướng công nghệ của v1.2, thu hẹp phần phải tự xây:

| Nhu cầu | Dịch vụ / cách thực hiện |
| :--- | :--- |
| Web Host + Guest và route server | Next.js App Router, TypeScript; tái sử dụng thiết kế thiệp hiện có. |
| Đăng nhập | Supabase Auth. Bạn tạo host bằng Dashboard/Admin API; tắt public signup. Không xây hệ thống mật khẩu riêng. |
| Dữ liệu sự kiện, invitation và phản hồi | Supabase Postgres với RLS. Không dùng Google Sheets/localStorage làm nguồn dữ liệu chính. |
| Nhạc | Supabase Storage bucket audio private; upload trực tiếp bằng JWT Host; Guest nhận signed URL qua server sau khi kiểm tra token. |
| Email mời | Brevo transactional API gọi từ server; người nhận có thể dùng Gmail hoặc email khác. Không tích hợp Gmail API/OAuth hay mật khẩu hộp thư cá nhân cho MVP. |
| Hosting và URL test | Netlify, dùng URL HTTPS được cấp cho bản deploy test; SITE_URL phải trỏ đúng bản deploy khách truy cập. |
| Code và asset | GitHub private, theo hướng của v1.2. |

“Có giao diện hai phía” không có nghĩa chỉ làm frontend: phải có lớp server mỏng và kết nối các dịch vụ trên để dữ liệu chia sẻ được giữa thiết bị. Không cần làm giao diện quản trị cho các dịch vụ này.

Không cần mua domain riêng để bắt đầu test nếu URL hosting và người gửi email được nhà cung cấp chấp thuận. Việc xác minh sender/domain theo yêu cầu tài khoản Brevo thực tế phải hoàn tất trước gửi thử; không hứa mọi địa chỉ Gmail cá nhân đều dùng được làm sender. Nếu sender chưa được duyệt, đó là điều kiện chưa hoàn thành luồng email thật.

Biến môi trường kế thừa v1.2: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, SITE_URL. Secret chỉ ở server. **Không cần Management token/metrics token** vì MVP không có trang giám sát.

## 8. Dữ liệu và API tối thiểu

### 8.1. Dữ liệu

Kế thừa tên và ràng buộc phù hợp từ v1.2:

- `profiles`: liên kết Auth user; Host không tự sửa role.
- `events`: chủ sở hữu, template, title, event_date, timezone, venue_name, venue_address, google_map_url, music_path.
- `invitations`: event_id, guest_name, guest_email, invitation_note, token, status, guest_message, responded_at, email_status, sent_at, last_send_attempt_at, current_send_attempt_id, has_send_history và bộ đếm xin nhạc.
- `email_send_attempts` và `email_daily_counters`: lịch sử từng lần gửi, chống gửi trùng và giới hạn nội bộ theo v1.2; không dùng số invitation làm quota email.
- Các cột nhận diện/thời gian, FK, unique email/token và quyền cột giữ theo v1.2.

Không cần provider_metric_snapshots, provider_sync_state, maintenance_jobs hoặc Realtime publication cho bản MVP. Không có nút xóa sự kiện/tài khoản; developer dọn dữ liệu thử bằng quy trình thủ công kiểm tra Storage và database.

### 8.2. Quy tắc RSVP ở database

Chỉ cho chuyển:

`pending → accepted` hoặc `pending → declined`.

`accepted` và `declined` là trạng thái kết thúc; không cho chuyển giữa hai trạng thái hoặc về pending qua luồng ứng dụng. Guest message và responded_at cũng bất biến sau phản hồi đầu tiên.

Server thực hiện một transaction/UPDATE có điều kiện, tương đương:

`UPDATE invitations SET status = ..., guest_message = ..., responded_at = now() WHERE token = ... AND status = 'pending' AND responded_at IS NULL RETURNING ...`

Phải xác minh sự kiện còn truy cập được, validate status/ghi chú và kiểm tra token trong cùng luồng ghi. Không đọc pending rồi UPDATE vô điều kiện.

Nếu không cập nhật được dòng nào: đọc lại bằng token; không tồn tại trả 404, đã trả lời trả 409 cùng trạng thái đã lưu để UI chuyển sang chỉ đọc. Không đổi responded_at khi request được gửi lặp. RPC đặc quyền chỉ server được gọi; trigger bảo vệ từ chối thay đổi RSVP/ghi chú/thời gian đã chốt qua các đường ghi ứng dụng khác.

### 8.3. Các thao tác server

| Thao tác | Kiểm tra và kết quả |
| :--- | :--- |
| Đọc/sửa sự kiện | Session hợp lệ, đúng chủ sở hữu; chỉ sửa whitelist; dữ liệu lưu thật trước khi báo thành công. |
| Upload/finalize nhạc | Kiểm tra Host/event/path, upload trực tiếp Storage, xác minh object và lưu music_path. |
| Tạo/gửi/gửi lại lời mời | Session + sở hữu; unique email; khóa và request_id theo v1.2; giữ cùng token khi gửi lại. |
| Đọc khách và phản hồi | Chỉ Host sở hữu event; phân trang/lọc server; không để Guest gọi API danh sách. |
| Đọc một thiệp | Token hợp lệ; chỉ trả projection cần cho Guest đó, không lộ danh sách hay secret. |
| Gửi RSVP | POST token + accepted/declined + ghi chú; một lần thành công; chặn ghi lại ở database. |
| Xin nhạc Guest | POST token; kiểm tra đúng music_path của event; signed URL 60 phút; giới hạn 30 lần/token/60 phút bằng database. |

Hành vi email kế thừa mục 2.5 của v1.2: cooldown 60 giây tính cả thất bại, ledger từng lần, khóa đồng thời, trạng thái unknown khi chưa biết kết quả, không tự retry mù. Lần gửi unknown cần developer kiểm tra qua dashboard dịch vụ và công cụ quản trị dữ liệu; không xây trang đối soát riêng trong MVP.

## 9. Bảo mật và xử lý lỗi tối thiểu

- RLS và kiểm tra quyền server cho mọi thao tác Host; không chỉ giấu nút. Host A không đọc/sửa dữ liệu Host B.
- Auth thật, không lưu mật khẩu vào config.js, database nghiệp vụ, Git hoặc localStorage.
- Không cấp cho client quyền sửa token/email_status/RSVP/guest_message/responded_at/path nhạc. Server xác minh quyền trước khi dùng service role.
- Storage kiểm tra cả host và event tồn tại/thuộc sở hữu; cho Host SELECT/INSERT/UPDATE phù hợp để thay nhạc hoạt động. Không public bucket audio.
- Validate email/tên/độ dài; raw text được render an toàn, HTML-escape khi tạo email; không chèn ghi chú bằng innerHTML.
- Maps dùng allowlist HTTPS theo v1.2, mở tab mới với noopener noreferrer; không iframe.
- Guest/dashboard no-store, noindex và Referrer-Policy no-referrer; metadata chia sẻ chỉ có thông tin sự kiện công khai, không có thông tin riêng của khách.
- Kiểm tra Origin/CSRF cho action có session; không ghi dữ liệu qua GET.
- Lỗi API/Storage/email phải hiện rõ, giữ dữ liệu đã nhập và cho thử lại khi an toàn. Không hiển thị “đã lưu/đã gửi” chỉ bằng toast giả.
- Không lưu phản hồi ở hai nguồn song song. Database là nguồn quyết định trạng thái, kể cả khi UI đang hiển thị dữ liệu cũ.
- Ngưỡng nội bộ không được trình bày thành số quota nền tảng. Theo dõi hạn mức thật qua dashboard nhà cung cấp.

## 10. Trình tự làm để ra bản test sớm

1. Tạo project Next.js và tích hợp thiết kế index.html thành template Guest/preview; không làm lại mỹ thuật.
2. Kết nối Supabase Auth/Postgres; tạo migration tối thiểu, bật RLS, tạo hai Host thử và mỗi Host một sự kiện để kiểm tra phân quyền.
3. Làm login và dashboard với form thông tin, upload MP3, quản lý khách và bảng phản hồi.
4. Làm đọc thiệp theo token, RSVP một lần và trạng thái cảm ơn/chỉ đọc.
5. Kết nối Brevo, sender hợp lệ và email template; hoàn thiện trạng thái gửi/lỗi/chống gửi trùng.
6. Deploy Netlify lấy URL test HTTPS, cập nhật SITE_URL, kiểm tra trọn luồng trên hai thiết bị.
7. Bạn cấp tài khoản cho khách test và gửi hướng dẫn thao tác ngắn.

Không để việc thiếu giao diện admin, quota dashboard, domain riêng hoặc nhiều template chặn MVP. Ngược lại, đăng nhập giả, email không gửi thật hoặc phản hồi không đồng bộ là chưa đạt.

## 11. Checklist nghiệm thu bản MVP

- [ ] Host đăng nhập bằng email/mật khẩu bạn cấp, đăng xuất được; người ngoài không vào dashboard.
- [ ] Host A không đọc/sửa dữ liệu Host B bằng URL hoặc gọi API trực tiếp.
- [ ] Sửa thời gian/địa chỉ lưu thật và hiển thị đúng trên thiệp sau tải lại.
- [ ] Upload MP3 và thay MP3 lần hai thành công; Guest nghe được bằng thao tác phát; không có nhạc vẫn dùng thiệp bình thường.
- [ ] Preview cùng giao diện Guest nhưng không ghi phản hồi thật.
- [ ] Thêm tên/email/lời mời, gửi email thật đến hộp thư thử; nút mở đúng invitation trên URL HTTPS.
- [ ] Email trùng không tạo dòng mới; gửi lại giữ link và RSVP; lỗi/unknown không được báo gửi thành công.
- [ ] Guest chưa phản hồi thấy form, chọn đồng ý hoặc từ chối, nhập ghi chú và gửi.
- [ ] Chỉ sau khi server lưu thành công mới thấy cảm ơn và trạng thái đã chọn.
- [ ] Ghi chú và phản hồi xuất hiện ở dashboard Host ở lần làm mới/polling thành công tiếp theo.
- [ ] Đóng/mở link, đổi trình duyệt/thiết bị vẫn thấy câu trả lời cũ và không có form chỉnh sửa.
- [ ] Hai tab gửi ngược lựa chọn cùng lúc chỉ ghi một câu trả lời; request trực tiếp lần hai không sửa được ghi chú/trạng thái/thời gian.
- [ ] Timeout sau khi gửi được xử lý bằng đọc lại database; không hiện cảm ơn giả hoặc ghi đè phản hồi đã có.
- [ ] Không lộ lời nhắn của khách khác, localStorage RSVP cũ, customizer công khai, secret hoặc danh sách khách.
- [ ] Mobile 360 px và desktop dùng được; build/typecheck và kiểm thử luồng chính đạt.
- [ ] Bàn giao URL đăng nhập, tài khoản được cấp, một link Guest thử và hướng dẫn kiểm tra phản hồi.

**MVP hoàn thành khi khách hàng có thể tự đăng nhập, gửi lời mời thật, nhận phản hồi thật và người được mời không thể thay đổi câu trả lời đầu tiên qua luồng ứng dụng.**

