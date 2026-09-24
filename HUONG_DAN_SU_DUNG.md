# HƯỚNG DẪN SỬ DỤNG VÀ CHÈN ẢNH VÀO THIỆP ĐIỆN TỬ

Chào bạn! Dưới đây là toàn bộ hướng dẫn chi tiết để bạn có thể xem trang web, chèn hình ảnh của chính bạn, chỉnh sửa chữ, ngày tháng, âm nhạc và gửi thiệp cho bạn bè, người thân.

---

## 🌟 CÁC CÁCH CHÈN HÌNH ẢNH CỦA BẠN VÀO THIỆP

Bạn có thể chọn 1 trong 3 cách cực kỳ dễ dàng dưới đây:

### CÁCH 1: Dùng công cụ "Thay ảnh & Sửa nhanh" trực tiếp trên web (DỄ NHẤT 🚀)
1. Mở file `index.html` bằng trình duyệt (Chrome, Cốc Cốc, Edge, Safari...).
2. Bấm vào nút màu xanh **"📸 Thay ảnh & Sửa nhanh"** ở góc dưới màn hình.
3. Bấm nút **Chọn tệp** (Choose File) để chọn ảnh từ máy tính hoặc điện thoại của bạn:
   - *Ảnh chân dung đầu trang*
   - *Ảnh phần Lời ngỏ / Tâm sự*
   - *Ảnh bìa chân trang Thank You*
4. Chỉnh sửa tên, ngày tháng, địa chỉ theo ý bạn rồi bấm **"Cập nhật & Xem thử"**.
5. Bạn có thể bấm **"Xuất file config.js"** để tải về file cấu hình lưu lại thông tin vừa chỉnh sửa.

---

### CÁCH 2: Chép ảnh vào thư mục `images/` (KHUYÊN DÙNG ĐỂ CHẠY LÂU DÀI 📂)
Trong thư mục `images/` đã có sẵn các vị trí ảnh. Bạn chỉ cần lấy ảnh của mình và lưu đè (hoặc đổi tên) trùng với các tên file sau:
- `hero-portrait.webp` (hoặc `.jpg`/`.png`): Ảnh chân dung chính trên cùng.
- `story-portrait.webp`: Ảnh chân dung ở phần câu chuyện / lời ngỏ.
- `thank-you-banner.webp`: Ảnh ở chân trang cảm ơn.
- `marquee-1.webp`, `marquee-2.webp`, `marquee-3.webp`, `marquee-4.webp`: 4 ảnh cuộn vô tận.
- `gallery-1.webp` đến `gallery-6.webp`: 6 ảnh trong album kỷ niệm.

*(Mẹo: Bạn có thể dùng định dạng `.jpg`, `.png`, hoặc `.webp` đều được)*

---

### CÁCH 3: Chỉnh sửa bằng file `config.js` (CHUYÊN NGHIỆP & TÙY BIẾN TỐI ĐA ✍️)
Mở file `config.js` bằng Notepad hoặc VS Code. Bạn sẽ thấy mọi thông tin được ghi chú bằng tiếng Việt rất rõ ràng:
- **Tên nhân vật chính:** Sửa dòng `ownerName: "Mai Hoa"` thành tên của bạn.
- **Tiêu đề sự kiện:** `badgeTop: "GRADUATION"` hoặc `"LỄ THÀNH HÔN"`, `"SINH NHẬT"`,...
- **Ngày giờ:** Sửa `targetDate: "2026-09-28T10:45:00"` để đồng hồ đếm ngược tự chạy.
- **Địa điểm & Bản đồ Google Maps:** Sửa `venue.name`, `venue.address`, `mapDirectLink`.
- **Đường dẫn ảnh:** Bạn có thể điền link ảnh online (ví dụ link Google Drive, Cloudinary, Facebook) hoặc tên file trong máy tính `images/anh_cua_ban.jpg`.
- **Số tài khoản / Mã QR nhận quà chúc mừng:** Sửa thông tin tại mục `giftBox`.
- **Nhạc nền:** Đổi file `music.mp3` bằng bài hát yêu thích của bạn.

---

## 💌 TÍNH NĂNG GỬI THIỆP VỚI TÊN KHÁCH MỜI RIÊNG BIỆT (CÁ NHÂN HÓA)
Bạn có thể tạo link gửi riêng cho từng người bạn để thiệp hiển thị đúng tên người đó!
Chỉ cần thêm đuôi `?guest=Tên_Khách` vào sau đường link trang web:
- Ví dụ: `https://tenmiencuaban.com/index.html?guest=Anh+Hoàng`  
  -> Thiệp sẽ hiện: **Kính mời: Anh Hoàng**
- Ví dụ: `index.html?guest=Bạn+Trang+Thân+Yêu`  
  -> Thiệp sẽ hiện: **Kính mời: Bạn Trang Thân Yêu**

---

## 🚀 HƯỚNG DẪN ĐƯA THIỆP LÊN MẠNG (ONLINE MIỄN PHÍ 100%)
Sau khi chỉnh sửa xong, bạn có thể đưa lên mạng hoàn toàn miễn phí để gửi link cho bạn bè bằng 1 trong các cách:
1. **GitHub Pages (Khuyên dùng):** Tạo repository trên GitHub và bật GitHub Pages.
2. **Vercel / Netlify:** Chỉ cần kéo thả toàn bộ thư mục `chi_mai` vào trang [netlify.com/drop](https://app.netlify.com/drop) là có ngay 1 trang web online trong 10 giây!

---
Chúc bạn có một chiếc thiệp điện tử thật rực rỡ và ý nghĩa! ✨
