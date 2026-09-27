# E-Invitation MVP

Ứng dụng Next.js cho Host tạo thiệp, gửi lời mời qua Brevo và theo dõi RSVP trên Supabase. Khách mở link riêng trong email, chọn tham gia hoặc từ chối một lần; khi mở lại link sẽ thấy trạng thái đã gửi.

Production: [https://nc-thiepmoi.netlify.app](https://nc-thiepmoi.netlify.app) · Host login: `/login`.

> 💡 **Thành viên mới tham gia dự án?** Hãy xem ngay hướng dẫn chi tiết tại [**`ONBOARDING.md`**](./ONBOARDING.md) để nắm toàn bộ cấu trúc dự án, tài khoản test, cách cài đặt, chạy test và các nền tảng liên kết.

## Chạy local

Cần Node.js 22 trở lên.

```powershell
npm ci
Copy-Item .env.example .env.local
# Điền khóa Supabase/Brevo và SITE_URL vào .env.local; không commit file này.
npm run dev
```

Mở `http://localhost:3000/login`. Host phải được cấp tài khoản Auth đã xác nhận, profile `active` và một event trước khi đăng nhập. Signup công khai không được bật.

## Database và dịch vụ

Áp các file `supabase/migrations/*.sql` theo thứ tự tên lên đúng Supabase project test. `supabase/test-project.json` ghim project để chặn vô tình chạy test-target code vào project khác. Không chạy migration trên production tùy ý.

Các biến cần thiết được liệt kê trong `.env.example`. Netlify giữ giá trị ở context Production. Gói hiện tại không cho granular scopes; các biến dùng scope mặc định của Netlify. Chỉ cấp quyền quản trị site cho người cần thiết. Không đặt khóa trong `netlify.toml`, source code hoặc Git.

Email dùng sender Brevo đã xác minh. `SITE_URL` phải là HTTPS origin ổn định; ứng dụng dùng nó để tạo `/invite/{token}`. Không dùng `EMAIL_TRANSPORT=stub` trên hosting.

## Build và deploy

```powershell
npm run check:deploy
npm run typecheck
npm run build
```

Site hiện được deploy từ workspace lên Netlify. Muốn Netlify tự deploy khi push `main`, cần nối site với repository GitHub và đặt production branch thành `main` trong Project configuration → Developer settings → Continuous deployment. Biến môi trường đã đặt ở Netlify không nằm trong repository.

Production smoke chỉ đọc:

```powershell
$env:SMOKE_BASE_URL = 'https://nc-thiepmoi.netlify.app'
npm run smoke:production
```

## Cấu trúc

- `src/`: Next.js pages, API và chức năng Host/Guest.
- `supabase/migrations/`: schema, RLS và RPC.
- `images/`: ảnh nguồn; `node scripts/prepare-template-assets.mjs` đồng bộ sang `public/templates/` và tạo bundle font.
- `public/fonts/`, `public/templates/`: ảnh và font được ứng dụng phục vụ.
- `docs/BREVO_SEND_CONTRACT.md`: quy tắc gửi email, trạng thái unknown và cách đối soát.
- `ONBOARDING.md`: hướng dẫn chi tiết toàn diện dành cho thành viên mới (thiết lập, tài khoản, test, kiến trúc).
- `docs/QUY_TRINH_TRIEN_KHAI_KHACH_HANG.md`: quy trình làm thiệp tốt nghiệp cho từng khách. `docs/HUONG_DAN_TAO_THIEP_MOI.md` chỉ trỏ về file đó.
- `YEU_CAU_MVP.md`, `YEU_CAU_DU_AN.md`: yêu cầu sản phẩm.

Mã thiệp cũ đã được chuyển vào ứng dụng Next.js; các file HTML/JS/CSS root trước đây không còn là runtime của site.
