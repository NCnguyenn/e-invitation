# Kế hoạch triển khai thiệp mời khách hàng

> **For agentic workers:** Khi được yêu cầu thực thi, dùng skill `subagent-driven-development` hoặc `executing-plans` có trong môi trường. Các bước dùng checkbox (`- [ ]`) để theo dõi tiến độ. Việc duyệt/sửa plan không phải lệnh deploy hoặc tạo tài khoản khách thật.

**Goal:** Chuẩn hóa việc nhận đơn, tạo đúng bộ giao diện và dữ liệu riêng cho từng khách, triển khai lên production, tạo tài khoản/event an toàn và bàn giao mà không làm lẫn dữ liệu giữa các khách.

**Architecture:** Giữ nguyên một ứng dụng Next.js, một Supabase project production và các luồng dùng chung cho đăng nhập, Dashboard, email, RSVP và nhạc. Mỗi event có một `template_key`; loader server đọc key này để nạp component giao diện tương ứng. Mẫu tốt nghiệp có sẵn dùng component copy theo key trong cấu trúc hiện tại; khi nhiều khách dùng cùng bố cục tốt nghiệp, tách mẫu nền nhận config là hướng cải tiến để tránh sao chép component. Phạm vi sản phẩm hiện tại chỉ là lễ tốt nghiệp.

**Tech Stack:** Next.js 16.3.6, React 19.3.0, TypeScript 7.0.2, Supabase Auth/Postgres/RLS/Storage, Brevo, Netlify, CSS hiện có, Node test runner.

**Spec:** `docs/QUY_TRINH_TRIEN_KHAI_KHACH_HANG.md`

**Trạng thái:** Plan đã sửa sau rà soát ngày 27/09/2026. Các bước chưa được đánh dấu hoàn thành; đoạn code dưới đây là implementation cần thực hiện, không phải chức năng đã có trong repository. Có thể làm phần nền tảng và QA bằng dữ liệu giả ngay; các bước theo đơn chỉ bắt đầu khi có đầu vào đã duyệt.

## Global Constraints

- Chỉ nhận khách thật sau khi đã xác định đúng site production, Supabase project, migrations, Brevo sender và `SITE_URL`; site deploy không đồng nghĩa đã nghiệm thu.
- Mỗi khách có đúng một Host, một event, một `template_key` và nhiều invitation token; không mở đăng ký công khai, không cho Host tự tạo event hoặc tự đổi mẫu.
- `template_key` tối đa 50 ký tự, không dấu, không khoảng trắng, phải đăng ký đồng thời trong `src/features/template/resolve-key.ts` và `src/features/template/registry.ts`.
- Không dùng lại `wedding-floral-01` hoặc `graduation-floral-01` cho khách mới. Hai key này cùng loader `loadWeddingFloral01`, cùng bố cục tốt nghiệp và nội dung Mai Hoa. Chữ `wedding` trong tên key không có nghĩa là thiệp cưới.
- Phạm vi đơn hàng của plan này chỉ là lễ tốt nghiệp: mẫu có sẵn hoặc thiết kế riêng cho tốt nghiệp. Không nhận, không chuẩn bị và không mở plan mẫu cưới, sinh nhật hay loại sự kiện khác từ quy trình này.
- Không sửa `src/features/template/content.ts` hoặc `public/templates/wedding-floral-01/` để phục vụ riêng một khách.
- Lời ngỏ thu từ khách chỉ lưu trong hồ sơ đơn. Mẫu tốt nghiệp gốc không có field lời ngỏ; câu chào đang cứng là `TRÂN TRỌNG KÍNH MỜI` trong `WeddingFloral01.tsx`. `invitation.invitationNote` là lời nhắn từng khách mời do Host nhập trên Dashboard, không phải lời ngỏ.
- Giữ nguyên hợp đồng `TemplateProps`; preview dùng `MockRsvpForm`, guest dùng `audioControl` và `responseArea`.
- Không sửa `template.css`, CSS Dashboard hoặc selector toàn cục chỉ để phục vụ một khách thiết kế riêng.
- Không dùng `EMAIL_TRANSPORT=stub` trên hosting; thư thử chỉ gửi tới hộp thư do người triển khai kiểm soát.
- Không ghi mật khẩu, secret hoặc danh sách token thật vào Git, plan, log hoặc hồ sơ công khai.
- Không chạy migration/script test vào database production có dữ liệu khách nếu chưa xác định rõ project đích.
- Không gửi mật khẩu hay link bàn giao trước khi bản production chứa key của khách và Host đã xem đúng preview.
- Khi thêm khách, giữ **tất cả** key/loader/test của các khách đã có, không chỉ hai key demo. Các object/tuple trong ví dụ là phần minh họa cần bổ sung vào file hiện tại, không dùng để ghi đè cả danh sách.
- Node test chỉ import module TypeScript thuần với đường dẫn có đuôi `.ts`; không import runtime `registry.ts`, component `.tsx`, CSS hoặc alias `@/`. Việc tải component thật phải đi qua Next.js build và kiểm tra route ở trình duyệt.
- Không tạo lời mời hoặc phản hồi thử trong event khách thật. Dùng Host/event QA riêng; RSVP QA không được xuất hiện trong danh sách hoặc thống kê của khách.
- Chỉ stage file thuộc task/đơn đang làm. Kiểm tra `git diff --cached --name-only` và `git diff --cached --check` trước mỗi commit; không dùng `git add` cả cây thư mục khách.

- `event_date` là `timestamptz` theo `Asia/Ho_Chi_Minh`; title 1–255 ký tự sau trim, `venue_name` tối đa 255, `venue_address` tối đa 2000, `google_map_url` tối đa 2048 và chỉ nhận HTTPS của `maps.google.com`, `maps.app.goo.gl`, hoặc `google.com`/`www.google.com` với path `/maps`.
- Không điền `music_path` thủ công. Upload qua Dashboard. Object là `music.mp3` trong bucket `audio`. Cột `music_path` phải đúng giá trị `canonicalAudioPath()` trong `src/lib/validation.ts`: `{user_id}/{event_id}/music.mp3`. Không ghi tiền tố `audio/` vào cột này. Chỉ nhận MP3 tối đa 10 MiB.
- Route riêng tư giữ `dynamic = 'force-dynamic'`, `revalidate = 0` và header `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`.
- Trên Next.js 16, page props `params` và `searchParams` là `Promise`; đọc bằng `await`.
- Rollback code không hoàn tác Auth, event, RSVP, sổ gửi hoặc Storage; các phần đó cần bản sao lưu riêng.
- Tên `graduation-hoa-mai`, `GraduationHoaMai` và `loadGraduationHoaMai` trong plan chỉ là ví dụ đặt tên. Khi làm đơn thật, thay bằng key và component đã chốt ở Task 1; không dùng nội dung Mai Hoa nếu đó không phải khách thực tế. Nền `bg-pattern-top.png` và `bg-wave-*.png` bị cứng trong `src/features/template/template.css`, trỏ `public/templates/wedding-floral-01/`. Copy các file nền vào thư mục khách không đổi nền, và không sửa các URL đó cho một khách.

## Phạm vi triển khai

### Trong phạm vi bắt buộc cho mỗi đơn hàng

1. Tiếp nhận và chốt loại dịch vụ tốt nghiệp: dùng mẫu tốt nghiệp có sẵn hoặc thiết kế giao diện tốt nghiệp riêng. Không nhận đơn cưới, sinh nhật hay sự kiện khác.
2. Thu thập, kiểm duyệt và lưu nội dung/ảnh/nhạc khách đã duyệt.
3. Tạo key riêng và bộ code/tài nguyên riêng cho khách.
4. Đăng ký key trong registry, kiểm tra typecheck/build và preview.
5. Xác nhận môi trường production, deploy code trước khi tạo event.
6. Tạo user Host và một event bằng công cụ quản trị đúng Supabase project.
7. Nhập dữ liệu event, upload nhạc qua Dashboard; kiểm tra guest/email/RSVP bằng Host/event QA riêng dùng cùng key giao diện.
8. Kiểm tra cách ly, giao diện responsive, email/RSVP/nhạc và mức usage trước khi bàn giao.
9. Gửi thông tin đăng nhập và hướng dẫn sử dụng qua kênh riêng.
10. Lưu hồ sơ đơn, phiên bản deploy, hạn duy trì và kế hoạch backup.

### Trong phạm vi phát triển nền tảng trước khi bàn giao nhiều khách

- Khóa việc Host đã đăng nhập dùng query `template` để xem mẫu của Host khác trong production.
- Kiểm thử cách ly bằng hai tài khoản Host A/B.
- Giữ khả năng preview tùy ý chỉ trong môi trường development/thiết kế được kiểm soát.

### Ngoài phạm vi kế hoạch này

- `/system-admin`, đăng ký công khai, quên mật khẩu trên website.
- Một tài khoản quản lý nhiều event.
- Host tự upload album, tự sửa câu chuyện hoặc tự chọn mẫu trên Dashboard.
- Script tự động tạo client/account chưa có trong `package.json`.
- Cơ chế tự chia lịch gửi khi vượt 300 email/ngày, tự nâng gói hoặc tự gia hạn.
- Trạng thái `archived`, lịch tự hết hạn, xóa/restore tự động.
- Bảo vệ tuyệt đối ảnh/nội dung đã nằm trong `public/templates/` hoặc bundle trình duyệt.
- Tách phong bì theo mẫu; phong bì hiện tại vẫn là phần dùng chung cho đến khi có yêu cầu phát triển riêng.
- Mẫu cưới, sinh nhật và mọi loại sự kiện không phải lễ tốt nghiệp. Không lập plan component nền cho các loại đó từ quy trình này.

## Bản đồ file và trách nhiệm

| Khu vực | File/thư mục | Trách nhiệm trong kế hoạch |
| --- | --- | --- |
| Hợp đồng template | `src/features/template/types.ts` | Giữ `TemplateProps` và hai mode `preview`/`guest`. |
| Chọn key | `src/features/template/resolve-key.ts` | Danh sách key hợp lệ và chuẩn hóa key. |
| Nạp component | `src/features/template/registry.ts` | Dynamic loader cho từng key. |
| Loader chung | `src/features/template/InvitationTemplate.tsx` | Nạp component theo `event.templateKey`; không đổi luồng guest. |
| Loader preview phía client | `src/features/template/ClientInvitationTemplate.tsx` | Dùng cùng registry qua React lazy; kiểm tra cả preview trong Dashboard, không chỉ trang `/preview`. |
| Mẫu gốc | `src/features/template/templates/WeddingFloral01.tsx` | Nguồn copy bố cục tốt nghiệp hiện tại. Tên file có chữ Wedding nhưng component đang là thiệp tốt nghiệp, không phải thiệp cưới. |
| Config khách | `src/features/template/configs/<key>.ts` | Nội dung chữ và hàm `asset()` riêng từng khách. |
| Component khách | `src/features/template/templates/clients/<Component>.tsx` | Bố cục copy cho mẫu có sẵn hoặc giao diện bespoke. |
| Ảnh khách | `public/templates/<key>/` | Ảnh riêng, không ghi đè asset mẫu gốc. |
| Preview | `src/app/preview/page.tsx` | Preview fixture ở development và preview event của Host. |
| Quyền preview | `src/features/events/preview-template-policy.ts` | Chính sách thuần: production chỉ cho Host xem `template_key` của event của mình. |
| Guest route | `src/app/invite/[token]/page.tsx` | Luồng mời thật, RSVP thật và nhạc thật; chỉ kiểm tra regression. |
| Event server | `src/features/events/server.ts` | Đọc event, upload/finalize/preview nhạc và giữ RLS. `music_path` hợp lệ là `{user_id}/{event_id}/music.mp3`, không có tiền tố `audio/`. |
| Kiểm tra deploy | `scripts/check-deploy.mjs` | Xác nhận biến môi trường production có đủ và hợp lệ. |
| Smoke production | `scripts/verify-production.mjs` | Task 4 bổ sung kiểm tra header của `/preview` không đăng nhập; Task 5 chạy trên đúng bản deploy. Preview có đăng nhập được kiểm tra riêng bằng trình duyệt. |
| Schema | `supabase/migrations/*.sql` | Đối chiếu ràng buộc event, user, invitation, RSVP và storage. |
| Kiểm thử | `tests/` | Test policy preview, luồng phong bì và các regression test liên quan. |
| Hồ sơ vận hành | Nơi lưu riêng ngoài Git | Mã đơn, email Host, UID/event ID, key, nội dung duyệt, deploy, hạn duy trì; không lưu mật khẩu/token. |

---

## Task 0: Chuẩn bị môi trường và chốt thứ tự thực thi

**Files:**
- Read: `AGENTS.md`, `package.json`, `tsconfig.json`, `netlify.toml`, `supabase/test-project.json`
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`, `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- Local only: cấu hình môi trường đã được Git ignore; không đưa secret vào plan hoặc log

**Produces:** Workspace có thể chạy lệnh, xác định rõ database test/production, tài khoản QA và điểm khôi phục. Không cần dữ liệu khách thật để thực hiện Task 4.

- [x] **Step 1: Kiểm tra công cụ và thay đổi có sẵn**

```powershell
node --version
npm --version
git status --short
git diff --cached --name-only
```

Dùng Node 24.x nhất quán với `netlify.toml` và khả năng chạy `.ts` thuần trong Node test. Nếu npm lỗi đường dẫn cài đặt, xử lý công cụ trước khi chạy build, không đánh dấu test/build đạt vì lệnh không chạy. Không reset, ghi đè hoặc đưa các sửa đổi có sẵn của người khác vào commit của task.

- [ ] **Step 2: Chuẩn bị hai bộ cấu hình tách biệt**

Ghi nhận project ID/URL, tình trạng migrations/RLS/bucket `audio`, sender và site tương ứng trong hồ sơ riêng. Môi trường test dùng Supabase test, không có dữ liệu khách. Môi trường production chỉ dùng cho bản deploy phục vụ khách và các tài khoản QA do người triển khai quản lý.

Với kiểm tra A/B local, dùng `.env.production.local` đã được Git ignore, nối **database test**, đặt `EMAIL_TRANSPORT=brevo`. Không đặt `NODE_ENV=test` và không dùng `stub` khi chạy `next start`. Không in các giá trị secret. Kiểm tra biến từ terminal vì `process.env` có thể ưu tiên hơn file môi trường.

```powershell
git check-ignore .env.production.local
```

Expected: file được ignore. Nếu không, dùng cơ chế cấu hình riêng an toàn trước khi tiếp tục. Không đồng thời chạy hai cấu hình khác nhau trên cùng thư mục build `.next`. Sau khi chuyển project test sang production phải build lại, vì `NEXT_PUBLIC_*` được gắn vào bản build.

- [ ] **Step 3: Quy định dữ liệu QA và bằng chứng**

Chuẩn bị Host QA A/B với email do người triển khai kiểm soát, mỗi user một event, key khác nhau; thêm Host QA C chưa có event để kiểm tra trường hợp thiếu event. Task 4 có thể dùng hai key demo sẵn có để kiểm tra chặn query; lúc nghiệm thu đơn, QA dùng key mới để kiểm tra component thật. Tạo user/event QA bằng cùng quy tắc quản trị ở Task 6, nhưng dùng dữ liệu giả và không gửi thông tin đăng nhập cho khách.

Invitation, RSVP và nhạc thử chỉ nằm trong event QA. Tài khoản QA production, nếu dùng, vẫn tuân thủ cùng quyền Host; không thêm đường bypass bảo mật. Giữ hồ sơ QA riêng và kiểm soát quyền truy cập. Không tự xóa/reset event hoặc sổ gửi để làm sạch số liệu.

- [x] **Step 4: Chốt trình tự và điều kiện bàn giao**

- Chuẩn bị nền tảng: **Task 0 → Task 4**. Thực hiện một lần, chạy lại regression khi có thay đổi liên quan.
- Mỗi đơn: **Task 1 → Task 2 hoặc 3 → Task 5 → Task 6 → Task 7**; Task 8 dùng sau bàn giao.
- Chưa có khách thật: dừng ở kết quả nền tảng/QA, không tự tạo một đơn khách từ dữ liệu ví dụ.
- Task 9 là ranh giới phạm vi; tách mẫu chung nhận config chưa được triển khai trong plan này. Cách copy component vẫn là phương án làm thủ công cho đơn hiện tại.

## Task 1: Chốt đơn hàng và đầu vào triển khai

**Files:**
- Read: `docs/QUY_TRINH_TRIEN_KHAI_KHACH_HANG.md`
- Create outside Git: hồ sơ đơn hàng theo quy định nội bộ
- Modify: không sửa source ở task này

**Produces:** Một phiếu đầu vào đã được khách xác nhận, đủ để triển khai mà không tự suy đoán nội dung.

- [ ] **Step 1: Chốt loại dịch vụ**

Ghi rõ một trong hai lựa chọn. Cả hai đều là lễ tốt nghiệp:

- **Mẫu có sẵn:** giữ bố cục tốt nghiệp, thay nội dung/ảnh/nhạc/địa điểm/thời gian.
- **Thiết kế riêng:** vẫn là thiệp tốt nghiệp. Chốt bố cục, màu, font, hiệu ứng, hình tham khảo, các phần cần có và việc có đổi phong bì hay không.

Không nhận đơn cưới, sinh nhật hoặc sự kiện khác. Ghi thêm số vòng chỉnh sửa, chi phí, hạn bàn giao, ngày hết hạn duy trì và kênh hỗ trợ. Trước khi cấp tài khoản, gửi ảnh chụp hoặc video để khách duyệt. Không gửi đường `/preview?template=` cho khách.

- [ ] **Step 2: Thu đủ dữ liệu bắt buộc**

Xác nhận với khách:

```text
Tên người tốt nghiệp/sự kiện:
Tiêu đề sự kiện:
Ngày giờ theo giờ Việt Nam (Asia/Ho_Chi_Minh):
Tên địa điểm:
Địa chỉ:
Link Google Maps hoặc xác nhận không dùng:
Email đăng nhập Dashboard:
Lời ngỏ:
Nội dung câu chuyện:
Lời cảm ơn:
Ảnh đã được phép sử dụng:
Nhạc MP3 <= 10 MiB hoặc xác nhận không dùng:
Số khách mời dự kiến:
Ngày bắt đầu gửi thư:
Ngày cần giữ thiệp hoạt động:
```

Với mẫu tốt nghiệp có sẵn, lời ngỏ chỉ lưu hồ sơ. Không thêm field lời ngỏ vào config và không sửa câu chào cứng `TRÂN TRỌNG KÍNH MỜI`, trừ khi khách bắt buộc in lời ngỏ lên thiệp. Khi đó ghi đây là sửa component copy của khách, không sửa `content.ts`.

Kiểm đủ `hero-portrait.webp`, `story-portrait.webp`, `gallery-1.webp` đến `gallery-6.webp`, `marquee-1.webp` đến `marquee-4.webp` và `thank-you-banner.webp`. Xuất WebP, mục tiêu dưới 300 KB/ảnh. Ảnh trang trí mà component gọi qua `asset()` là `corner-leaf.png`, `cap-icon.png`, `flower-decor.png`, `spin-badge.png` và `sparkle.png`; lấy từ mẫu chung nếu khách không yêu cầu đổi. Nền `bg-pattern-top.png` và `bg-wave-*.png` không copy để đổi nền, vì `template.css` vẫn đọc chúng từ `public/templates/wedding-floral-01/`.

- [ ] **Step 3: Tạo và kiểm tra key**

Chuẩn hóa slug từ tên khách bằng chữ thường, không dấu, nối bằng gạch ngang. Dùng một trong các dạng:

```text
graduation-<slug>   # lễ tốt nghiệp, mẫu có sẵn
custom-<slug>       # lễ tốt nghiệp, giao diện hoàn toàn riêng
```

Không tạo key `wedding-*`, `birthday-*` hoặc key loại sự kiện khác. Plan này không có mẫu nền cưới hay sinh nhật.

Kiểm tra độ dài tối đa 50 ký tự và chưa trùng key đang dùng. Nếu trùng tên, thêm mã đơn ngắn, ví dụ `graduation-hoa-mai-002`. Không dùng tên Mai Hoa hoặc key mẫu gốc nếu đó không phải khách thực tế.

- [ ] **Step 4: Lưu bằng chứng duyệt**

Lưu nội dung, danh sách ảnh, bản thiết kế và các thay đổi đã duyệt trong hồ sơ đơn hàng riêng. Không lưu mật khẩu, secret hoặc danh sách token invitation trong hồ sơ này.

**Gate:** Chỉ chuyển sang Task 2 hoặc Task 3 khi dữ liệu đã đủ, key đã chốt và khách đã duyệt phạm vi.

## Task 2: Triển khai khách dùng mẫu tốt nghiệp có sẵn

**Files:**
- Create: `src/features/template/configs/<key>.ts`
- Create: `src/features/template/templates/clients/GraduationHoaMai.tsx`
- Create: `public/templates/<key>/hero-portrait.webp`
- Create: `public/templates/<key>/story-portrait.webp`
- Create: `public/templates/<key>/gallery-1.webp` … `gallery-6.webp`
- Create: `public/templates/<key>/marquee-1.webp` … `marquee-4.webp`
- Create: `public/templates/<key>/thank-you-banner.webp`
- Copy if needed: asset trang trí từ `public/templates/wedding-floral-01/`
- Modify: `src/features/template/resolve-key.ts`
- Modify: `src/features/template/registry.ts`
- Test: `tests/template-keys.test.mjs`

**Interfaces:**
- Consumes: nội dung/ảnh đã duyệt từ Task 1 và `TemplateProps` từ `src/features/template/types.ts`.
- Produces: key đã đăng ký, config riêng, component riêng và thư mục asset độc lập để `InvitationTemplate` có thể load ở preview/guest.

- [ ] **Step 1: Kiểm tra key bằng Node, kiểm tra loader bằng Next.js**

Tạo `tests/template-keys.test.mjs` hoặc thêm test vào file hiện có. Chỉ import `resolve-key.ts`, không import `registry.ts` hoặc component `.tsx`. Ghi đủ các key đang hoạt động trước khi thêm khách vào `existingKeys`; hai key dưới đây là baseline hiện tại, phải bổ sung các key của đơn trước khi chạy plan lần sau. Không tạo baseline bằng cách đọc chính danh sách sau khi đã sửa vì sẽ bỏ sót key bị xóa nhầm.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const keys = await import('../src/features/template/resolve-key.ts');

test('graduation-hoa-mai resolves while existing keys remain usable', () => {
  const existingKeys = ['wedding-floral-01', 'graduation-floral-01'];
  assert.equal(keys.resolveTemplateKey('  graduation-hoa-mai '), 'graduation-hoa-mai');
  assert.equal(keys.resolveTemplateKey('not-registered'), null);
  for (const key of existingKeys) assert.equal(keys.resolveTemplateKey(key), key);
  assert.equal(new Set(keys.REGISTERED_TEMPLATE_KEYS).size, keys.REGISTERED_TEMPLATE_KEYS.length);
});
```

Thay key ví dụ bằng key của đơn; khi thêm test vào file cũ, không lặp lại các import/biến module đã có.

```powershell
node --test tests/template-keys.test.mjs
```

Expected: FAIL assertion trước khi đăng ký key, PASS sau khi thêm key mà vẫn giữ các key cũ. Test này không xác minh component render. `npm run typecheck`, `npm run build`, preview trong Dashboard và guest route qua Next.js ở Task 5 xác minh import/export, TSX, CSS và component thật.

- [ ] **Step 2: Tạo thư mục asset riêng**

Tạo `public/templates/<key>/`. Đặt ảnh khách vào thư mục này. Tuyệt đối không ghi đè `public/templates/wedding-floral-01/`.

Copy vào thư mục khách đúng các file trang trí mà component mới sẽ gọi qua `asset()`:

- `corner-leaf.png`
- `cap-icon.png`
- `flower-decor.png`
- `spin-badge.png`
- `sparkle.png`

Không copy `bg-pattern-top.png` hay `bg-wave-*.png` với kỳ vọng đổi nền. `src/features/template/template.css` vẫn trỏ các URL đó vào `public/templates/wedding-floral-01/`. Không sửa các URL đó cho một khách. Nếu khách bắt buộc đổi nền, đơn này không còn là mẫu có sẵn; chuyển Task 3 hoặc ghi rõ phần nền chưa làm.

Kiểm tra tên file đúng chữ thường và khớp từng lời gọi `asset('...')` sau khi copy. Không đưa ảnh khách vào `images/` để chạy `scripts/prepare-template-assets.mjs`, vì script đó copy asset mẫu chung.

- [ ] **Step 3: Viết config nội dung riêng**

Tạo config theo mẫu sau, thay toàn bộ giá trị bằng nội dung khách đã duyệt:

```ts
const asset = (file: string) => `/templates/graduation-hoa-mai/${file}`;

export const content = {
  ownerName: '<Tên đúng cần in trên thiệp>',
  badge: 'GRADUATION',
  subtitle: 'Ceremony',
  storyHeading: '<Tiêu đề câu chuyện>',
  story: ['<Đoạn câu chuyện đã duyệt>'],
  gallery: [
    { src: asset('gallery-1.webp'), caption: '<Chú thích 1>' },
    { src: asset('gallery-2.webp'), caption: '<Chú thích 2>' },
    { src: asset('gallery-3.webp'), caption: '<Chú thích 3>' },
    { src: asset('gallery-4.webp'), caption: '<Chú thích 4>' },
    { src: asset('gallery-5.webp'), caption: '<Chú thích 5>' },
    { src: asset('gallery-6.webp'), caption: '<Chú thích 6>' },
  ],
  thankYou: '<Lời cảm ơn đã duyệt>',
};

export { asset };
```

`badge` và `subtitle` là chữ trên ảnh chính; tiêu đề sự kiện, ngày giờ, địa điểm và bản đồ vẫn lấy từ `invitation.event` để Host sửa được trên Dashboard. Config chỉ có các field mà `WeddingFloral01.tsx` đang đọc từ `content`: `ownerName`, `badge`, `subtitle`, `storyHeading`, `story`, `gallery`, `thankYou`. Không thêm field lời ngỏ. Câu chào `TRÂN TRỌNG KÍNH MỜI` giữ nguyên, trừ khi Task 1 đã ghi khách bắt buộc in lời ngỏ; khi đó sửa đúng component copy của khách, không sửa `content.ts`.

- [ ] **Step 4: Copy component và sửa import**

Copy `src/features/template/templates/WeddingFloral01.tsx` thành `src/features/template/templates/clients/GraduationHoaMai.tsx`. Đổi export thành:

```ts
export function GraduationHoaMai(props: TemplateProps) {
```

Do file mới sâu hơn một cấp, đổi import tương đối như sau:

```ts
import { AudioPlayer } from '../../AudioPlayer';
import { HostAudioPreviewControl } from '@/features/events/HostAudioPreviewControl';
import { Countdown } from '../../Countdown';
import { Gallery } from '../../Gallery';
import { MockRsvpForm } from '../../MockRsvpForm';
import { eventCalendar } from '../../date';
import { asset, content } from '../../configs/graduation-hoa-mai';
import type { TemplateProps } from '../../types';
import '../../fonts.css';
import '../../template.css';
```

Không bỏ hai dòng `HostAudioPreviewControl` và `TemplateProps`. File mới sâu hơn một cấp nên `../types` thành `../../types`. Không copy `template.css`, không thêm Tailwind.

- [ ] **Step 5: Giữ đúng hai mode**

Giữ nguyên các hành vi sau trong component:

```tsx
{props.mode === 'preview' ? (
  isHostOrDesigner
    ? <HostAudioPreviewControl hasMusic={event.hasMusic} sourceKey={props.musicVersion} />
    : <AudioPlayer hasMusic={false} />
) : (
  props.audioControl
)}
```

Và ở RSVP:

```tsx
{mode === 'preview' ? (
  <MockRsvpForm guestName={invitation.guestName} />
) : (
  props.responseArea
)}
```

Không hard-code `event.title`, `event.eventDate`, `event.venueName`, `event.venueAddress`, `event.googleMapUrl`, `invitation.guestName` hoặc `invitation.invitationNote`. Không tạo form RSVP mới.

- [ ] **Step 6: Đăng ký key ở hai nơi**

Trong `src/features/template/resolve-key.ts`, thêm key vào tuple:

```ts
export const REGISTERED_TEMPLATE_KEYS = [
  'wedding-floral-01',
  'graduation-floral-01',
  'graduation-hoa-mai',
] as const;
```

Trong `src/features/template/registry.ts`, thêm loader động và mapping:

```ts
async function loadGraduationHoaMai() {
  const loaded = await import('./templates/clients/GraduationHoaMai');
  return loaded.GraduationHoaMai;
}

const LOADERS: Record<RegisteredTemplateKey, TemplateLoader> = {
  'wedding-floral-01': loadWeddingFloral01,
  'graduation-floral-01': loadWeddingFloral01,
  'graduation-hoa-mai': loadGraduationHoaMai,
};
```

Thay `graduation-hoa-mai`, `GraduationHoaMai` và `loadGraduationHoaMai` bằng key và component đã chốt ở Task 1. Giữ hai key gốc. Không import tĩnh toàn bộ mẫu vào Dashboard.

- [ ] **Step 7: Chạy kiểm tra code**

```powershell
node --test tests/template-keys.test.mjs
npm run typecheck
npm run build
```

Expected: cả hai lệnh thành công; không có lỗi import tương đối, export component hoặc `TemplateProps`.

- [ ] **Step 8: Xem trên máy trước khi deploy**

```powershell
npm run dev
```

Mở `http://localhost:3000/preview?template=graduation-hoa-mai` khi `NODE_ENV=development`. Trên production, người chưa đăng nhập vào `/preview` bị `notFound()`.

Kiểm tra điện thoại và máy tính:

- đủ ảnh, không vỡ đường dẫn, gồm cả ảnh trang trí đã copy và nền vẫn lấy từ thư mục mẫu gốc;
- tên và câu chuyện là của khách này, không còn chữ hoặc ảnh khách khác;
- câu chào vẫn là `TRÂN TRỌNG KÍNH MỜI` nếu khách không bắt buộc in lời ngỏ;
- phong bì vẫn mở được;
- khi chưa đăng nhập, lịch và đồng hồ lấy ngày từ fixture demo;
- nếu đăng nhập Host có event, lịch và đồng hồ lấy dữ liệu event của Host đó; query `template` chỉ đổi mẫu, không đổi event đang xem;
- tên dài, ảnh dọc/ngang và phần nhạc hiển thị đúng;
- preview không gửi RSVP thật.

Sửa chữ hoặc ảnh trong `src/features/template/configs/graduation-hoa-mai.ts` và `public/templates/graduation-hoa-mai/`. Không sửa `src/features/template/content.ts` hoặc `public/templates/wedding-floral-01/`.

- [ ] **Step 9: Commit trước khi sang task khác**

```powershell
git add -- src/features/template/configs/graduation-hoa-mai.ts src/features/template/templates/clients/GraduationHoaMai.tsx src/features/template/resolve-key.ts src/features/template/registry.ts tests/template-keys.test.mjs public/templates/graduation-hoa-mai
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add graduation client template"
```

Thay các đường dẫn ví dụ bằng đúng key/component của đơn. Chỉ commit file của key này và phần đăng ký/test liên quan. Nếu file dùng chung có thay đổi của việc khác, stage từng hunk phù hợp, không stage cả file. Dừng commit nếu danh sách staged có `.env`, dữ liệu chưa duyệt hoặc file ngoài task; không tự reset thay đổi có sẵn.

**Gate:** Chỉ tiếp tục khi component của khách hiển thị được bằng key riêng và không có chữ/ảnh khách khác.

## Task 3: Triển khai giao diện tốt nghiệp hoàn toàn riêng (nhánh thay thế Task 2)

Chỉ dùng khi khách tốt nghiệp không giữ bố cục mẫu có sẵn. Không dùng task này để làm thiệp cưới, sinh nhật hay sự kiện khác. Người làm task này không cần mở Task 2; đoạn đăng ký key nằm đủ ở Step 6.

**Files:**
- Create: `src/features/template/templates/clients/CustomHoaMai/index.tsx`
- Create: `src/features/template/templates/clients/CustomHoaMai/styles.module.css`
- Create: `public/templates/custom-hoa-mai/` và ảnh theo thiết kế đã duyệt
- Modify: `src/features/template/resolve-key.ts`
- Modify: `src/features/template/registry.ts`
- Test: `tests/template-keys.test.mjs`, `npm run typecheck`, `npm run build`

**Interfaces:**
- Consumes: `TemplateProps` và dữ liệu đã duyệt từ Task 1.
- Produces: một component bespoke export đúng tên, load động theo key và không làm thay đổi template khác.

- [ ] **Step 1: Viết test key và xác nhận thất bại trước**

Tạo `tests/template-keys.test.mjs` hoặc thêm test mới, không ghi đè test các key cũ. Thay key ví dụ bằng key của đơn và cập nhật `existingKeys` từ danh sách trước khi sửa. Không import runtime registry/TSX/CSS bằng Node:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const keys = await import('../src/features/template/resolve-key.ts');

test('custom-hoa-mai resolves while existing keys remain usable', () => {
  const existingKeys = ['wedding-floral-01', 'graduation-floral-01'];
  assert.equal(keys.resolveTemplateKey('  custom-hoa-mai '), 'custom-hoa-mai');
  assert.equal(keys.resolveTemplateKey('not-registered'), null);
  for (const key of existingKeys) assert.equal(keys.resolveTemplateKey(key), key);
  assert.equal(new Set(keys.REGISTERED_TEMPLATE_KEYS).size, keys.REGISTERED_TEMPLATE_KEYS.length);
});
```

```powershell
node --test tests/template-keys.test.mjs
```

Expected trước khi thêm key: FAIL assertion vì key mới chưa được đăng ký, không phải lỗi import. Sau Step 6, chạy lại test phải PASS. Khi file đã có test của khách cũ, giữ toàn bộ test/import cũ và chỉ thêm test mới.

- [ ] **Step 2: Tạo component nhận `TemplateProps`**

Component phải đọc dữ liệu động theo hợp đồng:

```tsx
import type { TemplateProps } from '../../../types';

export function CustomHoaMai(props: TemplateProps) {
  const { invitation, mode } = props;
  const { event } = invitation;
  // event.title, event.eventDate, event.venueName, event.venueAddress,
  // event.googleMapUrl, invitation.guestName, invitation.invitationNote
  // luôn lấy từ props.
}
```

- [ ] **Step 3: Cô lập CSS**

Dùng CSS Module hoặc selector có prefix riêng cho component. Không viết selector toàn cục `body`, `button`, `h1`; không sửa `src/features/template/template.css` để phục vụ một khách. Kiểm tra component render cạnh mẫu gốc mà không đổi màu, font, phong bì hoặc layout của mẫu gốc.

- [ ] **Step 4: Tích hợp mode preview/guest**

Trong `mode === 'guest'`, đặt `props.audioControl` và `props.responseArea` vào vị trí đã chốt. Trong `mode === 'preview'`, dùng điều khiển nhạc preview và `MockRsvpForm`; không đọc hai prop guest ở preview.

- [ ] **Step 5: Xử lý yêu cầu đổi phong bì**

Nếu chưa phát triển cơ chế phong bì theo key, ghi rõ trong nội dung duyệt rằng phong bì vẫn là mẫu chung. Nếu khách bắt buộc phong bì riêng, lập task nền tảng riêng để tách `InvitationEntrance` theo key ở cả `/invite/[token]` và `/preview`; không sửa phong bì chung chỉ cho một khách.

- [ ] **Step 6: Đăng ký, kiểm thử và chặn phạm vi**

Đăng ký key đã chốt ở Task 1. Ví dụ dưới đây dùng `custom-hoa-mai`, `CustomHoaMai` và `loadCustomHoaMai`. Thay cả ba tên bằng key và component của đơn. Không giữ tên ví dụ nếu đó không phải khách thật.

Trong `src/features/template/resolve-key.ts`, thêm key vào tuple và giữ hai key gốc. Không thêm key cưới hoặc sinh nhật:

```ts
export const REGISTERED_TEMPLATE_KEYS = [
  'wedding-floral-01',
  'graduation-floral-01',
  'custom-hoa-mai',
] as const;
```

Trong `src/features/template/registry.ts`, thêm loader động. Nếu file là `templates/clients/CustomHoaMai/index.tsx`, import `./templates/clients/CustomHoaMai`. Không import tĩnh mẫu vào Dashboard:

```ts
async function loadCustomHoaMai() {
  const loaded = await import('./templates/clients/CustomHoaMai');
  return loaded.CustomHoaMai;
}

const LOADERS: Record<RegisteredTemplateKey, TemplateLoader> = {
  'wedding-floral-01': loadWeddingFloral01,
  'graduation-floral-01': loadWeddingFloral01,
  'custom-hoa-mai': loadCustomHoaMai,
};
```

```powershell
node --test tests/template-keys.test.mjs
npm run typecheck
npm run build
```

Expected: key mới và mọi key cũ PASS; typecheck/build thành công. Xác minh loader/render qua Next.js ở Task 5, không import runtime registry/TSX/CSS bằng Node.

Kiểm tra trên điện thoại và máy tính: ảnh, font, overflow, CTA bản đồ, nhạc, RSVP, phong bì và nội dung dài. Kiểm tra lại mẫu gốc sau khi build để xác nhận CSS không bị ảnh hưởng. Nếu Task 1 bắt buộc in lời ngỏ, chữ đó phải nằm trong component của key này, không nằm trong `content.ts`.

```powershell
git add -- src/features/template/templates/clients/CustomHoaMai src/features/template/resolve-key.ts src/features/template/registry.ts tests/template-keys.test.mjs public/templates/custom-hoa-mai
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add custom graduation template"
```

Thay đường dẫn theo đơn thực tế; chỉ stage config riêng nếu đã tạo cho đơn này. Nếu file registry/test đang có thay đổi của task khác, stage từng hunk. Không commit `.env`, mật khẩu, token hoặc file của khách khác.

**Gate:** Giao diện đạt preview local và không ảnh hưởng mẫu khác. Trước deploy production, Task 5 phải xác minh guest bằng token thuộc event QA trên database test; không phụ thuộc vào việc tạo event khách thật ở Task 6.

## Task 4: Khóa cách ly preview trước khi bàn giao nhiều khách

Thực hiện sau Task 0, trước khi triển khai đơn đầu tiên. Đây là công việc nền tảng dùng lại cho mọi đơn, không lặp lại việc tạo policy khi thêm từng khách.

**Files:**
- Create: `src/features/events/preview-template-policy.ts`
- Create: `tests/preview-access.test.mjs`
- Modify: `src/app/preview/page.tsx`
- Modify: `scripts/verify-production.mjs`
- Verify: `src/features/auth/server.ts`, `src/features/events/server.ts`, `src/features/template/resolve-key.ts`, `src/features/template/preview.fixture.ts`

**Interfaces:**
- Consumes: `getVerifiedHost()`, `readPreviewEvent(host.userId)`, `resolveTemplateKey()`, `previewInvitation.event.templateKey`.
- Produces: `decidePreviewTemplate(input, resolveKey): PreviewTemplateDecision` với `status` là `selected`, `unavailable` hoặc `not_found`. `resolveKey` do page/test truyền vào; policy không có runtime import alias hay module cần bundler.

- [x] **Step 1: Viết test policy thất bại trước**

Tạo `tests/preview-access.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

const { decidePreviewTemplate: decide } = await import('../src/features/events/preview-template-policy.ts');
const { resolveTemplateKey } = await import('../src/features/template/resolve-key.ts');
const decidePreviewTemplate = (input) => decide(input, resolveTemplateKey);

const base = {
  requestedKey: undefined,
  ownEventKey: undefined,
  fallbackKey: 'wedding-floral-01',
};

test('anonymous production preview is not found', () => {
  assert.deepEqual(decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: false }), { status: 'not_found' });
});

test('production host cannot select another registered template', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: ' graduation-floral-01 ', ownEventKey: 'wedding-floral-01' }),
    { status: 'unavailable' },
  );
});

test('production host uses its own template when the query is absent or identical', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey: 'wedding-floral-01' }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: ' wedding-floral-01 ', ownEventKey: 'wedding-floral-01' }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
});

test('development designer can select a registered template without an event', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false, requestedKey: 'graduation-floral-01' }),
    { status: 'selected', templateKey: 'graduation-floral-01' },
  );
});

test('production host without an event cannot inspect a client template', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, requestedKey: 'graduation-floral-01' }),
    { status: 'unavailable' },
  );
});

test('an unregistered template is unavailable', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false, requestedKey: 'not-registered' }),
    { status: 'unavailable' },
  );
});

test('production does not fall back when the host event is missing or invalid', () => {
  for (const ownEventKey of [undefined, '', 'not-registered']) {
    assert.deepEqual(
      decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey }),
      { status: 'unavailable' },
    );
  }
});

test('an explicit blank query is unavailable', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: false, hasHost: true, ownEventKey: 'wedding-floral-01', requestedKey: '  ' }),
    { status: 'unavailable' },
  );
});

test('development uses the fixture only when no key is requested or owned', () => {
  assert.deepEqual(
    decidePreviewTemplate({ ...base, isDevelopment: true, hasHost: false }),
    { status: 'selected', templateKey: 'wedding-floral-01' },
  );
  assert.deepEqual(
    decidePreviewTemplate({ ...base, fallbackKey: undefined, isDevelopment: true, hasHost: false }),
    { status: 'unavailable' },
  );
});
```

- [x] **Step 2: Chạy test để xác nhận thiếu policy**

```powershell
node --test tests/preview-access.test.mjs
```

Expected: FAIL vì `preview-template-policy.ts` chưa tồn tại.

- [x] **Step 3: Implement policy và nối vào preview page**

Tạo `src/features/events/preview-template-policy.ts`:

```ts
import type { RegisteredTemplateKey } from '../template/resolve-key';

export type PreviewTemplateDecision =
  | { status: 'selected'; templateKey: RegisteredTemplateKey }
  | { status: 'unavailable' }
  | { status: 'not_found' };

export function decidePreviewTemplate(input: {
  isDevelopment: boolean;
  hasHost: boolean;
  requestedKey?: string | null;
  ownEventKey?: string | null;
  fallbackKey?: string | null;
}, resolveKey: (key?: string | null) => RegisteredTemplateKey | null): PreviewTemplateDecision {
  if (!input.isDevelopment && !input.hasHost) return { status: 'not_found' };

  const requestedWasPresent = typeof input.requestedKey === 'string';
  const requested = requestedWasPresent ? resolveKey(input.requestedKey) : null;
  if (requestedWasPresent && !requested) return { status: 'unavailable' };

  const own = resolveKey(input.ownEventKey);
  if (!input.isDevelopment) {
    if (!own || (requested && requested !== own)) return { status: 'unavailable' };
    return { status: 'selected', templateKey: own };
  }

  const selected = requested ?? own ?? resolveKey(input.fallbackKey);
  return selected ? { status: 'selected', templateKey: selected } : { status: 'unavailable' };
}
```

Policy chỉ import type (Node sẽ loại bỏ), còn test truyền resolver từ import `.ts` thuần. Không cần sửa `tsconfig.json` để bật import `.ts` trong source. `fallbackKey` là optional vì `HostEvent.templateKey` trong `src/lib/contracts.ts` cũng optional.

Trong `src/app/preview/page.tsx`, thêm `import { decidePreviewTemplate } from '@/features/events/preview-template-policy';` và giữ import `resolveTemplateKey` để truyền vào policy. Thay cả khối sau, không xóa riêng biểu thức `override ??` rồi để nhánh cũ:

```tsx
  const params = await searchParams;
  if (params.template !== undefined && !resolveTemplateKey(params.template)) {
    return <TemplateUnavailable />;
  }
  const override = resolveTemplateKey(params.template);
  const ownEvent = host ? await readPreviewEvent(host.userId) : null;
  const templateKey = override ?? resolveTemplateKey(ownEvent?.templateKey ?? previewInvitation.event.templateKey);
  if (!templateKey) return <TemplateUnavailable />;
```

Thay bằng đoạn dưới. Vẫn đọc `ownEvent` sau khi có `host`. Không còn biến `override`:

```tsx
  const params = await searchParams;
  const ownEvent = host ? await readPreviewEvent(host.userId) : null;
  const decision = decidePreviewTemplate({
    isDevelopment: isDev,
    hasHost: Boolean(host),
    requestedKey: params.template,
    ownEventKey: ownEvent?.templateKey,
    fallbackKey: previewInvitation.event.templateKey,
  }, resolveTemplateKey);
  if (decision.status === 'not_found') notFound();
  if (decision.status === 'unavailable') return <TemplateUnavailable />;
  const templateKey = decision.templateKey;
```

Giữ `dynamic = 'force-dynamic'`, `revalidate = 0`, `await connection()` và logic `guestName` hiện tại. `guestName` không được đổi event hoặc key. Nút Dashboard "Xem trước thiệp" trong `src/features/events/EventEditor.tsx` dùng event đã lưu qua `ClientInvitationTemplate`; không sửa nút đó để nhận query `template`.

- [x] **Step 4: Chạy test và typecheck**

```powershell
node --test tests/preview-access.test.mjs
npm run typecheck
```

Expected: policy test PASS và không lỗi TypeScript.

- [ ] **Step 5: Kiểm thử A/B trên môi trường test**

Chạy **bản build production nối Supabase test** với cấu hình Task 0. Dừng server cũ trước khi build lại. Không dùng `npm run dev` cho bảng A/B này: development cố ý cho chọn mẫu khác.

```powershell
$env:NODE_ENV = 'production'
$env:EMAIL_TRANSPORT = 'brevo'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'QA build failed' }
npm run start -- --hostname 127.0.0.1 --port 3200
```

Mở `http://127.0.0.1:3200` bằng các phiên trình duyệt tách biệt cho QA A/B và QA C chưa có event. Phần A/B không cần gửi email. Nếu kiểm tra thư ở local, không coi link chứa `SITE_URL` trong thư là link trỏ về local; bài kiểm tra email-link đầy đủ phải chạy trên site QA/production có `SITE_URL` khớp, bằng event QA riêng ở Task 5.

Xác nhận:

```text
A mở /preview                         -> thấy template của A
A mở /preview?template=<key-B>       -> bị từ chối/không khả dụng
B mở /preview?template=<key-A>       -> bị từ chối/không khả dụng
A mở /preview?template=<key-A>       -> thấy template của A
Host chưa có event + query key riêng  -> không xem được template khách khác
Host chưa có event, không query      -> không dùng fixture để hiện mẫu khách
Không đăng nhập                     -> 404
Key không đăng ký / query rỗng       -> không khả dụng
```

Không coi việc route bị chặn là đã bảo vệ được file tĩnh: ảnh trong `public/templates/` và chữ nằm trong bundle vẫn là tài nguyên công khai.

- [ ] **Step 6: Bổ sung kiểm tra header preview và kiểm chứng**

Trong `scripts/verify-production.mjs`, thay toàn bộ khối `if (path !== '/preview') { ... }` đang bỏ qua header preview bằng đoạn sau, đặt ngay sau `check(noSecrets(body), ...)` trong vòng lặp route:

```js
  const cacheControl = response.headers.get('cache-control') ?? '';
  check(/\bprivate\b/.test(cacheControl) && /\bno-store\b/.test(cacheControl), 'private response bypasses cache');
  check(response.headers.get('referrer-policy') === 'no-referrer', 'referrer-policy');
  check((response.headers.get('x-robots-tag') ?? '').includes('noindex'), 'noindex');
```

Chạy ở terminal thứ hai với cùng cấu hình test, khi server Step 5 vẫn chạy:

```powershell
$env:SMOKE_BASE_URL = 'http://127.0.0.1:3200'
npm run smoke:production
```

Expected: `/preview` không đăng nhập trả 404 và được kiểm tra cả ba header, mọi kiểm tra đều PASS. Nếu phát hiện header thiếu, dừng task, đối chiếu `next.config.ts`/`src/proxy.ts` và sửa nguyên nhân trước khi đánh dấu đạt; không bỏ kiểm tra để làm xanh kết quả.

Smoke này không đăng nhập. Trong DevTools → Network, bật Disable cache rồi reload `/preview` ở từng phiên A/B: cả trang của chính mình lẫn trang query bị từ chối phải có `Cache-Control` chứa `private` và `no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag` chứa `noindex`. Kiểm tra response mới sau đăng xuất cũng không hiển thị nội dung Host. Ghi pass/fail và header đã lọc; không lưu cookie/session hoặc HAR chứa token vào Git.

Sau kiểm tra production-mode, dừng server. Dùng terminal development riêng với `NODE_ENV=development`, `npm run dev`; xác nhận designer chưa đăng nhập vẫn chọn được key demo. Không dùng kết quả development để thay thế bảng A/B production-mode.

- [x] **Step 7: Commit policy và cập nhật smoke**

```powershell
git add -- src/features/events/preview-template-policy.ts src/app/preview/page.tsx tests/preview-access.test.mjs scripts/verify-production.mjs
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: isolate host preview to own template"
```

**Gate:** Unit test, typecheck, A/B production-mode và kiểm tra header đạt trước khi deploy bản phục vụ khách. Chỉ commit những thay đổi thuộc task; Task 5 chạy lại trên deployment đích. Không đánh dấu hoàn thành chỉ dựa vào việc policy thuần PASS.

## Task 5: Nghiệm thu local/test và chuẩn bị production

**Files:**
- Verify: `.env`/biến môi trường ngoài Git, không ghi giá trị vào plan
- Verify: `scripts/check-deploy.mjs`
- Verify: `scripts/verify-production.mjs`
- Verify: `.next/static/`, kết quả build
- Verify: `supabase/test-project.json`
- Verify: tất cả migrations `supabase/migrations/*.sql`

- [ ] **Step 1: Xác nhận môi trường đích**

Ghi riêng trong hồ sơ vận hành: site production, Supabase project ID, các migration đã áp dụng, Brevo sender, `SITE_URL`, nhánh/commit production và cách rollback. Đối chiếu `supabase/test-project.json` để không nhầm project test với production. `https://nc-thiepmoi.netlify.app` chỉ là địa chỉ deploy đang ghi trong README. Không coi đó là site và database đã nghiệm thu để nhận khách trả phí, trừ khi hồ sơ vận hành đã đối chiếu đúng project Supabase.

Task 4 đã đạt trước bước này. Chạy QA nối database test trước; sau đó đổi cấu hình về production và build lại để deploy. Không đưa artifact `.next` được build với Supabase test lên site khách thật. Đối chiếu project và commit của deployment thực tế, không chỉ cấu hình local.

Trước lần bàn giao đầu tiên, hồ sơ vận hành phải ghi công cụ/cách sao lưu đang dùng, nơi lưu riêng, người chịu trách nhiệm và một lần khôi phục thử trên project test. Phạm vi phải bao gồm dữ liệu Auth/database và file Storage cần thiết; không chỉ source Git. Đây là điều kiện nghiệm thu ban đầu, không chờ đến Task 8 mới chuẩn bị backup. Nếu chưa có cách backup/restore đã kiểm chứng, chưa đánh dấu gate production đạt.

- [ ] **Step 2: Kiểm tra cấu hình deploy**

Khi đã nạp đúng biến môi trường nhưng không in giá trị, chạy:

```powershell
npm run check:deploy
```

Expected: tất cả biến bắt buộc có mặt, `SITE_URL` là HTTPS public origin hợp lệ, `EMAIL_TRANSPORT` là `brevo` hoặc không đặt. Lệnh PASS không chứng minh template, Supabase, email hay giao diện đã nghiệm thu.

- [ ] **Step 3: Chạy typecheck/build**

```powershell
npm run typecheck
npm run build
```

Chạy từng lệnh và kiểm tra exit code 0 trước khi tiếp tục; lỗi typecheck không được bỏ qua chỉ vì build sau đó chạy. Không tạo user/event khách thật trước khi build chứa key khách đạt. Bộ QA trên database test cần tồn tại trước để kiểm tra guest.

- [ ] **Step 4: Kiểm thử trên môi trường test**

Dùng Host/event QA, dữ liệu giả và hộp thư do người triển khai kiểm soát. Trên database test, gán event QA đúng key mới bằng quyền quản trị rồi mở bằng bản build production-mode ở Task 4; không tạo event khách thật để vượt gate của Task 3. Kiểm tra:

- đăng nhập `/login`;
- `/dashboard` đọc đúng event;
- trang `/preview` và preview nhúng/modal trên Dashboard cùng tải đúng key, đúng component, đủ ảnh/CSS;
- upload MP3 <= 10 MiB qua Dashboard;
- link `/invite/{token}` đúng component;
- RSVP accepted và declined bằng hai lời mời QA khác nhau, mỗi lời mời chỉ ghi một lần; tải lại thấy trạng thái cũ, thử gửi lần hai bị khóa;
- email mời thử tới hộp thư kiểm soát;
- mẫu cũ không đổi nếu khách mới dùng CSS/component riêng.

Node chỉ kiểm tra key và policy; kiểm tra loader thật ở bước này là bắt buộc cho cả nhánh Task 2 và Task 3. Chạy lại test các key cũ và test hiện có; mở lại các mẫu đang hoạt động bị ảnh hưởng khi sửa code dùng chung. Với email-link trên local, kiểm tra toàn luồng ở Step 7 trên deployment có `SITE_URL` khớp.

- [ ] **Step 5: Deploy và ghi điểm khôi phục**

Trước khi deploy, ghi commit/deploy tốt hiện tại và xác nhận phần thay đổi đã được commit đúng phạm vi. Đổi cấu hình sang project production đã chốt, chạy lại check-deploy/typecheck/build với cấu hình đó; trên Netlify, build cũng phải dùng biến production đúng project. Deploy commit đã kiểm tra lên đúng site. Xác nhận deploy thực sự hoàn tất, ghi commit/deploy ID mới. Không coi `git push` là bằng chứng deploy nếu chưa thấy deployment thành công. Nếu bản mới lỗi, dừng bàn giao và gửi thư cho đơn bị ảnh hưởng. Khôi phục bản deploy tốt trước đó hoặc đưa bản sửa lên sau khi kiểm tra. Rollback về bản chưa có key mới sẽ làm khách đó thấy mẫu không khả dụng; phải có bản sửa chứa key đó trước khi tiếp tục. Rollback code không khôi phục Auth, event, RSVP, sổ gửi hoặc file nhạc đã ghi đè.

- [ ] **Step 6: Chạy smoke read-only production**

```powershell
$env:SMOKE_BASE_URL = 'https://<site-production-da-chot>'
npm run smoke:production
```

Expected sau sửa script ở Task 4: route đúng status, không lộ private key trong `.next/static` local hoặc response đã kiểm tra; header các response được kiểm tra, gồm `/preview` không đăng nhập, có `private, no-store`, `no-referrer`, `noindex`. `.next/static` local phải thuộc commit/cấu hình đang nghiệm thu; phép quét local không chứng minh mọi file trên CDN đã được quét. Smoke không kiểm tra authenticated journey hoặc email inbox.

- [ ] **Step 7: Nghiệm thu deployment bằng Host/event QA riêng**

Trên deployment đích, tạo hoặc dùng lại Host/event QA do người triển khai kiểm soát, tách khỏi khách thật. Dùng quy tắc tạo Auth/profile/event của Task 6; gán event QA key vừa deploy. Không tạo thêm event cho cùng user QA; khi dùng lại event QA, giữ lịch sử thử riêng trong QA và đổi key bằng quyền quản trị sau khi đã xác nhận bản mới có key đó.

1. Đăng nhập QA; mở `/preview`, preview nhúng và modal trên Dashboard. Đối chiếu đúng giao diện mới.
2. Chạy lại A/B và kiểm tra header khi đăng nhập theo Task 4 bằng hai phiên QA riêng. Thực hiện cả trường hợp QA chưa có event.
3. Upload nhạc QA, kiểm tra preview. Nhạc của khách thật sẽ được tải riêng vào event khách ở Task 6.
4. Trong Dashboard QA, dùng `InviteForm` tạo lời mời tới hộp thư/alias đã xác nhận nhận được do người triển khai kiểm soát. Form gọi `POST /api/host/invitations` rồi tự gọi `/api/host/invitations/{invitationId}/send`; thao tác này gửi thư thật và dùng hạn mức chung. Không bấm nếu chưa có hạn mức và chưa kiểm tra địa chỉ.
5. Mở link trong thư đã nhận, xác nhận origin khớp `SITE_URL`, đúng token, giao diện, tên và lời nhắn QA, nhạc và bản đồ. Dùng hai lời mời QA khác nhau để kiểm tra accepted/declined, khóa lần hai và Dashboard QA nhận đúng phản hồi.
6. Nếu tạo trùng email trong cùng event và API trả 409, dùng lại lời mời QA hiện có hoặc một hộp thư/alias QA khác đã kiểm soát; không insert token bằng SQL, không reset RSVP để thử lại. Nếu trạng thái gửi `unknown`/`sending`, làm theo `docs/BREVO_SEND_CONTRACT.md`, không bấm gửi dồn chỉ vì đã qua 60 giây.
7. Ghi bằng chứng đã lọc secret/token; lời mời và phản hồi QA được giữ trong event QA, không chuyển sang khách thật và không xóa dữ liệu/sổ gửi bằng SQL cho đẹp thống kê. Chưa có quy trình xóa QA được kiểm chứng trong plan này.

**Gate:** Chỉ sau build/test, deploy, smoke và luồng QA trên deployment đích đạt mới thực hiện Task 6 tạo user/event **khách thật**. Tài khoản QA được phép chuẩn bị trước để nghiệm thu; không dùng tài khoản khách để thay thế QA.

## Task 6: Tạo Host, event và dữ liệu ban đầu

**Files:**
- Modify production Supabase qua Authentication/SQL Editor đúng project; không commit dữ liệu thật
- Verify: `supabase/migrations/202609240001_mvp_core.sql` và migrations tiếp theo
- Verify: `src/features/events/server.ts` cho upload/finalize nhạc

- [ ] **Step 1: Tạo hoặc kiểm tra user**

Trong Supabase Authentication → Users:

1. Nếu email chưa tồn tại, tạo user bằng email khách.
2. Bật xác nhận email ngay.
3. Tạo mật khẩu riêng, giữ tạm trong công cụ quản lý mật khẩu riêng của người triển khai. **Chưa gửi cho khách**; chỉ gửi tại Task 7 sau khi nghiệm thu xong. Không ghi vào Git, log hoặc hồ sơ đơn hàng.
4. Xác nhận trigger tạo profile `role = host`, `lifecycle_status = active`.
5. Copy User UID.
6. Nếu email đã tồn tại, không tạo user thứ hai.

Một user chỉ có một event do unique index `events_one_per_host`; không ghi đè event cũ.

- [ ] **Step 2: Tạo event bằng SQL Editor quyền quản trị**

Thay các giá trị bằng dữ liệu đã duyệt, không dùng URL minh họa:

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
  '<USER_UID>',
  '<TIÊU_ĐỀ_ĐÃ_DUYỆT>',
  '<KEY_ĐÃ_DEPLOY>',
  '<YYYY-MM-DDTHH:MM:SS+07:00>',
  '<TÊN_ĐỊA_ĐIỂM>',
  '<ĐỊA_CHỈ>',
  NULL
);
```

Nếu có Google Maps, URL phải là HTTPS và thuộc host/path được schema cho phép. Không điền `music_path` thủ công. Xác nhận `event_date` là giờ Việt Nam, tiêu đề 1–255 ký tự, địa chỉ tối đa 2000 ký tự và key đã có trong source/deploy.

- [ ] **Step 3: Đăng nhập bằng tài khoản khách**

Vào `/login`, xác nhận Dashboard có đúng một event. Lưu tiêu đề, ngày giờ, địa điểm, địa chỉ và bản đồ đúng nội dung khách duyệt. Nếu dùng dữ liệu thử, trả lại dữ liệu đã duyệt trước bước bàn giao.

- [ ] **Step 4: Upload nhạc qua Dashboard**

Nếu có nhạc, upload MP3 qua Dashboard bằng tài khoản Host. Không ghi đường dẫn trực tiếp vào SQL. Sau khi upload, `music_path` phải là `{user_id}/{event_id}/music.mp3`, không có tiền tố `audio/`. Event có `hasMusic` và preview Host phát đúng nhạc. Nếu khách không dùng nhạc, xác nhận trạng thái không nhạc thay vì upload file rỗng.

- [ ] **Step 5: Kiểm tra event khách sạch dữ liệu thử**

Kiểm tra preview trong Dashboard và `/preview` bằng tài khoản khách, đối chiếu đúng title/ngày giờ/địa điểm/bản đồ/ảnh/nhạc đã duyệt. Dashboard mới phải chưa có lời mời hoặc phản hồi QA. Không bấm form gửi thư để thử trong event này.

Luồng guest/email/RSVP của cùng key đã được nghiệm thu trên event QA ở Task 5, Step 7. Dữ liệu ngày giờ, địa điểm và nhạc riêng của khách được nghiệm thu qua preview Host sau khi lưu. Nếu cần kiểm tra lại luồng guest, dùng QA; không dùng token của khách mời thật để gửi phản hồi thử.

**Gate:** Preview production hiển thị đúng ảnh, chữ, event data và key riêng; event khách không có dữ liệu QA. Chuyển Task 7 để nghiệm thu cuối; chưa gửi mật khẩu ở task này.

## Task 7: Nghiệm thu cuối và bàn giao

**Files:**
- Verify production routes: `/login`, `/dashboard`, `/preview`, `/invite/{token}`
- Create outside Git: biên bản/checklist nghiệm thu và hồ sơ bàn giao
- No source change unless a concrete defect is found and re-verified

- [ ] **Step 1: Kiểm tra nội dung và tài nguyên**

Xác nhận:

- key có trong cả registry và resolve-key;
- ảnh đủ file, không vỡ đường dẫn, không lấy nhầm ảnh khách khác;
- preview không còn chữ Mai Hoa hoặc dữ liệu fixture ngoài phần minh họa được phép;
- tên dài, ảnh dọc/ngang và nội dung dài không làm vỡ layout;
- phong bì mở được;
- event title, date/time, venue, address, map và music khớp bản duyệt;
- mobile và desktop đều xem được.

- [ ] **Step 2: Kiểm tra luồng dùng chung**

Đăng nhập bằng user khách và xác nhận:

- Dashboard mở đúng event;
- Host xem preview đúng template của mình;
- Host không đổi được `template_key`;
- danh sách khách mời/phản hồi không có dữ liệu QA; tham chiếu bằng chứng thêm guest/gửi email/RSVP từ event QA ở Task 5;
- RSVP một lần và giới hạn MP3 10 MiB đã được kiểm tra trên QA; nhạc của khách phát đúng ở preview sau khi upload;
- bằng chứng A/B cho nhạc không truy cập chéo event đã có từ QA;
- CSS/template khách mới không làm thay đổi mẫu khác.

- [ ] **Step 3: Kiểm tra usage và lịch gửi**

Kiểm tra usage thực tế của Netlify, Supabase database/storage/egress và Brevo trước khi hẹn gửi. Các hạn mức dưới đây là số spec ghi ngày 26/09/2026, không phải bảng giá đã kiểm lại khi sửa plan này. Trước khi nhận đơn phải xem gói và usage trong tài khoản:

- Netlify Free theo credit, theo spec: 300 credit/tháng; production deploy 15 credit/lần; băng thông 20 credit/GB; compute 10 credit/GB-giờ; request 2 credit/10.000 request. Gói legacy có thể khác.
- Supabase Free, theo spec: database 500 MB, file storage 1 GB, egress 5 GB và cached egress 5 GB. Hai loại egress không cộng thành 10 GB dùng tùy ý. Project không hoạt động một tuần có thể bị tạm dừng.
- Brevo Free, theo spec: 300 email/ngày, hạn mức không dùng hết không cộng dồn sang ngày sau.

Phép tính kế hoạch, không phải số đo hệ thống: 10 khách × 100 thư = 1.000 thư, cần ít nhất 4 ngày nếu trần là 300 thư/ngày và không có gửi lại; 10 khách × 100 lượt tải một bài nhạc 5 MB khoảng 5 GB egress; 10 production deploy × 15 credit = 150 credit theo gói Netlify Free nêu trong spec, chưa tính traffic. Nâng gói Brevo không tự nâng trần 300 lượt/ngày trong `supabase/migrations/202609270001_mvp_email_ledger.sql`. Nếu mức còn lại không đủ, điều chỉnh lịch hoặc nâng gói trước khi gửi. Không hứa hệ thống tự chia lịch, tự gửi tiếp ngày hôm sau hoặc tự nâng gói.

- [ ] **Step 4: Gửi thông tin bàn giao qua kênh riêng**

Chỉ gửi sau khi mọi tiêu chí nghiệm thu bắt buộc đạt; đây là lần đầu gửi mật khẩu cho khách. Nếu còn lỗi hoặc chưa có bằng chứng QA, giữ trạng thái chưa bàn giao và xử lý trước. Dùng nội dung sau, thay toàn bộ trường bằng dữ liệu thật:

```text
Chào anh/chị [Tên],

Thiệp mời [Tên sự kiện] đã sẵn sàng theo nội dung và giao diện anh/chị đã duyệt.

Đăng nhập trang quản lý:
- [SITE_URL]/login
- Email: [email]
- Mật khẩu: [mật khẩu gửi riêng]

Anh/chị sửa được tiêu đề, ngày giờ, địa điểm, link Google Maps và nhạc MP3 (tối đa 10 MiB). Bấm lưu thì thiệp cập nhật theo. Ảnh, câu chuyện và bố cục cần liên hệ để cập nhật code và deploy.

Trên Dashboard, anh/chị thêm khách mời, gửi email thiệp và xem phản hồi. Mỗi người được mời chỉ xác nhận một lần. Hệ thống dùng chung hạn gửi email; nếu gửi số lượng lớn hãy báo trước.

Thiệp được duy trì đến [ngày đã thống nhất]. Khi cần đổi ảnh, giao diện hoặc hỗ trợ mật khẩu, liên hệ [kênh hỗ trợ]. Website hiện chưa có chức năng tự đặt lại mật khẩu.
```

Hướng dẫn Host bấm "Xem trước thiệp" trên Dashboard. Không gửi `/preview?template=` cho khách. Link invitation chỉ cấp cho đúng khách mời; không hứa link không thể bị chuyển tiếp.

- [ ] **Step 5: Lưu hồ sơ sau bàn giao**

Lưu mã đơn, email Host, User UID/event ID, `template_key`, nội dung đã duyệt, ngày bàn giao, hạn duy trì, commit/deploy đang chạy và cách rollback. Không lưu mật khẩu hoặc danh sách token.

## Task 8: Hỗ trợ sau bàn giao, thay đổi và kết thúc sự kiện

**Files:**
- Modify khi cần: đúng config/component và `public/templates/<key>/`; không sửa `content.ts` cho một khách
- Verify: `npm run typecheck`, `npm run build`, preview production sau mỗi thay đổi
- Backup outside Git: Supabase Auth/database/RSVP/Storage và tài nguyên ảnh/nhạc phù hợp phạm vi

- [ ] **Step 1: Xử lý đổi chữ/ảnh/câu chuyện**

Với mẫu có sẵn, sửa `src/features/template/configs/<key>.ts` và `public/templates/<key>/`. Với thiết kế tốt nghiệp riêng, sửa đúng component/CSS/config của key. Chạy typecheck/build, deploy, mở lại preview production và nhờ Host xác nhận. Không sửa `content.ts` hoặc thư mục asset mẫu gốc. Muốn đổi `template_key` sau bàn giao: deploy và kiểm tra key mới trước, rồi mới sửa cột bằng SQL Editor quyền quản trị, sau đó kiểm tra lại thiệp. Không cho Host tự đổi key.

- [ ] **Step 2: Hỗ trợ mật khẩu**

Xác minh đúng chủ tài khoản, dùng công cụ quản trị Supabase để đặt lại mật khẩu, gửi mật khẩu mới qua kênh riêng và kiểm tra đăng nhập. Không tìm mật khẩu cũ từ log; không hứa mật khẩu tự hết hạn hoặc bắt buộc đổi lần đầu.

- [ ] **Step 3: Sao lưu trước thay đổi lớn/kết thúc dịch vụ**

Sao lưu dữ liệu Supabase và tài nguyên ảnh/nhạc theo thỏa thuận. Kiểm tra restore trên môi trường test; Git không thay thế backup Auth, RSVP hoặc Storage.

- [ ] **Step 4: Xử lý hết hạn hoặc khách cũ đặt event mới**

Không tự xóa event khi hết ngày tổ chức và không dùng `deleting` như archived. Liên hệ để gia hạn hoặc kết thúc theo quy trình riêng. Nếu khách cũ đặt event mới, không ghi đè event đang có; lập yêu cầu riêng để hỗ trợ nhiều event hoặc kết thúc event cũ sau khi kiểm chứng tác động. Chỉ bỏ key hoặc component khi không còn event cần dùng. Xóa ảnh khỏi bản deploy mới không xóa ảnh trong lịch sử Git, bản deploy cũ hoặc bản sao lưu; nếu khách yêu cầu xóa dữ liệu, phải kiểm tra các nơi giữ bản sao đó.

## Task 9: Không thực thi trong đơn hàng này

Phạm vi sản phẩm hiện tại chỉ là lễ tốt nghiệp. Không làm mẫu cưới, sinh nhật hay loại sự kiện khác, kể cả khi mục 11 của spec mô tả việc phải làm nếu sau này có khách loại đó. Không mở plan cưới hoặc sinh nhật từ quy trình này.

Mục 1.3 của spec còn một việc độc lập: tách mẫu nền tốt nghiệp khi nhiều khách dùng cùng bố cục. Không làm việc đó giữa một đơn đang nghiệm thu. Chỉ mở plan riêng khi có từ hai khách tốt nghiệp dùng cùng bố cục và cần sửa lỗi chung một lần.

Điểm bắt đầu đã xác nhận, để plan tách mẫu nền sau này không phải khảo sát lại:

- `src/features/template/templates/WeddingFloral01.tsx` import cứng `../content` và `../template.css`. Tên file có chữ Wedding nhưng component đang là bố cục tốt nghiệp, không phải thiệp cưới.
- `graduation-floral-01` và `wedding-floral-01` cùng loader `loadWeddingFloral01` trong `src/features/template/registry.ts`.
- `src/features/guest/InvitationEntrance.tsx` là phong bì dùng chung, có hình nón tốt nghiệp.
- Không đổi `TemplateProps` để đưa `audioControl` hoặc `responseArea` vào mode preview.

Plan tách mẫu nền, nếu được mở sau, vẫn chỉ phục vụ lễ tốt nghiệp. Giữ một ứng dụng, một database, một Dashboard. Đăng ký key ở cả `resolve-key.ts` và `registry.ts`. Deploy key trước khi insert event. Không sửa CSS tốt nghiệp để phục vụ một khách khác.

---

## Đối chiếu spec

| Mục spec | Task thực hiện |
| --- | --- |
| 1. Quyết định sản phẩm | Task 1; không thêm công cụ tự chọn mẫu trên Dashboard |
| 2. Hiện trạng code | Bản đồ file; hai key gốc không phải mẫu riêng của khách mới |
| 3. Dùng chung và riêng | Global Constraints, Task 2, Task 3, Task 6 |
| 4. Đặt tên key | Task 1, bước 3 |
| 5. Thu thập nội dung | Task 1, bước 1–2 |
| 6. Mẫu tốt nghiệp có sẵn | Task 2 |
| 7. Deploy trước khi tạo tài khoản | Task 0, Task 5; QA được chuẩn bị trước, user/event khách thật tạo sau gate production |
| 8. Tạo Host và event | Task 6; đổi `template_key` sau này ở Task 8, bước 1 |
| 9. Cách ly và bàn giao | Task 4, Task 5 Step 7, Task 7 |
| 10. Đổi ảnh hoặc câu chuyện | Task 8, bước 1 |
| 11. Thiết kế riêng | Task 3 cho thiết kế tốt nghiệp riêng. Không làm mẫu cưới hoặc sinh nhật |
| 12. Checklist trước mật khẩu | Ma trận nghiệm thu |
| 13. Việc không làm | Mục Ngoài phạm vi |
| 14. Hạn mức nhiều khách | Task 7, bước 3. Số hạn mức là số spec ngày 26/09/2026, phải xem lại usage thực tế; không cam kết phục vụ miễn phí |
| 15. Sau bàn giao và kết thúc | Backup ban đầu ở Task 5 Step 1; hỗ trợ/thay đổi/kết thúc ở Task 8 |

---

## Ma trận nghiệm thu bắt buộc

| Nhóm | Tiêu chí đạt | Bằng chứng |
| --- | --- | --- |
| Key | Key <= 50 ký tự, đã deploy và đăng ký ở hai file | diff source + preview/guest production |
| Nội dung | Chữ, ảnh, câu chuyện đúng bản duyệt; không lẫn khách | preview desktop/mobile + hồ sơ duyệt |
| Event | title/date/venue/map/timezone đúng | Dashboard + preview Host |
| Tài khoản | email xác nhận, profile host active, một event | Supabase Auth/profile/event |
| Cách ly | A không xem key B bằng query, B không xem key A | test A/B production/test |
| Guest | token QA hợp lệ mở đúng mẫu, token sai không mở; event khách không chứa invitation thử | link QA + smoke + Dashboard khách |
| RSVP | preview không ghi thật; guest QA ghi một lần và khóa | hai invitation trong event QA riêng |
| Nhạc | MP3 <= 10 MiB, `music_path` đúng `{user_id}/{event_id}/music.mp3` không có tiền tố `audio/`, nghe được | Dashboard + guest test |
| Email | gửi đúng hộp thư kiểm soát, không vượt lịch/hạn mức | Brevo ledger/inbox test |
| Deploy | check-deploy, typecheck, build, smoke đạt | log lệnh + commit/deploy ID |
| Bảo mật vận hành | không lộ secret/mật khẩu/token; preview cả chưa/đã đăng nhập có private/no-store | smoke đã bổ sung header + Network A/B đã lọc + rà hồ sơ |
| Rollback/backup | có điểm deploy khôi phục và backup đã xác nhận | hồ sơ vận hành |

## Tóm tắt thứ tự thực hiện

1. Task 0 → Task 4 — chuẩn bị môi trường, sửa policy preview, kiểm tra A/B production-mode và bổ sung smoke. Làm phần nền tảng này trước, bằng dữ liệu QA.
2. Task 1 — khi có đơn, chốt phạm vi, nội dung, asset, key và hồ sơ duyệt.
3. Task 2 **hoặc** Task 3 — tạo mẫu có sẵn riêng hoặc giao diện tốt nghiệp riêng; giữ toàn bộ key/test cũ.
4. Task 5 — kiểm tra test/build, cấu hình, deploy và nghiệm thu toàn luồng bằng Host/event QA riêng.
5. Task 6 — tạo Host/event khách thật, upload nhạc, kiểm tra dữ liệu khách qua preview; chưa gửi mật khẩu, không tạo invitation thử.
6. Task 7 — kiểm tra đủ bằng chứng, dữ liệu khách và hạn mức rồi mới bàn giao mật khẩu.
7. Task 8 — hỗ trợ thay đổi, backup và kết thúc theo thỏa thuận.
8. Task 9 không thực thi trong đơn hàng này. Không mở plan cưới hoặc sinh nhật. Tách mẫu nền tốt nghiệp nhận config là hạng mục riêng, chưa được coi là đã làm sau khi hoàn tất plan này.

## Handoff thực thi

Plan đã được chỉnh theo spec `docs/QUY_TRINH_TRIEN_KHAI_KHACH_HANG.md` và đối chiếu code hiện tại. Chưa thực thi đơn hàng hoặc deploy nào từ lần sửa plan này. Hoàn thành tài liệu không đồng nghĩa các checkbox đã đạt; người thực thi phải lưu bằng chứng theo từng gate.

Hai lựa chọn thực thi:

1. **Subagent-Driven:** chia việc theo task và review kết quả; giữ dependency Task 0 → 4 → 1 → 2/3 → 5 → 6 → 7, không cho nhiều agent đồng thời sửa registry hoặc dùng chung dữ liệu QA.
2. **Inline Execution:** thực thi tuần tự với checkpoint sau Task 4, Task 2/3, Task 5 và Task 7. Khi chưa có đơn thật, chỉ thực hiện nền tảng/QA, không tự điền dữ liệu khách để vượt gate.

## Kiểm chứng tài liệu ngày 27/09/2026

- Hai ví dụ test key đã được chạy với bản sao `resolve-key.ts` trong thư mục tạm: thiếu key mới thì FAIL assertion, bổ sung key mới thì PASS; không có lỗi import registry/TSX.
- Hai test key và chín test policy trong plan chạy tổng cộng **11/11 PASS** trong thư mục tạm. Chữ ký policy cũng vượt qua typecheck khi dùng `GuestInvitation.event.templateKey` optional từ code hiện tại.
- Đây là kiểm chứng các đoạn code mẫu của plan. Chưa đưa policy/test/script mới vào source dự án, chưa thực thi test A/B đã đăng nhập hoặc triển khai đơn khách thật. Khi thực thi vẫn phải chạy toàn bộ gate trên code và môi trường đích.
