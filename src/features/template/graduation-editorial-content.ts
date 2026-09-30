const base = '/templates/graduation-editorial-01';
export const editorialAsset = (file: string) => `${base}/${file}`;

export const editorialContent = {
  ownerName: 'Nguyễn Mai',
  gallery: [
    'Những ngày rực rỡ đầu tiên',
    'Bạn bè và những buổi chiều trên giảng đường',
    'Khoảnh khắc chạm tay vào ước mơ',
    'Sẵn sàng cho chương mới',
    'Một hành trình thật đẹp',
  ].map((caption, index) => ({
    src: editorialAsset(`gallery-${index + 1}.webp`),
    caption,
  })),
  story: [
    'Sau những năm tháng nỗ lực, tớ đã đi đến chặng đường thật đáng nhớ này.',
    'Tớ muốn bạn có mặt để cùng tớ khép lại một hành trình đẹp và mở ra những ước mơ mới.',
    'Thanh xuân sẽ trọn vẹn hơn khi có bạn ở đây.',
  ],
};
