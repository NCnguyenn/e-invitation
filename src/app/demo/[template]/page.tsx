import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InvitationEntrance } from '@/features/guest/InvitationEntrance';
import { InvitationTemplate } from '@/features/template/InvitationTemplate';
import { getPublicDemo, PUBLIC_DEMO_KEYS } from '@/features/template/public-demos';

export const dynamicParams = false;

type Props = { params: Promise<{ template: string }> };

export function generateStaticParams() {
  return PUBLIC_DEMO_KEYS.map(template => ({ template }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const demo = getPublicDemo((await params).template);
  if (!demo) notFound();
  return {
    title: demo.title,
    description: 'Mở thiệp mời tốt nghiệp mẫu và thử gửi lời hồi đáp. Phản hồi thử không được lưu.',
    robots: { index: false, follow: false },
  };
}

export default async function PublicDemoPage({ params }: Props) {
  const demo = getPublicDemo((await params).template);
  if (!demo) notFound();
  const { invitation } = demo;
  return (
    <InvitationEntrance
      guestName={invitation.guestName}
      invitationNote={invitation.invitationNote}
      eventTitle={invitation.event.title}
    >
      <InvitationTemplate invitation={invitation} mode="preview" />
    </InvitationEntrance>
  );
}
