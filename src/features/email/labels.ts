export const EMAIL_UNKNOWN_HELP = 'Chưa xác định kết quả, cần kiểm tra trước khi gửi lại.';
export const EMAIL_ACCEPTED_HELP = 'Brevo đã tiếp nhận thư. Điều này không có nghĩa thư đã vào hộp thư hoặc đã được đọc.';
export const EMAIL_FAILED_HELP = 'Dịch vụ email đã từ chối lần gửi này. Thư chưa được tiếp nhận.';
export const EMAIL_SENDING_HELP = 'Đang xử lý lần gửi này. Không gửi thêm.';
export const EMAIL_CAP_HELP = 'Đã đạt trần nội bộ 300 suất gửi chủ động trong ngày theo giờ Việt Nam cho toàn ứng dụng. Đây không phải hạn mức còn lại của Brevo.';

export function emailStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Chưa gửi';
    case 'sending':
      return 'Đang xử lý';
    case 'sent':
      return 'Brevo đã tiếp nhận';
    case 'failed':
      return 'Gửi thất bại';
    case 'unknown':
      return 'Chưa xác định kết quả';
    default:
      return 'Chưa xác định kết quả';
  }
}
