/**
 * ====================================================================
 * FILE CẤU HÌNH THIỆP (CONFIG.JS)
 * ====================================================================
 * Bạn có thể dễ dàng chỉnh sửa toàn bộ thông tin, văn bản, ngày tháng,
 * địa chỉ, bản đồ, nhạc nền và các đường dẫn hình ảnh tại file này!
 *
 * MẸO CHÈN ẢNH CỦA BẠN:
 * 1. Chép ảnh của bạn vào thư mục 'images/'
 * 2. Đổi tên ảnh trùng với tên file trong thư mục 'images/' (ví dụ: hero-portrait.webp)
 *    HOẶC sửa đường dẫn bên dưới thành tên file ảnh của bạn (ví dụ: "images/anh_cua_toi.jpg")
 *    HOẶC dùng link ảnh online (ví dụ link Google Drive, Cloudinary, Imgur, Facebook,...)
 * ====================================================================
 */

const WEDDING_CONFIG = {
  // --- THÔNG TIN CHUNG ---
  meta: {
    pageTitle: "Thiệp Mời - Khoảnh Khắc Rực Rỡ",
    shareTitle: "Mẫu Thiệp Cho Khoảng Khắc Rực Rỡ",
    shareDescription: "Thiết kế nhẹ nhàng, tinh tế dành cho ngày đặc biệt ghi dấu hành trình đáng nhớ.",
    favicon: "images/cap-icon.png"
  },

  // --- LOẠI SỰ KIỆN & CHỦ NHÂN ---
  // Bạn có thể đổi thành Lễ Tốt Nghiệp, Lễ Thành Hôn, Lễ Vu Quy, Sinh Nhật, Event...
  event: {
    badgeTop: "GRADUATION", // Tiêu đề phụ phía trên (VD: WEDDING, GRADUATION, SAVE THE DATE)
    badgeBottom: "Ceremony", // Chữ nghệ thuật uốn lượn (VD: Ceremony, Invitation, Happy Day)
    
    // Tên nhân vật chính (Cô dâu & Chú rể HOẶC Người tốt nghiệp / Chủ tiệc)
    ownerName: "Mai Hoa",
    subName: "Cử Nhân Kinh Tế Quốc Dân", // Hoặc tên Chú Rể / Cô Dâu / Chức danh

    // Lời mời mặc định (nếu trên link không có ?guest=...)
    defaultGuestName: "Bạn và Người thương",
    inviteGreeting: "TRÂN TRỌNG KÍNH MỜI",
    
    // Ngày giờ tổ chức (Định dạng YYYY-MM-DD để đồng hồ đếm ngược tự động chạy)
    targetDate: "2026-09-28T10:45:00",
    
    // Hiển thị ngày giờ dạng chữ đẹp mắt
    timeString: "10:45, Thứ Hai",
    day: "28",
    month: "THÁNG 09",
    year: "NĂM 2026",
    
    // Lịch hiển thị tháng nào (Năm, Tháng 1-12, Ngày đánh dấu)
    calendar: {
      year: 2026,
      month: 9, // Tháng 9
      highlightDay: 28,
      title: "THÁNG 9 - 2026"
    },

    // Địa điểm tổ chức & Bản đồ
    venue: {
      name: "Trường Đại Học Kinh Tế Quốc Dân",
      subVenue: "Hội trường A2 - Tòa nhà Thế Kỷ",
      address: "207 Giải Phóng, Phường Bạch Mai, TP. Hà Nội",
      mapDirectLink: "https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6", // Link mở Google Maps trên điện thoại
      // Link nhúng iframe Google Maps (Có thể lấy từ Google Maps -> Chia sẻ -> Nhúng bản đồ)
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d14200.854671837249!2d105.8376696!3d21.0000781!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ac71752d8f79%3A0xd2ec575c01017afa!2zVHLGsOG7nW5nIMSQ4bqhaSBI4buNYyBLaW5oIFThur8gUXXhu5FjIETDom4gKE5FVSk!5e1!3m2!1svi!2s!4v1788418146019!5m2!1svi!2s"
    }
  },

  // --- HÌNH ẢNH TOÀN BỘ WEBSITE ---
  images: {
    // 1. Ảnh chân dung chính ở đầu trang
    heroPortrait: "images/hero-portrait.webp",

    // 2. Ảnh chân dung phần lời ngỏ / câu chuyện
    storyPortrait: "images/story-portrait.webp",

    // 3. Chuỗi ảnh chạy cuộn vô tận (Filmstrip Marquee)
    marqueePhotos: [
      "images/marquee-1.webp",
      "images/marquee-2.webp",
      "images/marquee-3.webp",
      "images/marquee-4.webp"
    ],

    // 4. Album kỷ niệm / Ảnh Gallery (Bấm vào xem phóng to toàn màn hình)
    galleryPhotos: [
      {
        src: "images/gallery-1.webp",
        caption: "Những nụ cười rạng rỡ của thanh xuân"
      },
      {
        src: "images/gallery-2.webp",
        caption: "Từng bước chân trên giảng đường yêu dấu"
      },
      {
        src: "images/gallery-3.webp",
        caption: "Khoảnh khắc đón nhận niềm hạnh phúc"
      },
      {
        src: "images/gallery-4.webp",
        caption: "Bên những người bạn đồng hành tuyệt vời"
      },
      {
        src: "images/gallery-5.webp",
        caption: "Lưu giữ thanh xuân rực rỡ nhất"
      },
      {
        src: "images/gallery-6.webp",
        caption: "Sẵn sàng cho một hành trình tương lai mới"
      }
    ],

    // 5. Ảnh bìa chân trang Thank You
    thankYouBanner: "images/thank-you-banner.webp"
  },

  // --- PHẦN TÂM SỰ / LỜI NGỎ / STORY ---
  story: {
    heading: "GIỮ LẠI THANH XUÂN ĐẸP NHẤT",
    paragraphs: [
      "Những năm tháng vừa qua đến với mình như một hành trình của tuổi trẻ, nơi có những ước mơ, những nỗ lực, những niềm vui và cả những lần trưởng thành sau mỗi trải nghiệm.",
      "Điều quý giá nhất mình mang theo sau những năm tháng ấy không phải là những thành tích đạt được, mà là những bài học, những kỷ niệm và phiên bản tốt hơn của chính mình.",
      "Cảm ơn bạn bè, thầy cô và gia đình vì đã cho mình một thanh xuân thật đẹp, nơi mình được học hỏi, được trải nghiệm và được gặp những người thật đặc biệt. Mong rằng dù mai này mỗi chúng ta có đi về những hướng khác nhau, vẫn sẽ luôn nhớ về những ngày tháng tuổi trẻ rực rỡ này.",
      "Cảm ơn vì đã trở thành một phần thật đặc biệt trong thanh xuân của mình!"
    ],
    signature: "Mai Hoa"
  },

  // --- PHẦN FORM XÁC NHẬN THAM DỰ (RSVP) ---
  rsvp: {
    title: "Xác Nhận Tham Dự",
    subtitle: "Sự hiện diện của bạn là niềm vinh hạnh to lớn đối với mình!",
    description: "Vui lòng cho mình biết bạn có thể sắp xếp tham dự chung vui được không nhé.",
    acceptLabel: "Có, mình chắc chắn sẽ tham dự ✨",
    declineLabel: "Rất tiếc, mình không thể tham dự 💌",
    submitLabel: "GỬI XÁC NHẬN",
    // Nếu bạn có link Google Form Script để lưu vào Google Sheets thì dán vào đây (tùy chọn)
    googleSheetWebhookUrl: ""
  },

  // --- HỘP MỪNG / QUÀ TẶNG (Tùy chọn bật/tắt: showGiftBox = true/false) ---
  giftBox: {
    enabled: true,
    title: "Gửi Quà Chúc Mừng",
    description: "Nếu bạn ở xa hoặc muốn gửi lời chúc mừng cùng món quà yêu thương:",
    accounts: [
      {
        bankName: "MB Bank (Quân Đội)",
        accountNumber: "999988886666",
        accountHolder: "NGUYEN MAI HOA",
        qrImage: "https://api.vietqr.io/image/970422-999988886666-compact2.jpg?accountName=NGUYEN%20MAI%20HOA&amount=0"
      }
    ]
  },

  // --- LỜI CẢM ƠN CUỐI TRANG ---
  thankYou: {
    title: "Thank You!",
    message: "Cảm ơn vì đã cùng mình đi qua một chặng đường đáng nhớ.\nSự hiện diện và lời chúc của bạn sẽ khiến ngày đặc biệt này trở nên ý nghĩa hơn rất nhiều.\nHẹn gặp bạn vào ngày đặc biệt này nhé!"
  },

  // --- ÂM NHẠC NỀN ---
  music: {
    enabled: true,
    audioSrc: "music.mp3", // File nhạc MP3 trong thư mục
    songTitle: "Melody of Joy",
    artist: "Acoustic Romantic"
  },

  // --- HIỆU ỨNG HOA / TRÁI TIM RƠI ---
  effects: {
    fallingPetals: true, // Bật/tắt hiệu ứng hoa rơi lãng mạn trên màn hình
    petalType: "flower" // 'flower' (cánh hoa đào/hoa hồng), 'heart' (trái tim), hoặc 'gold' (bụi vàng lấp lánh)
  }
};
