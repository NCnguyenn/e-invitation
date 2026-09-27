# ĐẶC TẢ THIẾT KẾ: TRANG SYSTEM ADMIN & GIÁM SÁT TÀI NGUYÊN FREE
**Mã tài liệu:** `SPEC-SYSTEM-ADMIN-01`

**Ngày lập:** 27/09/2026
**Căn cứ:** [YEU_CAU_DU_AN.md (v1.2)](file:///D:/Personal_Project/e-invitatio-main/YEU_CAU_DU_AN.md) — Mục 0, 2.1, 5, 7 và 9.

---

## 1. MỤC TIÊU VÀ PHẠM VI

Xây dựng phân hệ Quản trị Vận hành `/system-admin` dành riêng cho Developer, đáp ứng đầy đủ hai trọng tâm:
1. **Giám sát tài nguyên Free:** Theo dõi minh bạch hạn mức của các dịch vụ đám mây (Netlify, Supabase, Brevo, GitHub) theo đúng chuẩn mực Mục 7 của `YEU_CAU_DU_AN.md`.
2. **Quản trị nghiệp vụ & Đối soát:** Quản lý tạo Host (cấp mật khẩu 1 lần), tạo Event, gán Template, xem danh sách khách, xóa an toàn kèm dọn Storage, và đối soát các attempt email ở trạng thái `unknown`.

---

## 2. NGUYÊN TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ)

1. **Phân định 3 nhóm số liệu riêng biệt (Mục 7.2):**
   - **Số đo nền tảng (Platform API):** Chỉ hiển thị dữ liệu được đọc trực tiếp từ API chính thức đã kiểm chứng (Brevo account/SMTP report, Supabase Disk util/API counts). Không tự chế số, không thay `null` bằng `0`.
   - **Hạn mức công bố (Published Limits):** Bảng tham chiếu tĩnh từ tài liệu chính thức (có ngày đối chiếu 24/09/2026 và link nguồn). Tuyệt đối không ghép làm mẫu số trong thanh phần trăm giả lập quota tài khoản.
   - **Hoạt động ứng dụng (Application Activity):** Dữ liệu nội bộ từ PostgreSQL (tổng host, event, khách mời, RSVP, bộ đếm giữ suất 300 email/ngày).
2. **Chế độ `dashboard_only` cho các dịch vụ chưa có API hạn mức tin cậy:**
   - Netlify: v1 chỉ dẫn link sang *Team → Usage & billing*.
   - Supabase Quotas (Storage/Egress/Realtime/MAU): dẫn link sang Supabase Dashboard.
   - GitHub: dẫn link sang Billing & licensing.
3. **Cơ chế đồng bộ không dùng Cron (Mục 7.5):**
   - Mở admin đọc snapshot từ database. Chỉ khi snapshot > 5 phút mới kích hoạt gọi API nền tảng.
   - Dùng lease DB (`provider_sync_state`) với RPC đặc quyền `service_role` để ngăn race condition khi nhiều tab admin mở cùng lúc (single-flight lock).
   - Nút "Làm mới" giới hạn 1 lần / 60 giây. Tự động refresh 5 phút một lần chỉ khi tab đang active; tạm dừng khi tab bị ẩn.
4. **Phân quyền nghiêm ngặt (Mục 5.2):**
   - Chỉ tài khoản có `profiles.role === 'developer'` mới được vào `/system-admin`.
   - Host bị redirect về `/dashboard`, khách chưa đăng nhập redirect về `/login`.
   - Mọi server action kiểm tra session và role ở server; không tin cậy input từ client.
5. **Xóa an toàn & dọn file Storage (Mục 5.4):**
   - Đặt `lifecycle_status = 'deleting'`, ghi nhận `maintenance_jobs`, xóa object trong storage theo prefix rồi mới xóa row database hoặc auth user.
   - Yêu cầu developer gõ xác nhận tên event/email host trước khi xóa. Không được xóa chính mình hoặc developer cuối cùng.

---

## 3. KIẾN TRÚC HỆ THỐNG & CƠ SỞ DỮ LIỆU

### 3.1. Database Migration: `supabase/migrations/202609270002_system_admin_core.sql`

```sql
-- 1. Bảng lưu trữ metric snapshots
CREATE TABLE public.provider_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('supabase', 'brevo', 'netlify', 'github', 'internal')),
  scope_type text NOT NULL CHECK (scope_type IN ('project', 'organization', 'account', 'team', 'application')),
  scope_id text NOT NULL,
  metric_key text NOT NULL,
  display_name text NOT NULL,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'local')),
  value numeric,
  unit text NOT NULL CHECK (unit IN ('byte', 'count', 'credit', 'percentage', 'boolean', 'text')),
  limit_value numeric,
  remaining_value numeric,
  period_start timestamptz,
  period_end timestamptz,
  period_timezone text,
  provider_updated_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_kind text NOT NULL CHECK (source_kind IN ('api', 'documentation', 'internal', 'dashboard')),
  source_url text,
  endpoint text,
  field_path text,
  status text NOT NULL CHECK (status IN ('fresh', 'stale', 'not_connected', 'forbidden', 'rate_limited', 'unavailable', 'invalid_response', 'dashboard_only', 'not_applicable')),
  last_attempt_at timestamptz,
  error_code text,
  mapping_version text NOT NULL DEFAULT '1.0',
  source_checked_at date NOT NULL DEFAULT '2026-09-24',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_metric_unique UNIQUE (provider, scope_id, metric_key)
);

-- 2. Bảng quản lý lease đồng bộ (single-flight)
CREATE TABLE public.provider_sync_state (
  provider text NOT NULL,
  scope_id text NOT NULL,
  last_attempt_at timestamptz,
  next_allowed_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, scope_id)
);

-- 3. Bảng quản lý công việc bảo trì & dọn dẹp storage
CREATE TABLE public.maintenance_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('delete_event', 'delete_host', 'cleanup_assets')),
  target_id uuid NOT NULL,
  object_prefixes jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'failed', 'completed')),
  last_error_code text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Bỏ ràng buộc 1 host 1 event để hỗ trợ nhiều sự kiện cho 1 host
DROP INDEX IF EXISTS public.events_one_per_host;

-- 5. RPC quản lý lease đồng bộ
CREATE OR REPLACE FUNCTION public.acquire_provider_sync_lease(
  p_provider text,
  p_scope_id text,
  p_ttl_seconds int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lease_token uuid := gen_random_uuid();
  v_row public.provider_sync_state%ROWTYPE;
BEGIN
  INSERT INTO public.provider_sync_state (provider, scope_id, last_attempt_at, next_allowed_at, lease_until, lease_token)
  VALUES (p_provider, p_scope_id, NULL, v_now, NULL, NULL)
  ON CONFLICT (provider, scope_id) DO NOTHING;

  SELECT * INTO v_row FROM public.provider_sync_state
  WHERE provider = p_provider AND scope_id = p_scope_id
  FOR UPDATE;

  IF v_row.lease_until IS NOT NULL AND v_row.lease_until > v_now THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'locked', 'lease_until', v_row.lease_until);
  END IF;

  IF v_row.next_allowed_at IS NOT NULL AND v_row.next_allowed_at > v_now THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'cooldown', 'next_allowed_at', v_row.next_allowed_at);
  END IF;

  UPDATE public.provider_sync_state
  SET last_attempt_at = v_now,
      lease_until = v_now + (p_ttl_seconds || ' seconds')::interval,
      lease_token = v_lease_token,
      updated_at = v_now
  WHERE provider = p_provider AND scope_id = p_scope_id;

  RETURN jsonb_build_object('acquired', true, 'lease_token', v_lease_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_provider_sync_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_provider_sync_lease TO service_role;
```

---

## 4. TỔ CHỨC MÃ NGUỒN (MODULAR ARCHITECTURE)

```
src/
├── app/
│   └── system-admin/
│       ├── page.tsx               # Server Component với route guard kiểm tra role
│       └── loading.tsx            # Loading skeleton
├── features/
│   └── admin/
│       ├── contracts.ts           # Type definitions chuẩn hoá (MetricSnapshot, OperationResult)
│       ├── server.ts              # Route guard helper: getVerifiedDeveloper()
│       ├── metrics/
│       │   ├── brevo.ts           # Brevo API client (Account & SMTP Aggregated Report)
│       │   ├── supabase-mgmt.ts   # Supabase Management API client (Disk util, API counts)
│       │   ├── internal.ts        # Database aggregation (Host, Event, Guests, Daily counters)
│       │   ├── reference.ts       # Hạn mức công bố tĩnh (S1-S15)
│       │   └── sync.ts            # Quản lý lease, sync orchestration & snapshots
│       ├── operations/
│       │   ├── hosts.ts           # Tạo host cấp pass 1 lần, danh sách phân trang, xóa host
│       │   ├── events.ts          # Tạo event gán template, đổi template, xóa event
│       │   └── reconciliation.ts  # Đối soát email unknown, thử lại maintenance jobs
│       └── components/
│           ├── AdminShell.tsx     # Shell điều hướng 3 Tabs & thông tin phiên Developer
│           ├── MetricsTab.tsx     # Tab 1: 3 Khối theo dõi tài nguyên & nút refresh 60s
│           ├── HostEventTab.tsx   # Tab 2: Danh sách Host, modal tạo Host/Event, xem khách
│           ├── OperationsTab.tsx  # Tab 3: Bảng đối soát unknown & maintenance jobs
│           ├── MetricCard.tsx     # Thẻ hiển thị metric với trạng thái & nguồn
│           └── admin.module.css   # Bảng màu, layout responsive, typography chuyên nghiệp
scripts/
└── bootstrap-developer.mjs        # Script nâng quyền 1 user thành developer
```

---

## 5. THIẾT KẾ GIAO DIỆN & TƯƠNG TÁC (UI/UX)

### 5.1. Tab 1: Giám sát tài nguyên Free
- **Toolbar:** Trạng thái lần đồng bộ gần nhất, đếm ngược làm mới tự động (5 phút), nút **"Làm mới ngay"** (bị khóa trong 60 giây sau khi bấm để chống spam).
- **Khối 1: Số đo nền tảng (Nguồn: API chính thức):**
  - **Brevo Email Credits:** Số credits còn lại theo gói, loại credits, thời gian đồng bộ.
  - **Brevo SMTP Hôm nay:** Lượt request, delivered, bounces.
  - **Supabase Database Disk:** Kích thước filesystem, dung lượng đã dùng, còn trống (từ API chính thức `disk/util`).
  - **Supabase API Requests:** Lượt gọi API theo từng dịch vụ (auth, rest, storage, realtime).
  - *Nếu thiếu cấu hình:* Hiện badge `not_connected` màu xám kèm thông báo và nút hướng dẫn, tuyệt đối không điền số 0.
- **Khối 2: Hạn mức công bố (Nguồn: Tài liệu chính thức):**
  - Bảng danh mục đối chiếu: Netlify (300 credit/tháng), Supabase (500 MB DB, 1 GB Storage, 5 GB egress), Brevo (300 email/ngày), GitHub (Free repo/billing).
  - Kèm link đến tài liệu chính thức và ngày đối chiếu (24/09/2026).
- **Khối 3: Hoạt động nội bộ ứng dụng (Nguồn: Database):**
  - Thẻ thống kê: Tổng số Host, Tổng số Sự kiện, Tổng khách mời, Tỷ lệ phản hồi RSVP.
  - Thẻ Sổ gửi email nội bộ: 300 suất/ngày (số suất đã giữ, accepted, rejected, unknown).
- **Khối 4: Phím tắt đối chiếu nhanh (Dashboard Links):**
  - Mở trực tiếp trang Netlify Team Billing, Supabase Project Dashboard, Brevo Account, GitHub Billing.

### 5.2. Tab 2: Quản lý Host & Sự kiện
- **Quản lý Host:**
  - Danh sách Host (Email, số sự kiện sở hữu, ngày tạo, trạng thái).
  - Nút **"Tạo Host mới"**: Mở modal nhập Email -> server sinh mật khẩu ngẫu nhiên an toàn 16 ký tự -> hiển thị mật khẩu **MỘT LẦN DUY NHẤT** kèm nút copy để developer gửi cho khách hàng.
  - Nút **"Xóa Host"**: Modal bắt buộc nhập lại đúng email của Host để xác nhận. Kích hoạt quy trình dọn Storage trước rồi mới xóa tài khoản.
- **Quản lý Sự kiện:**
  - Bảng Sự kiện: Tiêu đề, Host sở hữu, Ngày diễn ra, `template_key`, số khách mời, số phản hồi.
  - Nút **"Tạo Sự kiện"**: Chọn Host, nhập tiêu đề, ngày giờ, chọn `template_key` từ `TEMPLATE_REGISTRY`.
  - Nút **"Đổi Template"**: Dropdown chọn mẫu có sẵn trong registry.
  - Nút **"Xem danh sách khách"**: Drawer/Modal xem danh sách khách của sự kiện đó để hỗ trợ kỹ thuật khi Host cần.

### 5.3. Tab 3: Vận hành & Đối soát
- **Bảng đối soát Email Unknown:**
  - Hiển thị các attempt gửi email bị gián đoạn hoặc timeout (`status = 'unknown'`).
  - Action đối soát: "Đánh dấu đã giải quyết" (kèm lý do) hoặc "Cho phép gửi lại dù có thể trùng" (ghi nhận người xử lý và thời điểm).
- **Bảng Maintenance Jobs:**
  - Danh sách các công việc dọn dẹp Storage/DB bị thất bại.
  - Nút **"Thử lại dọn dẹp"** để chạy lại các object prefix còn tồn đọng.

---

## 6. CHI TIẾT CÁC CA KIỂM THỬ NGHIỆM THU (MỤC 9)

1. **Phân quyền truy cập:**
   - Host thông thường truy cập `/system-admin` -> bị chuyển hướng ngay về `/dashboard`.
   - Người chưa đăng nhập -> chuyển hướng về `/login?returnTo=/system-admin`.
   - Developer có `role = 'developer'` -> hiển thị đầy đủ giao diện admin.
2. **Tuân thủ quy tắc số liệu (Mục 7.2):**
   - Khi không có `SUPABASE_MANAGEMENT_TOKEN`: Thẻ Disk & API Counts hiển thị `not_connected`, không crash và không hiển thị `0 MB`.
   - Không xuất hiện thanh progress bar `used / limit` nếu không có đủ 2 số đo cùng kỳ, cùng đơn vị từ API.
3. **Cơ chế Lease & Chống spam:**
   - Mở 2 tab admin và bấm "Làm mới" cùng lúc -> chỉ có 1 request gọi API ngoài, tab kia nhận thông báo hoặc dùng snapshot hiện tại.
   - Nút refresh khóa trong 60 giây sau khi bấm.
4. **Tạo Host & Hiện mật khẩu 1 lần:**
   - Tạo host thành công, mật khẩu hiện trong modal và biến mất khi đóng modal. Mật khẩu không nằm trong database logs hay API trả về sau này.
5. **Xóa an toàn Host/Event:**
   - Kiểm tra xóa event: File mp3 trong Storage bucket `audio` bị xóa trước khi record event bị xóa khỏi database.
   - Không cho phép developer tự xóa tài khoản của chính mình.
