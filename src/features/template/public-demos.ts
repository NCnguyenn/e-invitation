import type { GuestInvitation } from '@/lib/contracts';

// Public samples are approved explicitly, independently of the customer registry.
export const PUBLIC_DEMO_KEYS = ['graduation-floral-01', 'graduation-editorial-01'] as const;
type PublicDemoKey = (typeof PUBLIC_DEMO_KEYS)[number];

const titles: Record<PublicDemoKey, string> = {
  'graduation-floral-01': 'Mẫu 1 · Tốt nghiệp Floral',
  'graduation-editorial-01': 'Mẫu 2 · Thanh xuân sang trang',
};

export function getPublicDemo(key: string): { title: string; invitation: GuestInvitation } | null {
  if (!(PUBLIC_DEMO_KEYS as readonly string[]).includes(key)) return null;
  const templateKey = key as PublicDemoKey;
  return {
    title: titles[templateKey],
    invitation: {
      event: {
        id: `public-demo-${templateKey}`,
        title: 'Lễ tốt nghiệp của Mai Hoa',
        eventDate: '2026-09-28T10:45:00+07:00',
        timezone: 'Asia/Ho_Chi_Minh',
        venueName: 'Trường Đại Học Kinh Tế Quốc Dân — Hội trường A2',
        venueAddress: '207 Giải Phóng, Phường Bạch Mai, TP. Hà Nội',
        googleMapUrl: 'https://maps.app.goo.gl/h1GSFr1NGz6rCiQS6',
        hasMusic: false,
        templateKey,
      },
      guestName: 'Bạn và Người thương',
      invitationNote: 'Mong được gặp bạn trong ngày đặc biệt này!',
      status: 'pending',
      receipt: null,
    },
  };
}
