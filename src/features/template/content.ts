import { templateAssets } from './assets.generated';

export const asset = (file: string) => {
  const src = templateAssets[file];
  if (!src) throw new Error(`Unregistered template asset: ${file}`);
  return src;
};
export const content = {
  ownerName: 'Mai Hoa', badge: 'GRADUATION', subtitle: 'Ceremony',
  storyHeading: 'GIỮ LẠI THANH XUÂN ĐẸP NHẤT',
  story: [
    'Những năm tháng vừa qua đến với mình như một hành trình của tuổi trẻ, nơi có những ước mơ, những nỗ lực, những niềm vui và cả những lần trưởng thành sau mỗi trải nghiệm.',
    'Điều quý giá nhất mình mang theo sau những năm tháng ấy không phải là những thành tích đạt được, mà là những bài học, những kỷ niệm và phiên bản tốt hơn của chính mình.',
    'Cảm ơn bạn bè, thầy cô và gia đình vì đã cho mình một thanh xuân thật đẹp, nơi mình được học hỏi, được trải nghiệm và được gặp những người thật đặc biệt. Mong rằng dù mai này mỗi chúng ta có đi về những hướng khác nhau, vẫn sẽ luôn nhớ về những ngày tháng tuổi trẻ rực rỡ này.',
    'Cảm ơn vì đã trở thành một phần thật đặc biệt trong thanh xuân của mình!',
  ],
  gallery: [
    'Những nụ cười rạng rỡ của thanh xuân', 'Từng bước chân trên giảng đường yêu dấu',
    'Khoảnh khắc đón nhận niềm hạnh phúc', 'Bên những người bạn đồng hành tuyệt vời',
    'Lưu giữ thanh xuân rực rỡ nhất', 'Sẵn sàng cho một hành trình tương lai mới',
  ].map((caption, i) => ({ src: asset(`gallery-${i + 1}.webp`), caption })),
  thankYou: 'Cảm ơn vì đã cùng mình đi qua một chặng đường đáng nhớ.\nSự hiện diện và lời chúc của bạn sẽ khiến ngày đặc biệt này trở nên ý nghĩa hơn rất nhiều.\nHẹn gặp bạn vào ngày đặc biệt này nhé!',
};
