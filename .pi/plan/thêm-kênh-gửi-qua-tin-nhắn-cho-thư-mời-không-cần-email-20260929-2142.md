## Mục tiêu

Cho phép chủ sự kiện tạo thư mời theo **2 kênh**:
1. **Gửi qua Email** (giữ nguyên luồng hiện tại: nhập tên + email + ghi chú → tạo thư mời + gửi email qua Brevo).
2. **Gửi qua tin nhắn** (mới): chỉ nhập **tên + ghi chú** (không cần email) → bấm **Tạo tin nhắn mời** → hiển thị sẵn **nội dung tin nhắn** gồm tên khách + lời mời riêng + **link thiệp cá nhân** để bấm **Sao chép** rồi dán qua Zalo/Facebook.

Phân biệt 2 kênh bằng cột mới `delivery_channel` ('email' | 'manual').

---

## Thiết kế

### 1. DB — file migration mới `supabase/migrations/2026MMDDxxxx_invitations_manual_delivery.sql`

- `ALTER TABLE public.invitations ALTER COLUMN guest_email DROP NOT NULL;`
- Đổi CHECK định dạng email: bỏ `invitations_guest_email_format`, thêm `... CHECK (guest_email IS NULL OR guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')`.
- Đổi unique: `DROP INDEX invitations_event_email_unique;` → `CREATE UNIQUE INDEX invitations_event_email_unique ON public.invitations (event_id, guest_email) WHERE guest_email IS NOT NULL;` (không email vẫn không trùng email; trùng tên vẫn cho phép — mỗi thư mời 1 token riêng).
- Thêm `delivery_channel text NOT NULL DEFAULT 'email'` + CHECK `IN ('email','manual')`.
- Cập nhật trigger `invitations_before_write`: `NEW.guest_email := NULLIF(lower(btrim(NEW.guest_email)), '')` (rỗng → NULL thay vì lỗi).
- `GRANT UPDATE` thêm `delivery_channel` cho authenticated (kèm `guest_name, guest_email, invitation_note` hiện có).

### 2. Validation — `src/lib/validation.ts`

- `InvitationCreate`/`InvitationUpdate`: `guestEmail` → `string | null`; thêm `deliveryChannel: 'email' | 'manual'`.
- `parseInvitationCreate`: cho phép `guestEmail` rỗng/null khi `deliveryChannel === 'manual'`; bắt buộc đúng định dạng khi `deliveryChannel === 'email'`; chấp nhận key `deliveryChannel` (mặc định `'email'` nếu không gửi — tương thích ngược).
- `parseInvitationUpdate`: tương tự; cho phép đổi kênh khi thư mời chưa gửi (canEdit).

### 3. Contracts — `src/lib/contracts.ts`

- `HostInvitationItem.guestEmail` → `string | null`.
- Thêm `deliveryChannel: 'email' | 'manual'`.
- `EmailStatus` thêm `'none'` cho khách kênh tin nhắn (không có email để gửi).

### 4. Service — `src/features/invitations/server.ts`

- `createHostInvitation`: nhận `deliveryChannel`; `guest_email = email || null`; `email_status = manual ? 'none' : 'pending'`; set `delivery_channel`.
- Tra cứu `existing()` khi email null bằng `.is('guest_email', null)` (PostgREST `.eq` với null không khớp) — nhưng vì unique index partial không áp trên NULL, nhánh duplicate chỉ áp dụng khi có email.
- `updateHostInvitation`: cập nhật `guest_email`/`delivery_channel`; khi chuyển sang manual và chưa gửi → `email_status='none'`; khi chuyển sang email → `'pending'` nếu chưa từng gửi.
- `projectHostInvitation`: map `delivery_channel` + `guestEmail` nullable; `canEdit` giữ quy tắc hiện tại.

### 5. API — giữ nguyên endpoint

- `POST /api/host/invitations`: body nhận thêm `deliveryChannel`; khi `manual` bỏ qua kiểm tra email; không auto-gửi email — trả `invitePath` để client soạn tin nhắn. Lưu ý: hiện form sau khi tạo gọi luôn `/send` — với kênh manual client sẽ **không** gọi `/send`.
- `PATCH /api/host/invitations/[id]`: cho phép cập nhật `guestEmail` null / `deliveryChannel`.
- `POST /api/host/invitations/[id]/send`: chặn gửi email khi `delivery_channel='manual'` (trả 422 `no_email_channel`).

### 6. UI

- **`InviteForm.tsx`**: thêm toggle 2 tab **"Gửi qua Email" / "Gửi qua tin nhắn"**.
  - Tab Email: giữ nguyên (bắt buộc email, gửi tự động).
  - Tab Tin nhắn: ẩn ô email, chỉ cần Tên + Ghi chú → nút **"Tạo tin nhắn mời"** → sau khi tạo hiển thị hộp **"Tin nhắn gợi ý"** (textarea read-only) với nội dung:
    ```
    Kính gửi {tên},
    Trân trọng mời {tên} xem thiệp mời online tại: {link}
    {ghi chú nếu có}
    Mong được đón {tên}!
    ```
    kèm nút **"Sao chép tin nhắn"** + nút **"Mở thiệp xem"**; không gọi `/send`.
- **`GuestTable.tsx`**: cột email hiển thị `—` khi null; badge trạng thái: kênh manual → nhãn "Chia sẻ qua tin nhắn" thay vì trạng thái Brevo; ẩn nút `SendInvitationButton` với manual; thêm nút **"Tin nhắn"** mở popover/modal nhỏ chứa tin nhắn đã soạn + nút copy.
- **`SendInvitationButton.tsx`**: early-return `null` khi `item.deliveryChannel === 'manual'`.
- **`src/features/email/labels.ts`**: thêm case `'none'` → 'Không gửi qua email'.

### 7. Admin (đọc-only)

- `src/features/admin/contracts.ts`: `AdminGuestItem.guestEmail` → `string | null`; `emailStatus` thêm `'none'`; thêm `deliveryChannel`.
- `src/features/admin/operations/events.ts` + `reconciliation.ts`: map thêm `delivery_channel`, chịu được `guest_email` null.

---

## File thay đổi

| File | Thay đổi |
|---|---|
| `supabase/migrations/2026MMDDxxxx_manual_delivery.sql` | **Mới** — schema + trigger + grant |
| `src/lib/validation.ts` | `guestEmail` optional theo `deliveryChannel` |
| `src/lib/contracts.ts` | `guestEmail` nullable, `deliveryChannel`, `EmailStatus+'none'` |
| `src/features/invitations/server.ts` | create/update/projection theo kênh |
| `src/app/api/host/invitations/[id]/send/route.ts` | chặn gửi email cho kênh manual |
| `src/features/invitations/InviteForm.tsx` | 2 tab + hộp tin nhắn + copy |
| `src/features/invitations/GuestTable.tsx` | hiển thị kênh, nút tin nhắn, ẩn gửi email |
| `src/features/invitations/SendInvitationButton.tsx` | ẩn với manual |
| `src/features/email/labels.ts` | nhãn 'none' |
| `src/features/admin/contracts.ts`, `operations/events.ts`, `operations/reconciliation.ts` | chịu email null + map channel |

## Kiểm thử

- `npm run lint` + `npx tsc --noEmit`.
- Test tay: tạo khách kênh tin nhắn (không email) → ra tin nhắn + link; mở link → thiệp hiển thị đúng tên/ghi chú; RSVP vẫn hoạt động qua token.
- Tạo kênh email giữ nguyên → gửi email vẫn chạy.
- Sửa khách chưa gửi: đổi kênh; gửi email bị chặn với kênh manual.

## Lưu ý

- **Không chống trùng tên** cho kênh manual (unique chỉ theo email); có thể thêm cảnh báo UI nếu trùng tên — để phase sau nếu cần.
- Migration phải chạy trước khi deploy code.