import type { GuestInvitation } from '@/lib/contracts';
// Fake sample card. Never substitute this for another host's event.
export const previewInvitation: GuestInvitation = {
  event: {
    id: 'development-preview', title: 'Lễ tốt nghiệp của Nguyễn Mai',
    eventDate: '2026-09-28T10:45:00+07:00', timezone: 'Asia/Ho_Chi_Minh',
    venueName: 'Cao đẳng BTEC Cần Thơ',
    venueAddress: 'Đường Số 22, Khu Dân Cư Hoàng Quân, Phường Thường Thạnh, Cái Răng, Cần Thơ',
    googleMapUrl: 'https://www.google.com/maps/place/Cao+%C4%90%E1%BA%B3ng+Anh+Qu%E1%BB%91c+BTEC+FPT/@9.9820474,105.7552345,1255m/data=!3m2!1e3!4b1!4m6!3m5!1s0x31a0890701e30d25:0x5c3e76fca19e20cd!8m2!3d9.9820474!4d105.7578094!16s%2Fg%2F11m6c2dnbf?entry=ttu&g_ep=EgoyMDI2MDkyOC4wIKXMDSoASAFQAw%3D%3D', hasMusic: false,
    templateKey: 'wedding-floral-01',
  },
  guestName: 'Bạn và Người thương', invitationNote: 'Mong được gặp bạn trong ngày đặc biệt này!',
  status: 'pending', receipt: null,
};
