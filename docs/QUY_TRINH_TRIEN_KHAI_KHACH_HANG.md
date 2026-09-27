# Quy trình triển khai thiệp mời cho khách hàng

Tài liệu này hướng dẫn người triển khai nhận đơn, làm thiệp và bàn giao tài khoản. Theo xác nhận của chủ dự án, tài khoản khách hàng và thiệp lễ tốt nghiệp hiện tại là **demo/test**, chưa phải đơn của khách thật. Website đã deploy không đồng nghĩa với môi trường đã được nghiệm thu để phục vụ khách trả phí.

Khách thật liên hệ qua **Zalo hoặc Facebook**, gửi ảnh, nội dung, nhạc, địa điểm và thời gian. Người triển khai làm thiệp theo yêu cầu rồi gửi tài khoản, mật khẩu. Mẫu có sẵn đầu tiên là **lễ tốt nghiệp**.

Rà soát ngày **26/09/2026** theo mã nguồn trong workspace. **Đã có** nghĩa là có implementation trong code, không thay thế kiểm thử trên môi trường triển khai. **Cần phát triển** là hướng đề xuất chưa được triển khai; chỉnh tài liệu này không tự bổ sung tính năng.

## 1. Quyết định sản phẩm

### 1.1. Hai lựa chọn dịch vụ

| Lựa chọn | Người triển khai thực hiện | Phần giữ nguyên |
| --- | --- | --- |
| **Dùng mẫu có sẵn** | Giữ bố cục đã chọn, thay ảnh, nội dung, nhạc, địa điểm và thời gian | Đăng nhập, Dashboard, quản lý khách mời, gửi thư mời, xem phản hồi |
| **Thiết kế giao diện riêng** | Làm lại bố cục, màu sắc, phông chữ, trang trí và hiệu ứng theo yêu cầu đã chốt | Cùng hệ thống tài khoản và các chức năng quản lý như lựa chọn trên |

Khách chọn dịch vụ khi trao đổi với người triển khai. Không bổ sung công cụ tự thiết kế hoặc chọn mẫu trên Dashboard trong phạm vi này.

Quy trình chung: **nhận yêu cầu → chốt phạm vi và nội dung → làm thiệp → khách duyệt → kiểm tra/deploy → tạo tài khoản, nhập dữ liệu và nhạc → kiểm tra lần cuối → bàn giao**. Có thể gửi ảnh chụp hoặc video để khách duyệt trước khi cấp tài khoản; không gửi đường preview cho phép chọn mẫu tùy ý.

### 1.2. Tài khoản và phạm vi dùng chung

Mỗi khách hàng nhận:

- một tài khoản Host, đăng nhập tại `/login`;
- một sự kiện trong bảng `events`;
- một `template_key` riêng, trỏ tới giao diện thiệp của khách đó;
- nhiều link `/invite/{token}`, mỗi khách mời một link.

Khách hàng không có website riêng, không tự đăng ký, không tự tạo sự kiện và không tự đổi mẫu.

Đăng nhập, Dashboard, gửi email và xử lý RSVP dùng chung cho mọi khách. Ảnh, tên, câu chuyện và album là phần riêng của từng khách. Với thiết kế riêng, giao diện thiệp cũng là phần riêng.

Phong bì mở thư hiện dùng chung và nằm ngoài component mẫu. Dùng mẫu có sẵn thì giữ phong bì hiện tại. Nếu khách yêu cầu đổi cả phong bì, cần phát triển cách chọn phong bì theo mẫu trước; không sửa phong bì chung cho riêng một khách.

Sau này muốn làm cưới, sinh nhật hoặc sự kiện khác thì thêm một mẫu nền mới. Không tách database, không làm site thứ hai, không đổi Dashboard.

### 1.3. Khi có 10 khách trong cùng dự án

| Nhu cầu | Cách tổ chức hướng tới |
| --- | --- |
| 10 khách cùng một bố cục | Một mẫu nền dùng chung, 10 bộ nội dung và ảnh riêng |
| 10 khách muốn giao diện hoàn toàn khác | 10 bộ component/CSS/ảnh riêng trong cùng dự án |
| 7 khách dùng mẫu, 3 khách thiết kế riêng | Một mẫu nền cho 7 khách và 3 bộ giao diện riêng |

Thư mục là cách tổ chức source; không cần 10 bản ứng dụng, 10 lần chạy server hoặc 10 database. Mỗi event chọn đúng bộ giao diện qua `template_key`.

**Code hiện chưa tách mẫu nền để nhận config.** Mục 6 dùng cách copy component để làm được ngay trên cấu trúc hiện tại. Trước khi nhân rộng khách dùng cùng bố cục, nên tách mẫu nền nhận dữ liệu và đường dẫn ảnh theo khách, giữ nguyên hợp đồng `TemplateProps` tại loader. Khi đó nhiều key có thể dùng chung bố cục với config khác nhau; sửa lỗi chung không phải sửa 10 bản copy. Đây là bước cải tiến cần làm trong code, không phải tính năng đã có.

## 2. Hiện trạng đã kiểm trong code

| Việc | Trạng thái | Chỗ kiểm |
| --- | --- | --- |
| Đăng nhập Host, Dashboard, gửi email, RSVP một lần | Đã có | `src/app/login`, `src/features/events`, `src/features/invitations`, `src/features/guest` |
| Một user chỉ có một event; Host không tự tạo event và không tự đổi `template_key` | Đã có | `supabase/migrations/202609240001_mvp_core.sql` |
| Trang khách đọc `template_key` rồi nạp component | Đã có | `src/app/invite/[token]/page.tsx`, `src/features/template/InvitationTemplate.tsx` |
| Hai key `wedding-floral-01` và `graduation-floral-01` | Đã có, nhưng cùng một giao diện | `src/features/template/resolve-key.ts`, `src/features/template/registry.ts` |
| Nội dung và ảnh mẫu "Mai Hoa" | Đã có, dùng chung cho cả hai key | `src/features/template/content.ts`, `public/templates/wedding-floral-01/` |
| Nền CSS cũng trỏ vào thư mục mẫu chung | Đã có | `src/features/template/template.css` |
| Phong bì mở thư, có hình nón tốt nghiệp | Đã có, dùng chung, nằm ngoài template | `src/features/guest/InvitationEntrance.tsx` |
| Host chọn mẫu khác bằng query trên `/preview` | Còn vấn đề cách ly: có thể xem nội dung tĩnh của mẫu khác | `src/app/preview/page.tsx`; xử lý trước bàn giao nhiều khách, xem mục 9 |
| `npm run new:client`, `npm run create:client` | Chưa có | `package.json` chỉ có `dev`, `build`, `check:deploy`, `smoke:production`, `start`, `typecheck` |
| File config theo khách, base template theo chủ đề, component bespoke | Chưa có | Không có `src/features/template/configs/` hay `templates/clients/` |
| Trang `/system-admin` | Chưa có, và không thuộc phạm vi này | — |

Hệ quả: gán khách mới vào `wedding-floral-01` hoặc `graduation-floral-01` không tạo giao diện riêng. Sửa `content.ts` hoặc thư mục `public/templates/wedding-floral-01/` sẽ đổi thiệp của mọi event đang dùng hai key đó.

`scripts/prepare-template-assets.mjs` copy toàn bộ `images/` vào `public/templates/wedding-floral-01/`. Không thay ảnh khách vào `images/`, và không dùng script này để tạo thư mục khách.

## 3. Cái gì dùng chung, cái gì riêng

Dùng chung, không sửa theo từng khách:

- `/login` và `/dashboard`;
- gửi email Brevo, sổ gửi, hạn 300 lượt/ngày cho cả hệ thống, chờ 60 giây trước khi gửi lại cùng một lời mời;
- RSVP khóa sau lần xác nhận thành công đầu tiên;
- cơ chế nhạc MP3, tối đa 10 MiB, bucket `audio`, đường dẫn `{user_id}/{event_id}/music.mp3`. Bản nhạc là dữ liệu riêng từng event.

Phong bì mặc định dùng chung; thiết kế phong bì riêng cần tách theo mẫu như mục 1.

Riêng từng khách, nằm trong code và ảnh tĩnh:

- tên người tốt nghiệp, huy hiệu, câu chuyện, lời cảm ơn;
- ảnh chân dung, ảnh chạy, album, ảnh lời cảm ơn.

Riêng từng khách mời, Host nhập trên Dashboard:

- tên, email, lời nhắn.

Hệ thống tạo link token và lưu trạng thái RSVP từ phản hồi của khách mời; Host không nhập token hay tự đặt phản hồi thay khách.

Người triển khai chuẩn bị dữ liệu ban đầu theo thông tin khách gửi. Sau bàn giao, Host vẫn tự sửa được trên Dashboard, không cần deploy:

- tiêu đề, ngày giờ, tên địa điểm, địa chỉ, link Google Maps, nhạc.

Host không sửa được tên người trong mẫu, câu chuyện, album, bố cục. Những phần đó phải sửa code rồi deploy.

Sau khi lưu, mở lại preview hoặc tải lại trang thiệp để kiểm tra. Không hứa trang thiệp đang mở trên máy khách mời tự cập nhật ngay.

## 4. Đặt tên trước khi làm

Quy ước đặt `template_key`: tối đa 50 ký tự, không dấu, không khoảng trắng. App đối chiếu danh sách key đã đăng ký sau khi trim, không tự suy ra mẫu. Database giới hạn độ dài nhưng không đối chiếu registry trong source; insert SQL thành công không chứng minh key đã deploy.

Quy ước:

| Loại | Key | Ví dụ |
| --- | --- | --- |
| Khách tốt nghiệp | `graduation-{slug}` | `graduation-hoa-mai` |
| Khách sự kiện khác, khi có mẫu nền riêng | `{loai}-{slug}` | `wedding-nam-linh` |
| Thiết kế giao diện riêng | `custom-{slug}` | `custom-hoa-mai` |

Không dùng lại `wedding-floral-01` hay `graduation-floral-01` cho khách mới. Hai key đó là mẫu gốc đang gắn nội dung Mai Hoa.

Slug lấy từ tên khách, viết thường, gạch ngang. Ví dụ Nguyễn Mai Hoa thành `hoa-mai`. Nếu trùng tên, thêm mã đơn ngắn như `graduation-hoa-mai-002`; kiểm tra chưa được dùng trước khi tạo. Key đầy đủ phải còn trong 50 ký tự. Tên Mai Hoa trong ví dụ chỉ minh họa, phải thay bằng khách thực tế.

## 5. Xin khách những gì

Nhận thông tin qua Zalo/Facebook, chốt lựa chọn dịch vụ rồi xin đủ trước khi sửa code:

- tên người tốt nghiệp, đúng chữ sẽ in trên thiệp;
- tiêu đề sự kiện, ngày giờ theo giờ Việt Nam;
- tên địa điểm, địa chỉ, link Google Maps nếu có;
- email khách sẽ dùng để đăng nhập Dashboard;
- lời ngỏ, các đoạn câu chuyện, lời cảm ơn;
- ảnh đã được phép dùng;
- nhạc MP3 tối đa 10 MiB nếu muốn có nhạc nền, hoặc xác nhận không dùng nhạc;
- số khách mời dự kiến, ngày bắt đầu gửi thư và thời hạn cần giữ thiệp hoạt động.

Với thiết kế riêng, chốt thêm bố cục, màu sắc, phông chữ, hiệu ứng, hình tham khảo, các phần cần có và có đổi phong bì hay không. Thống nhất số vòng chỉnh sửa, hạn bàn giao và chi phí trước khi làm; lưu nội dung khách đã duyệt trong hồ sơ đơn hàng, không lưu mật khẩu ở đó.

Với mẫu tốt nghiệp có sẵn, ảnh đưa vào thiệp xuất WebP, nên dưới 300KB/ảnh. Thiết kế riêng lập danh sách ảnh theo bố cục đã chốt:

| File | Việc dùng |
| --- | --- |
| `hero-portrait.webp` | Chân dung chính |
| `story-portrait.webp` | Ảnh cạnh câu chuyện |
| `gallery-1.webp` … `gallery-6.webp` | Album, đủ 6 ảnh vì mẫu đang map 6 caption |
| `marquee-1.webp` … `marquee-4.webp` | Dải ảnh chạy |
| `thank-you-banner.webp` | Nền lời cảm ơn |

Ảnh trang trí (`cap-icon.png`, `corner-leaf.png`, `flower-decor.png`, `spin-badge.png`, `sparkle.png`, các `bg-*.png`) thuộc mẫu tốt nghiệp chung. Giữ nguyên, trừ khi khách yêu cầu đổi cả bộ trang trí. Nền trong `template.css` vẫn đọc từ `public/templates/wedding-floral-01/`. Không sửa các URL đó cho một khách.

Nhận nhạc ở bước này; sau khi tạo tài khoản và event, người triển khai đăng nhập tài khoản vừa cấp để tải qua Dashboard trước khi bàn giao. Host vẫn có thể thay nhạc sau đó.

## 6. Lựa chọn 1 — Làm thiệp tốt nghiệp từ mẫu có sẵn

Làm tay. Không chạy `npm run new:client`.

Mẫu gốc import cứng `src/features/template/content.ts`. Vì vậy mỗi khách tốt nghiệp cần một component riêng cho đến khi mẫu gốc được tách để nhận config. Component mới vẫn dùng `template.css` và phong bì hiện có, nên bố cục tốt nghiệp không phải vẽ lại.

### 6.1. Tạo thư mục ảnh

Tạo `public/templates/graduation-hoa-mai/`.

Copy các file trang trí từ `public/templates/wedding-floral-01/` nếu component mới vẫn gọi `asset()` cho chúng. Thay các ảnh ở mục 5 bằng ảnh của khách. Không ghi đè thư mục `wedding-floral-01`.

### 6.2. Tạo file nội dung

Tạo `src/features/template/configs/graduation-hoa-mai.ts`. Giữ đúng các trường mà `WeddingFloral01.tsx` đang đọc từ `content`:

```ts
const asset = (file: string) => `/templates/graduation-hoa-mai/${file}`;

export const content = {
  ownerName: 'Nguyễn Mai Hoa',
  badge: 'GRADUATION',
  subtitle: 'Ceremony',
  storyHeading: 'GIỮ LẠI THANH XUÂN ĐẸP NHẤT',
  story: ['Đoạn khách đã duyệt.'],
  gallery: [
    { src: asset('gallery-1.webp'), caption: 'Chú thích ảnh 1' },
    { src: asset('gallery-2.webp'), caption: 'Chú thích ảnh 2' },
    { src: asset('gallery-3.webp'), caption: 'Chú thích ảnh 3' },
    { src: asset('gallery-4.webp'), caption: 'Chú thích ảnh 4' },
    { src: asset('gallery-5.webp'), caption: 'Chú thích ảnh 5' },
    { src: asset('gallery-6.webp'), caption: 'Chú thích ảnh 6' },
  ],
  thankYou: 'Lời cảm ơn khách đã duyệt.',
};

export { asset };
```

`badge` và `subtitle` là chữ trên ảnh chính, không phải tiêu đề sự kiện. Tiêu đề sự kiện lấy từ Dashboard.

### 6.3. Tạo component

Copy `src/features/template/templates/WeddingFloral01.tsx` thành `src/features/template/templates/clients/GraduationHoaMai.tsx`. Đổi tên hàm export từ `WeddingFloral01` thành `GraduationHoaMai` để loader trỏ đúng export. File mới nằm sâu hơn một cấp, nên mọi import tương đối `../` trong file gốc phải thành `../../`. Import `@/` giữ nguyên.

Đổi riêng dòng nội dung:

```ts
import { asset, content } from '../../configs/graduation-hoa-mai';
```

Không copy `template.css`. Component vẫn import `../../template.css`. Không thêm Tailwind; dự án không có Tailwind.

Giữ cách mẫu gốc đang tách hai chế độ, vì kiểu `TemplateProps` không cho preview dùng `audioControl` hay `responseArea`:

- `mode === 'preview'`: chữ xem trước, nút nhạc xem trước của Host, `MockRsvpForm`;
- `mode === 'guest'`: `props.audioControl` và `props.responseArea`.

Các chỗ đang đọc `event.title`, `event.eventDate`, `event.venueName`, `event.venueAddress`, `event.googleMapUrl`, `invitation.guestName`, `invitation.invitationNote` phải giữ. Đó là phần Host và khách mời sửa được sau này.

### 6.4. Đăng ký key ở cả hai file

`src/features/template/resolve-key.ts` là danh sách key hợp lệ. Thêm `'graduation-hoa-mai'` vào `REGISTERED_TEMPLATE_KEYS`.

`src/features/template/registry.ts` phải có loader cho đúng key đó, import động file `./templates/clients/GraduationHoaMai` rồi trả về `loaded.GraduationHoaMai`. Giữ cách tải động đang có; không import tĩnh toàn bộ mẫu vào Dashboard. Thiếu một trong hai file thì typecheck hoặc trang thiệp sẽ không nhận mẫu.

Không xóa hai key cũ nếu event đang chạy vẫn dùng chúng.

### 6.5. Xem trên máy

```powershell
npm run typecheck
npm run dev
```

Mở `http://localhost:3000/preview?template=graduation-hoa-mai`. Trang này chỉ mở không cần đăng nhập khi `NODE_ENV=development`. Trên production, người chưa đăng nhập vào `/preview` sẽ bị `notFound()`.

Kiểm tra trên điện thoại và máy tính:

- đủ ảnh, không vỡ đường dẫn;
- tên và câu chuyện là của khách này, không còn chữ Mai Hoa;
- phong bì vẫn mở được;
- khi chưa đăng nhập, lịch và đồng hồ lấy ngày từ fixture demo; nếu đăng nhập Host có event, chúng lấy dữ liệu event của Host đó. Query `template` chỉ đổi mẫu, không đổi event đang xem;
- preview không gửi RSVP thật; tên dài, ảnh dọc/ngang và phần nhạc hiển thị đúng.

Sửa chữ hoặc ảnh thì sửa file config và thư mục ảnh của key này, rồi xem lại. Không sửa `content.ts`.

## 7. Đưa lên production trước, tạo tài khoản sau

### 7.1. Xác định môi trường phục vụ khách thật

Trước đơn đầu tiên, ghi nhận đúng site, Supabase project, bộ migration đã áp dụng, sender Brevo và `SITE_URL` sẽ dùng. Site `https://nc-thiepmoi.netlify.app` là địa chỉ deploy hiện được ghi trong README; không mặc định rằng database đang nối với site này đã sẵn sàng nhận dữ liệu khách thật.

Giữ môi trường thử nghiệm tách khỏi dữ liệu khách thật. Nếu tạo Supabase project phục vụ khách thật, phải chuẩn bị schema/RLS/storage và kiểm tra cấu hình trên project đó; không tự chạy migration hoặc script test vào database có khách. `supabase/test-project.json` ghim project dùng cho kiểm thử; cơ chế email giả lập trong `src/features/email/config.ts` chỉ cho phép local development/test với project đã ghim. Không dùng `EMAIL_TRANSPORT=stub` trên hosting.

### 7.2. Kiểm tra và deploy

Key chưa có trong bản đang chạy thì `/invite/{token}` và phần xem trước hiện "Mẫu thiệp không khả dụng". Tạo user trước khi deploy xong không làm thiệp xuất hiện.

1. Chạy `npm run typecheck`, `npm run check:deploy` và `npm run build` khi đã cấu hình đủ biến môi trường. `check:deploy` chỉ kiểm tra cấu hình, không chứng minh template đúng hoặc email gửi được.
2. Kiểm tra mẫu mới và những mẫu chịu ảnh hưởng nếu có sửa component/CSS dùng chung. Trên môi trường test, kiểm tra đăng nhập, preview, nhạc, link mời, RSVP một lần và Dashboard nhận đúng phản hồi. Thư thử chỉ gửi tới hộp thư do người triển khai kiểm soát.
3. Ghi lại commit và deploy đang hoạt động để có điểm khôi phục. Đưa bản mới lên đúng site đã chốt ở mục 7.1. `git push` chỉ tự deploy nếu site đã nối repository và đúng nhánh production; phải xác nhận deploy thực sự hoàn tất.
4. Chạy smoke chỉ đọc, rồi tạo tài khoản ở mục 8 và kiểm tra luồng Host bằng tài khoản đó trước khi giao.

Smoke đã có trong `scripts/verify-production.mjs`:

```powershell
$env:SMOKE_BASE_URL = 'https://nc-thiepmoi.netlify.app' # Thay nếu dùng site khác
npm run smoke:production
```

Lệnh cần build local `.next/static` và các khóa cấu hình để đối chiếu rò rỉ secret; không in hoặc gửi khóa cho khách. Nó kiểm tra một số route không đăng nhập và token sai, không gửi email, không kiểm tra việc Host xem mẫu của Host khác, giao diện hoặc RSVP đầy đủ. Vì vậy smoke đạt không thay thế các bước kiểm tra thủ công.

Chưa gửi email mời cho đến khi đăng nhập bằng tài khoản khách và nút xem trước trong Dashboard ra đúng ảnh của khách.

### 7.3. Nếu bản deploy mới có lỗi

Dừng bàn giao và gửi thư cho đơn bị ảnh hưởng. Khôi phục bản deploy đã xác nhận tốt hoặc đưa bản sửa lên sau khi kiểm tra. Nếu bản cũ chưa có key của khách mới, khách đó sẽ thấy mẫu không khả dụng sau rollback; phải có bản sửa chứa key mới trước khi tiếp tục bàn giao. Rollback code không khôi phục dữ liệu đã sửa trong Supabase hoặc file nhạc đã ghi đè; các phần đó cần bản sao lưu riêng.

## 8. Tạo tài khoản và sự kiện

Chưa có script cấp tài khoản. Làm trên Supabase của đúng project production.

### 8.1. Tạo user

Authentication → Users → Add user → Create user.

- Email là email khách sẽ dùng để đăng nhập.
- Bật xác nhận email ngay. Không có trang quên mật khẩu.
- Tạo mật khẩu riêng cho từng tài khoản, gửi qua kênh riêng. Không ghi vào Git, không dán vào file này. Đây là mật khẩu đăng nhập thông thường, không phải mật khẩu tự hết hạn sau một lần dùng.
- Trigger `on_auth_user_created` tự tạo `profiles` với `role = host`, `lifecycle_status = active`. Không đổi role cho khách.
- Copy User UID.

Email đã tồn tại thì không tạo user thứ hai. Một user không nhận event thứ hai: index `events_one_per_host` sẽ từ chối lần insert sau.

Nếu khách cũ đặt sự kiện mới, xử lý riêng theo mục 15 trước khi nhận đơn; không ghi đè event đang có lời mời hoặc phản hồi.

### 8.2. Tạo event

SQL Editor của project, không chạy bằng quyền của Host. Host không được insert event.

Ví dụ dưới đây cần thay UID, key và thông tin bằng dữ liệu khách đã duyệt. Nếu chưa có link bản đồ, dùng `NULL`; không đưa URL minh họa vào sự kiện thật.

```sql
INSERT INTO public.events (
  user_id,
  title,
  template_key,
  event_date,
  venue_name,
  venue_address,
  google_map_url
) VALUES (
  'USER_UID',
  'Lễ tốt nghiệp Nguyễn Mai Hoa',
  'graduation-hoa-mai',
  '2026-10-18T08:00:00+07:00',
  'Đại học Cần Thơ — Khu II',
  'Đường 3/2, Ninh Kiều, Cần Thơ',
  NULL
);
```

Ràng buộc đang có trong database và app:

- `template_key` tối đa 50 ký tự; người triển khai phải kiểm tra khớp key đã deploy, vì database không kiểm tra danh sách key trong source;
- `event_date` là timestamptz, giờ Việt Nam;
- timezone bị ép `Asia/Ho_Chi_Minh`;
- tiêu đề 1–255 ký tự sau khi trim;
- tên địa điểm tối đa 255 ký tự, địa chỉ tối đa 2000 ký tự, link map tối đa 2048 ký tự;
- link map để trống hoặc là HTTPS của `maps.google.com`, `maps.app.goo.gl`, hoặc `google.com` / `www.google.com` với path `/maps`;
- không điền `music_path` thủ công. Người triển khai tải nhạc qua Dashboard bằng tài khoản vừa cấp; cơ chế upload hiện có sẽ lưu đường dẫn;
- không cho Host đổi `template_key`. Muốn đổi mẫu sau này, deploy và kiểm tra key mới trước, sau đó mới sửa cột này bằng SQL Editor và kiểm tra lại thiệp.

Đăng nhập `/login` bằng tài khoản vừa tạo. Host vẫn vào được Dashboard, nhưng chưa có event thì chỉ thấy "Chưa có sự kiện" và không sửa thiệp được. Sau khi có event, lưu thông tin đã chốt và tải nhạc khách đã gửi. Mở lại preview để kiểm tra tiêu đề, ngày giờ, địa điểm, bản đồ, ảnh và nhạc. Nếu sửa nội dung tạm để thử, trả về đúng nội dung khách đã duyệt trước bàn giao.

## 9. Bàn giao

### 9.1. Điều kiện cách ly trước khi bàn giao nhiều khách

**Cần sửa code:** `src/app/preview/page.tsx` hiện cho Host đã đăng nhập dùng query `template` để chọn bất kỳ key đã đăng ký. Event vẫn lấy từ tài khoản của Host, nhưng ảnh và câu chuyện tĩnh có thể là của khách khác. Không gửi đường dẫn này cho khách không phải biện pháp kiểm soát truy cập.

Trước khi bàn giao nhiều khách, giới hạn preview production theo `template_key` của event thuộc Host đang đăng nhập; chỉ giữ chọn mẫu tùy ý cho môi trường thiết kế được kiểm soát. Host chưa có event không được xem nhầm mẫu riêng của khách khác. Kiểm tra bằng hai tài khoản test A/B: A không xem được mẫu B khi sửa query, và ngược lại. Việc này sửa kiểm soát truy cập, không yêu cầu đổi giao diện Dashboard. Tài liệu này chưa thực hiện thay đổi đó.

**Giới hạn tài nguyên công khai:** ảnh trong `public/templates/` truy cập được bằng URL trực tiếp. Nội dung viết trong component/config dùng ở preview phía trình duyệt cũng không nên được coi là dữ liệu bí mật. Nếu khách yêu cầu ảnh hoặc câu chuyện chỉ người có quyền mới xem được, phải thiết kế cách lưu và cấp quyền khác trước khi nhận yêu cầu đó. Sửa quyền ở route preview không tự bảo vệ file tĩnh hoặc nội dung đã đưa vào bundle.

### 9.2. Nội dung bàn giao

Gửi sau khi xem trước trên production đúng khách:

```text
Chào anh/chị [Tên],

Thiệp mời [Tên sự kiện] đã sẵn sàng theo nội dung và giao diện anh/chị đã duyệt.

Đăng nhập trang quản lý:
- https://nc-thiepmoi.netlify.app/login
- Email: [email]
- Mật khẩu: [mật khẩu riêng của tài khoản]

Anh/chị sửa được tiêu đề, ngày giờ, địa điểm, link Google Maps và nhạc MP3 (tối đa 10 MiB). Bấm lưu thì thiệp cập nhật theo. Ảnh, câu chuyện và bố cục không sửa trên trang này; cần đổi thì nhắn lại để em cập nhật.

Trên Dashboard, anh/chị thêm khách mời, gửi email thiệp và xem phản hồi. Mỗi người được mời chỉ xác nhận một lần. Hệ thống dùng chung hạn gửi email, nên nếu gửi số lượng lớn hãy báo trước.

Thiệp được duy trì đến [ngày đã thống nhất]. Khi cần đổi ảnh, giao diện hoặc hỗ trợ mật khẩu, anh/chị liên hệ lại qua [kênh hỗ trợ]. Chưa có chức năng tự đặt lại mật khẩu trên website.
```

Thay địa chỉ đăng nhập trong mẫu nếu site phục vụ khách khác site demo. Hướng dẫn Host dùng nút xem trước trên Dashboard. Link `/invite/{token}` cho phép người giữ link xem lời mời và phản hồi theo quy tắc hệ thống; không hứa link không thể bị chuyển tiếp.

## 10. Đổi ảnh hoặc câu chuyện sau khi đã giao

Với mẫu ở mục 6, sửa `configs/graduation-hoa-mai.ts` và ảnh trong `public/templates/graduation-hoa-mai/`. Với thiết kế riêng, sửa đúng component/config và tài nguyên của key đó. Kiểm tra, build và deploy theo mục 7, rồi nhờ Host mở lại xem trước. Chưa deploy thì production vẫn là bản cũ.

Không sửa `content.ts` để đổi một khách.

## 11. Lựa chọn 2 — Thiết kế giao diện riêng

Áp dụng cả với lễ tốt nghiệp khi khách muốn một giao diện hoàn toàn khác. Các file dưới đây là ví dụ cần tạo khi có đơn, chưa có sẵn trong dự án.

1. Chốt thiết kế và nội dung theo mục 5; dùng key riêng như `custom-hoa-mai`.
2. Tạo bộ giao diện trong `src/features/template/templates/clients/CustomHoaMai/`, ví dụ `index.tsx` và `styles.module.css`; ảnh ở `public/templates/custom-hoa-mai/`. Có thể đặt file đơn thay vì thư mục nếu mẫu nhỏ.
3. Dùng CSS Module hoặc selector có phạm vi riêng. Không sửa `template.css`, CSS Dashboard hoặc các selector toàn cục như `body`, `button`, `h1` chỉ để phục vụ một khách.
4. Component export nhận `TemplateProps`. Đọc ngày giờ, địa điểm, tiêu đề từ `invitation.event`; tên khách mời và lời nhắn từ `invitation`. Không ghi cứng các dữ liệu này vào thiết kế.
5. Trong `mode === 'guest'`, đặt `props.audioControl` và `props.responseArea` vào vị trí phù hợp. Preview dùng điều khiển nhạc xem trước và `MockRsvpForm` theo mẫu hiện có, không dùng hai props chỉ dành cho guest. Giữ nguyên xử lý RSVP, nhạc và gửi email của hệ thống.
6. Nếu đổi phong bì, cần phát triển cách chọn phong bì theo key tại cả luồng mời và preview; giữ phong bì hiện tại cho mẫu khác. Nếu chưa làm phần này, ghi rõ phong bì vẫn là mẫu chung trong thiết kế khách duyệt.
7. Đăng ký key trong cả `resolve-key.ts` và `registry.ts`, dùng loader import động trả về đúng component export. Kiểm tra điện thoại, máy tính, preview và luồng guest trên dữ liệu test trước khi deploy.
8. Deploy, cấp tài khoản và bàn giao theo mục 7–9. Đăng nhập, Dashboard, gửi thư mời và xem phản hồi giữ nguyên.

### Khi thêm loại sự kiện khác

Chưa làm mẫu cưới hay sinh nhật riêng. Khi có khách loại đó, thêm mẫu nền; không sửa luồng tài khoản.

Việc giữ nguyên:

- tạo user và một event như mục 8;
- Dashboard, email, RSVP, hạn 300 thư/ngày;
- quy tắc một `template_key` cho một khách.

Việc phải làm thêm:

1. Tạo component nền mới, ví dụ mẫu cưới, với CSS riêng nếu nền và ảnh trang trí khác tốt nghiệp. Không sửa `template.css` của mẫu tốt nghiệp để chiều một khách cưới.
2. Quyết định phong bì. `InvitationEntrance.tsx` đang là phong bì tốt nghiệp, dùng chung mọi link mời. Khách cưới sẽ thấy nón cử nhân trước khi vào thiệp nếu chưa tách phong bì theo loại sự kiện.
3. Đăng ký key mới trong cả `resolve-key.ts` và `registry.ts`.
4. Deploy key đó trước khi insert event.

Khách chỉ cần đổi chữ và ảnh trên bố cục có sẵn thì đi theo mục 6. Bản copy component là cách làm tạm với code hiện tại; hướng giảm sao chép khi có nhiều khách được nêu ở mục 1.3.

Thiết kế hoàn toàn khác bố cục thì vẫn là một component mới, nhưng phải đọc dữ liệu event từ props và giữ RSVP, nhạc theo đúng `TemplateProps`. Không viết form RSVP riêng. Không nhận `audioControl` ở mode preview.

## 12. Checklist trước khi gửi mật khẩu

- Key có trong `resolve-key.ts` và `registry.ts`, `npm run typecheck` sạch.
- Đã chốt dùng mẫu hay thiết kế riêng, khách duyệt nội dung/giao diện và thời hạn duy trì thiệp.
- Đã xác nhận đúng site, Supabase project và sender phục vụ khách thật; dữ liệu test được tách riêng.
- Thư mục ảnh đủ file mục 5 nếu dùng mẫu có sẵn, hoặc đủ ảnh theo thiết kế riêng; không ghi đè ảnh mẫu gốc hay khách khác.
- Preview local không còn tên hoặc ảnh của khách khác.
- Build đạt, smoke chỉ đọc đạt; các kiểm tra giao diện và luồng mời được thực hiện riêng theo mục 7.
- Đã xử lý quyền preview và kiểm tra cách ly bằng hai tài khoản test theo mục 9.1 trước bàn giao nhiều khách.
- Bản production đã deploy xong trước câu `INSERT`.
- Event dùng đúng key mới, không dùng hai key mẫu gốc.
- Đăng nhập bằng tài khoản khách, xem trước ra đúng tiêu đề và đúng ảnh.
- Ngày giờ, địa điểm, bản đồ và nhạc đúng nội dung đã chốt; không còn thông tin tạm để thử.
- Thiết kế riêng không làm đổi CSS/phong bì của mẫu khác; RSVP và điều khiển nhạc vẫn hoạt động.
- Kiểm thử RSVP bằng lời mời test riêng; không dùng token của khách mời thật để thử vì phản hồi chỉ ghi một lần.
- Đã kiểm tra hạn mức còn lại và lịch gửi chung; không gửi thư thử tới email của khách mời thật.
- Đã ghi nhận bản deploy có thể khôi phục và cách sao lưu dữ liệu/tài nguyên.
- Mật khẩu không nằm trong Git.

## 13. Không làm trong quy trình này

- Không mở đăng ký công khai, không làm trang quên mật khẩu, không làm `/system-admin`.
- Không cho một tài khoản hai sự kiện.
- Không để Host upload album hoặc đổi câu chuyện trên Dashboard.
- Không coi `graduation-floral-01` là mẫu tốt nghiệp riêng. Nó đang load cùng component với `wedding-floral-01`.
- Không chạy lệnh tạo khách hoặc tạo tài khoản chưa có trong `package.json`.

## 14. Tài nguyên miễn phí và kế hoạch nhận nhiều khách

Một dự án có 10 bộ giao diện là khả thi về tổ chức source. Có đủ hạn mức miễn phí hay không phụ thuộc số lần deploy, số thư, lượt xem, dung lượng ảnh/nhạc và tải đồng thời. Chưa có phép đo tải cho 10 khách trong lần rà soát này, nên không cam kết phục vụ miễn phí chỉ dựa trên số tài khoản.

Thông tin tham khảo đã kiểm tra ngày **26/09/2026**; trước khi nhận đơn phải xem gói và mức sử dụng thực tế trong tài khoản:

| Dịch vụ | Hạn mức công bố và ý nghĩa với dự án |
| --- | --- |
| Netlify Free theo credit | 300 credit/tháng; production deploy 15 credit/lần, băng thông 20 credit/GB, compute 10 credit/GB-giờ, request 2 credit/10.000 request. Gói legacy có thể khác. Hết hạn mức có thể khiến site tạm dừng. [Nguồn Netlify](https://www.netlify.com/pricing/) |
| Supabase Free | Database 500 MB, file storage 1 GB, egress 5 GB và cached egress 5 GB. Hai loại egress có hạn mức riêng, không coi là 10 GB dùng tùy ý. Project không hoạt động một tuần có thể bị tạm dừng. [Nguồn Supabase](https://supabase.com/pricing) |
| Brevo Free | 300 email/ngày cho tài khoản gửi, hạn mức không dùng hết không cộng dồn sang ngày sau. [Nguồn Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) |

Ảnh trong `public/templates/` được phục vụ qua Netlify; nhạc trong bucket `audio` được tải từ Supabase. Dung lượng lưu file và dữ liệu truyền cho người xem là hai khoản khác nhau.

Ví dụ tính toán, không phải số đo hệ thống:

- 10 khách × 100 thư = 1.000 thư: cần ít nhất 4 ngày nếu chỉ có 300 lượt/ngày và không phát sinh gửi lại hoặc thư khác. Code còn có trần 300 lượt giữ suất/ngày dùng chung trong `202609270001_mvp_email_ledger.sql`; nâng gói Brevo không tự nâng trần trong code.
- 10 khách × 100 người tải đủ một bài nhạc 5 MB ≈ 5 GB dữ liệu truyền. Mức thực tế còn tùy cache, nghe lại và lượng dữ liệu trình duyệt tải; kiểm tra cả cached lẫn uncached egress.
- 10 lần production deploy × 15 credit = 150 credit theo gói Netlify nêu trên, chưa tính traffic. Gom những thay đổi đã được duyệt vào cùng một deploy khi phù hợp; 10 bộ thiệp không bắt buộc tương ứng 10 deploy riêng.

Trước mỗi đợt gửi, kiểm tra usage của cả ba dịch vụ, lịch gửi của các khách và trạng thái site/database. Nếu mức còn lại không đủ cho đợt đã hẹn, điều chỉnh lịch hoặc nâng gói trước khi gửi. Không hứa hệ thống tự chia lịch, tự gửi tiếp ngày hôm sau hoặc tự nâng gói; quy trình này chưa có chức năng điều phối hạn mức giữa các khách.

## 15. Sau bàn giao và kết thúc sự kiện

### 15.1. Hồ sơ và sao lưu

Lưu hồ sơ đơn hàng ở nơi riêng: mã đơn, email Host, user/event ID, `template_key`, bản nội dung đã duyệt, ngày bàn giao, hạn duy trì và phiên bản deploy. Không ghi mật khẩu, secret hoặc danh sách token mời vào tài liệu công khai.

Trước khi thay đổi dữ liệu hoặc kết thúc dịch vụ, cần bản sao lưu database và bản sao tài nguyên ảnh/nhạc phù hợp phạm vi đã thống nhất. Source trong Git không thay thế backup Supabase Auth, dữ liệu RSVP hoặc Storage. Xác nhận cách khôi phục trên môi trường test trước khi coi bản sao lưu là dùng được. Tài liệu này chưa cung cấp script backup/restore tự động.

### 15.2. Hỗ trợ mật khẩu

Website chưa có luồng quên mật khẩu. Khi Host yêu cầu hỗ trợ, xác minh đúng chủ tài khoản rồi thực hiện đặt lại bằng công cụ quản trị Supabase phù hợp, gửi mật khẩu mới qua kênh riêng và kiểm tra đăng nhập. Không tìm hoặc gửi lại mật khẩu cũ từ log; không hứa mật khẩu được cấp tự hết hạn hay bắt buộc đổi ở lần đăng nhập đầu tiên.

### 15.3. Hết thời hạn duy trì

Chốt thời hạn với khách ngay từ lúc nhận đơn. Khi hết hạn, liên hệ theo thỏa thuận để gia hạn hoặc kết thúc; không tự xóa event chỉ vì ngày tổ chức đã qua.

Schema hiện chỉ có `lifecycle_status` là `active` hoặc `deleting`, chưa có trạng thái `archived` hay lịch tự hết hạn được triển khai trong quy trình này. Không dùng `deleting` như trạng thái lưu trữ tạm. Việc ngừng phục vụ/xóa cần quy trình riêng đã kiểm tra tác động tới user, event, lời mời, RSVP, sổ gửi và file Storage.

Chỉ bỏ key hoặc component khi không còn event cần dùng. Xóa ảnh khỏi bản deploy mới không bảo đảm ảnh đã biến mất khỏi lịch sử Git, bản deploy cũ hoặc bản sao lưu; nếu có yêu cầu xóa dữ liệu, phải kiểm tra các nơi giữ bản sao đó.

### 15.4. Khách cũ đặt sự kiện mới

Hiện database giới hạn một event cho mỗi user. Trước khi nhận đơn lặp lại, phải chọn và kiểm chứng cách xử lý phù hợp: kết thúc sự kiện cũ theo quy trình riêng, hoặc phát triển hỗ trợ nhiều sự kiện trong một yêu cầu khác. Không ghi đè sự kiện cũ đang hoạt động và không tự hứa một tài khoản quản lý nhiều sự kiện. Việc mở rộng này nằm ngoài quy trình tùy chỉnh giao diện hiện tại.
