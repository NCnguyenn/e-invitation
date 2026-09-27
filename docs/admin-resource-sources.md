# Nguồn hạn mức tài nguyên Admin

Các URL chính thức dưới đây đã được đọc qua Jina Reader ngày **2026-09-27**. `checkedAt` của registry là ngày xác minh tài liệu, không phải ngày đo mức dùng tài khoản. Các đoạn trích ngắn dưới đây đủ để kiểm tra giá trị và phạm vi, còn dashboard nhà cung cấp là nơi xem usage thực tế.

| Nhà cung cấp | Nguồn đã đọc và bằng chứng | Diễn giải trong registry |
| --- | --- | --- |
| Netlify | [How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/): “Free … 300 credits/month”; “Production deploys … 15 credits each”; “Compute … 10 credits per GB-hour”; “Bandwidth … 20 credits per GB”; “Web requests … 2 credits per 10,000 requests”. | Credit-based Free là pool theo team; các rate là cách trừ cùng pool, không phải quota độc lập. Trang này nói về credit-based plans, không chứng minh tài khoản dùng legacy plan đã chuyển sang credit model. |
| Supabase | [Pricing](https://supabase.com/pricing): “500 MB database size per project”; “1 GB file storage”; “50,000 monthly active users”; “Messages Per Month … 2 Million”; “Concurrent Peak Connections … 200”. [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress): “Cached and uncached egress have independent quotas”; “Free … 5 GB / 5 GB”; “organization's usage page … all projects by default”. [Realtime limits](https://supabase.com/docs/guides/realtime/limits): “Concurrent connections … Free … 200”. | Database theo project. Egress theo organization, có thể lọc project để xem thành phần. Realtime monthly message quota nằm ở pricing; concurrent connection limit cũng được ghi ở Realtime limits. Filesystem size và API request không thay thế usage billing. |
| Brevo | [Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan): “300 email sends per day”; “up to 100,000 contacts”; “always include the Sent with Brevo sticker”. | Điều kiện theo tài khoản Free. Sổ gửi nội bộ của ứng dụng chỉ ghi các lượt do ứng dụng xử lý. |
| GitHub | [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): “GitHub Free … 500 MB … 2,000 … 10 GB”; “artifact storage amounts shown are shared with GitHub Packages”; “free … public repositories that use standard GitHub-hosted runners”. [Caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows): “By default, the limit is 10 GB per repository”. | 2.000 phút/tháng là allowance của tài khoản/chủ repo khi dùng standard GitHub-hosted runners trên repo private. Artifact và Packages chia sẻ 500 MB; cache có 10 GB riêng theo repository. Public repo dùng standard hosted runners hoặc self-hosted runners có điều kiện tính phí khác. |

Không có adapter nào được phép suy ra phần trăm còn lại từ dữ liệu nghiệp vụ. Nếu tài liệu thay đổi, đọc lại URL chính thức và cập nhật `checkedAt` cùng bằng chứng.

## Cách theo dõi và triển khai

- Khi mở mục **Tài nguyên**, giao diện tự yêu cầu số liệu mỗi 5 phút. Tab trình duyệt bị ẩn dừng gọi API; khi quay lại sẽ làm mới nếu quá hạn. Đây không phải tác vụ nền 24/7 khi đóng trang.
- Số đo API hết TTL 5 phút hoặc hết kỳ báo cáo chuyển sang **cũ**, kể cả khi đang xem mục Tổng quan. Lỗi API giữ số đo tốt gần nhất cùng thời điểm gốc; không thay dữ liệu thiếu bằng 0. Khi request toàn trang lỗi, bộ đếm nội bộ không còn được hiển thị như số liệu hiện tại.
- Có 11 phép đo được khai báo: Brevo email credits/SMTP requests/delivered/bounces và Supabase filesystem size/used/available cùng 4 bộ đếm API. Những phép đo này không bao phủ mọi quota billing. Netlify, GitHub và các quota chưa có API mapping phải đối chiếu dashboard.
- `checkedAt` của hạn mức công bố đã xác minh ngày 2026-09-27. `source_checked_at` của API mapping giữ ngày kiểm tra contract trước đó (2026-09-24); không thay ngày contract chỉ vì đã đọc lại trang pricing.
- Cấu hình phía server: `BREVO_API_KEY`, `SUPABASE_MANAGEMENT_TOKEN`, `SUPABASE_PROJECT_REF`. Có thể đặt `METRICS_ENVIRONMENT` thành `production`, `staging` hoặc `local` để tách dữ liệu theo môi trường. Không đưa các credential này vào biến `NEXT_PUBLIC_*`.
- Áp dụng `supabase/migrations/202609270003_provider_metric_integrity.sql` sau migration `202609270002_system_admin_core.sql`, trước khi đưa code mới vào môi trường chạy thật. Migration thêm uniqueness theo environment và RPC chỉ cho phép tiến trình đang giữ lease ghi snapshot. Code không fallback về ghi trực tiếp nếu RPC thiếu; sẽ báo không lưu được số đo.
- Lần sửa này chưa áp dụng migration trên database từ xa, chưa deploy và chưa đối soát usage tài khoản thật. PostgreSQL cục bộ không sẵn có để chạy migration; phần SQL đã được rà soát nhưng cần kiểm chứng ở môi trường triển khai.

## Kiểm chứng thay đổi

```powershell
node --test tests/admin-context.test.mjs tests/admin-adapters.test.mjs tests/admin-metrics.test.mjs tests/admin-remediation.test.mjs tests/admin-sync.test.mjs
node tests/admin-resources.browser.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
git diff --check
```

Browser test dùng fixture riêng import component thật, dữ liệu mô phỏng và Chrome cục bộ; không bỏ qua xác thực của `/system-admin` production. Kiểm tra dữ liệu thiếu/0, stale/partial, nguồn hạn mức, lỗi/timeout, tránh request trùng, ẩn/hiện tab và màn hình 360/1440px.
