import type { GuestInvitation } from '@/lib/contracts';
// This fixture is imported only after the development route guard.
export const previewInvitation: GuestInvitation = {
  event: {
    id: 'development-preview', title: 'Lễ tốt nghiệp của Mai Hoa',
    eventDate: '2026-09-28T10:45:00+07:00', timezone: 'Asia/Ho_Chi_Minh',
    venueName: 'Trường Đại Học Kinh Tế Quốc Dân — Hội trường A2',
    venueAddress: '207 Giải Phóng, Phường Bạch Mai, TP. Hà Nội',
    googleMapUrl: 'https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6', hasMusic: false,
  },
  guestName: 'Bạn và Người thương', invitationNote: 'Mong được gặp bạn trong ngày đặc biệt này!',
  status: 'pending', receipt: null,
};
