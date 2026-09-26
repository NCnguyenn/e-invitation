# Hướng dẫn tạo thiệp mới & Quản lý Đa giao diện (Multi-Template)

Tài liệu này hướng dẫn bạn (Designer / Người quản trị) quy trình từ lúc tiếp nhận khách hàng, thiết lập giao diện thiệp, đến khi bàn giao tài khoản cho khách hàng tự quản lý.

---

## 1. Tổng quan quy trình

```text
[Khách hàng liên hệ]
   │
   ▼
[Bước 1: Chọn mẫu hoặc Thiết kế riêng]
   ├── Nếu dùng mẫu có sẵn: Chọn mã template_key (ví dụ: 'wedding-floral-01')
   └── Nếu thiết kế riêng: Tạo thư mục template mới và đăng ký vào Template Registry
   │
   ▼
[Bước 2: Tạo tài khoản Host & Sự kiện trên Supabase]
   ├── Tạo User trong Authentication (Email + Password cấp cho khách)
   └── Thêm 1 dòng vào bảng events với template_key tương ứng
   │
   ▼
[Bước 3: Điền thông tin ban đầu & Bàn giao]
   ├── Đăng nhập http://localhost:3000/dashboard (hoặc trang web thực tế) bằng tài khoản của khách
   ├── Nhập Tiêu đề, Ngày giờ, Địa điểm, Link Google Maps, tải nhạc nền ban đầu -> Bấm 'Lưu thay đổi'
   └── Bàn giao Email và Mật khẩu cho khách hàng.
```

---

## 2. Cách đăng ký một Template mới (Mẫu thiết kế riêng)

Tất cả các giao diện thiệp được quản lý tập trung qua **Template Registry** (`src/features/template/registry.ts`).

### Bước 2.1: Tạo file component cho Template
Tạo file mới trong thư mục `src/features/template/templates/`, ví dụ: `CustomClientA.tsx`:

```tsx
import type { TemplateProps } from '../types';
import '../fonts.css';

export function CustomClientA(props: TemplateProps) {
  const { invitation, mode } = props;
  const { event } = invitation;

  return (
    <div className="my-custom-invitation">
      {/* 1. Phần thông báo xem thử nếu đang ở chế độ preview */}
      {props.mode === 'preview' && (
        <aside className="preview-notice">Bản xem trước</aside>
      )}

      {/* 2. Tiêu đề và thông tin sự kiện (luôn đọc từ event) */}
      <h1>{event.title}</h1>
      <p>Thời gian: {event.eventDate}</p>
      <p>Địa điểm: {event.venueName}</p>
      <p>Địa chỉ: {event.venueAddress}</p>

      {/* 3. Tên khách mời và lời nhắn (đối với khách tham dự) */}
      <h2>Kính mời: {invitation.guestName}</h2>
      {invitation.invitationNote && <p>{invitation.invitationNote}</p>}

      {/* 4. Khu vực xác nhận tham dự (RSVP) */}
      {props.mode === 'guest' ? props.responseArea : <button disabled>Xác nhận tham dự</button>}

      {/* 5. Nút điều khiển nhạc */}
      {props.mode === 'guest' ? props.audioControl : null}
    </div>
  );
}
```

### Bước 2.2: Đăng ký mã Template vào `src/features/template/registry.ts`
Mở file `src/features/template/registry.ts` và thêm template vào danh sách:

```ts
import { CustomClientA } from './templates/CustomClientA';

const TEMPLATES: Record<string, TemplateDefinition> = {
  'wedding-floral-01': { ... },
  'custom-client-a': {
    key: 'custom-client-a',
    name: 'Thiệp cưới Phong cách Sang trọng - Khách A',
    category: 'custom',
    component: CustomClientA,
  },
};
```

---

## 3. Tạo tài khoản & Sự kiện cho Khách hàng trên Supabase

Trên trang quản trị Supabase (SQL Editor hoặc Table Editor):

### Bước 3.1: Tạo User
1. Vào tab **Authentication** -> **Users** -> Chọn **Add user** (Create user).
2. Nhập Email (ví dụ: `khachhang1@gmail.com`) và Mật khẩu tự đặt.
3. Sao chép `User ID (UID)` vừa được tạo.

### Bước 3.2: Tạo sự kiện gắn với mã Template
Chạy câu lệnh SQL (hoặc thêm dòng vào bảng `events`):

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
  'UID_CUA_USER_VUA_TAO',
  'Lễ Tốt Nghiệp của Minh',
  'custom-client-a', -- Mã template bạn đã đăng ký
  '2026-11-20T09:00:00+07:00',
  'Trung tâm Hội nghị Quốc gia',
  'Đại lộ Thăng Long, Mễ Trì, Nam Từ Liêm, Hà Nội',
  'https://maps.app.goo.gl/...'
);
```

---

## 4. Xem trước & Đồng bộ hóa

* **Xem trước khi thiết kế:** Mở `http://localhost:3000/preview` để xem giao diện với dữ liệu sự kiện thật. Bạn cũng có thể thêm query `?template=custom-client-a` để chỉ định mẫu hiển thị.
* **Đăng nhập Dashboard:** Mở `http://localhost:3000/login` và đăng nhập bằng tài khoản của khách.
  * Mọi thay đổi về Ngày giờ, Địa điểm, Nhạc nền trên Dashboard bấm **Lưu thay đổi** sẽ cập nhật ngay lập tức sang trang thiệp mời của khách.
  * Khách hàng vào tab **Khách mời** để gửi email thiệp mời cá nhân hóa cho từng khách tham dự.
