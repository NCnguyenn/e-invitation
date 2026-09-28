import type { AppConfig } from '../types/config';

export const DEFAULT_CONFIG: AppConfig = {
  meta: {
    pageTitle: "BẢN GIAO HƯỞNG NÀNG THƠ // NGUYÊN MAI - NGÀY RỰC RỠ",
    shareTitle: "Thiệp Mời - Khoảnh Khắc Mộng Mơ & Ngập Tràn Sắc Hoa",
    shareDescription: "Một không gian lãng mạn, thanh tao ghi dấu chặng đường thanh xuân dịu dàng.",
    favicon: "/inmages2/cap_icon.png"
  },

  event: {
    badgeTop: "A POETIC CELEBRATION",
    badgeBottom: "Sweet Blossom Day",
    ownerName: "Nguyên Mai",
    subName: "CỬ NHÂN KINH TẾ QUỐC DÂN // NÀNG THƠ THANH XUÂN",
    defaultGuestName: "Bạn và Người thương",
    inviteGreeting: "TRÂN TRỌNG KÍNH MỜI",
    targetDate: "2026-09-28T10:45:00",
    timeString: "10:45, Thứ Hai",
    day: "28",
    month: "THÁNG 09",
    year: "NĂM 2026",
    calendar: {
      year: 2026,
      month: 9,
      highlightDay: 28,
      title: "NGÀY HOA NỞ RỘ // THÁNG 09.2026"
    },
    venue: {
      name: "Trường Đại Học Kinh Tế Quốc Dân (NEU)",
      subVenue: "Hội Trường A2 - Tòa Nhà Thế Kỷ // Khán Phòng Vinh Dự",
      address: "207 Giải Phóng, Phường Đồng Tâm, Quận Hai Bà Trưng, TP. Hà Nội",
      coordinates: "21.000078° N, 105.837670° E",
      mapDirectLink: "https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6",
      mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d14200.854671837249!2d105.8376696!3d21.0000781!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ac71752d8f79%3A0xd2ec575c01017afa!2zVHLGsOG7nW5nIMSQ4bqhaSBI4buNYyBLaW5oIFThur8gUXXhu5FjIETDom4gKE5FVSk!5e1!3m2!1svi!2s!4v1788418146019!5m2!1svi!2s"
    }
  },

  images: {
    heroPortrait: "/inmages2/hero-portrait.jpg",
    storyPortrait: "/inmages2/story-portrait.jpg",
    marqueePhotos: [
      "/inmages2/marquee-1.jpg",
      "/inmages2/marquee-2.jpg",
      "/inmages2/marquee-3.jpg",
      "/inmages2/gallery-1.jpg",
      "/inmages2/hero-portrait.jpg",
      "/inmages2/story-portrait.jpg"
    ],
    galleryPhotos: [
      {
        id: "gal-1",
        src: "/inmages2/hero-portrait.jpg",
        caption: "Nụ cười trong trẻo như tia nắng ban mai dịu ngọt",
        category: "NÀNG THƠ"
      },
      {
        id: "gal-2",
        src: "/inmages2/gallery-1.jpg",
        caption: "Giảng đường thân quen nơi ươm mầm bao ước vọng",
        category: "THANH XUÂN"
      },
      {
        id: "gal-3",
        src: "/inmages2/marquee-1.jpg",
        caption: "Từng trang sách mở ra những chân trời mộng mơ",
        category: "KỶ NIỆM"
      },
      {
        id: "gal-4",
        src: "/inmages2/marquee-2.jpg",
        caption: "Khoảnh khắc hoa tươi khoe sắc cùng những người bạn tri kỷ",
        category: "BẠN BÈ"
      },
      {
        id: "gal-5",
        src: "/inmages2/marquee-3.jpg",
        caption: "Sẵn sàng đón nhận những hành trình ngát hương phía trước",
        category: "NÀNG THƠ"
      },
      {
        id: "gal-6",
        src: "/inmages2/story-portrait.jpg",
        caption: "Tháng năm dịu dàng và phiên bản rạng ngời nhất của chính mình",
        category: "THANH XUÂN"
      }
    ],
    thankYouBanner: "/inmages2/marquee-3.jpg"
  },

  story: {
    heading: "NƠI NẮNG ẤM VÀ HOA NỞ BỞI VÌ BẠN",
    tagline: "// GỬI NHỮNG NĂM THÁNG THANH XUÂN DỊU DÀNG NHẤT",
    paragraphs: [
      "Những năm tháng vừa qua đến với mình tựa như một khúc ca mùa hạ trong trẻo — nơi có ánh nắng vương trên vai áo, có những giấc mơ dịu dàng và những nụ cười ấm áp của tình bạn.",
      "Điều trân quý nhất mình lưu giữ sau chặng đường ấy không chỉ là những dấu mốc trưởng thành, mà là những bài học sâu sắc, những kỷ niệm ngát hương hoa và một tâm hồn luôn biết ơn.",
      "Xin gửi lời cảm ơn tha thiết nhất tới gia đình, thầy cô và những người bạn tri kỷ đã luôn bao bọc, chở che và tiếp thêm cho mình sự tự tin để bước đi rực rỡ.",
      "Ngày hôm nay là một đóa hoa ngát hương đánh dấu chặng đường đã qua. Rất mong được đón tiếp bạn trong ngày vui ngọt ngào này!"
    ],
    signature: "Nguyên Mai"
  },

  rsvp: {
    title: "GỬI LỜI NHẮN & XÁC NHẬN THAM DỰ",
    subtitle: "SỰ HIỆN DIỆN CỦA BẠN LÀ ĐÓA HOA ĐẸP NHẤT TRONG NGÀY VUI NÀY",
    description: "Vui lòng gửi lại lời nhắn để mình chuẩn bị chỗ ngồi và phần quà tri ân chu đáo nhất dành cho bạn nhé.",
    acceptLabel: "CÓ, MÌNH CHẮC CHẮN SẼ ĐẾN CHUNG VUI 🌸",
    declineLabel: "RẤT TIẾC, MÌNH XIN GỬI LỜI CHÚC TỪ XA 💌",
    submitLabel: "GỬI LỜI CHÚC VÀ XÁC NHẬN",
    googleSheetWebhookUrl: ""
  },

  giftBox: {
    enabled: true,
    title: "HỘP QUÀ GỬI TRỌN YÊU THƯƠNG",
    description: "Nếu bạn ở xa hoặc muốn gửi gắm lời chúc mừng cùng món quà yêu thương đến Nguyên Mai:",
    accounts: [
      {
        bankName: "MB Bank (Ngân Hàng Quân Đội)",
        accountNumber: "999988886666",
        accountHolder: "NGUYEN MAI",
        qrImage: "https://api.vietqr.io/image/970422-999988886666-compact2.jpg?accountName=NGUYEN%20MAI&amount=0"
      }
    ]
  },

  thankYou: {
    title: "THANK YOU FOR BEING HERE",
    subtitle: "// TRI ÂN TẬN ĐÁY LÒNG",
    message: "Cảm ơn bạn vì đã luôn là một phần ngọt ngào trong chặng đường thanh xuân của mình.\nSự hiện diện và những lời chúc yêu thương của bạn sẽ làm cho ngày đặc biệt này trở nên vô cùng ý nghĩa.\nHẹn gặp bạn trong vườn hoa rực rỡ nhé!"
  },

  music: {
    enabled: true,
    audioSrc: "/audio/cong-tu-van-tho.mp3",
    songTitle: "Công Tử Văn Thơ",
    artist: "MONO",
    playlist: [
      {
        id: "track-1",
        title: "Công Tử Văn Thơ",
        artist: "MONO",
        src: "/audio/cong-tu-van-tho.mp3"
      },
      {
        id: "track-2",
        title: "Melody of Joy",
        artist: "Acoustic Romantic",
        src: "/music2.mp3"
      }
    ]
  },

  effects: {
    particles: true,
    particleType: "both",
    themeColor: "rose"
  }
};
