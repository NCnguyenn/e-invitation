import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { GuestResponse } from '@/features/guest/GuestResponse';
import { GuestAudioControl } from '@/features/guest/GuestAudioControl';
import { readGuestInvitation } from '@/features/guest/server';
import { resolveTemplateKey } from '@/features/template/resolve-key';
import { InvitationTemplate } from '@/features/template/InvitationTemplate';
import { TemplateUnavailable } from '@/features/template/TemplateUnavailable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const { token } = await params;
  const robots = { index: false, follow: false };
  try {
    const invitation = await readGuestInvitation(token);
    if (!invitation) return { title: 'Thiệp mời', robots };
    if (!resolveTemplateKey(invitation.event.templateKey)) {
      return { title: 'Mẫu thiệp không khả dụng', robots };
    }
    const place = invitation.event.venueName;
    return { title: invitation.event.title, description: place ? `${invitation.event.title} tại ${place}` : invitation.event.title, robots };
  } catch {
    return { title: 'Thiệp mời', robots };
  }
}
export default async function InvitePage({ params }: Props) {
  await connection();
  const { token } = await params;
  const invitation = await readGuestInvitation(token);
  if (!invitation) notFound();
  if (!resolveTemplateKey(invitation.event.templateKey)) {
    return <TemplateUnavailable />;
  }
  return (
    <InvitationTemplate
      mode="guest"
      invitation={invitation}
      responseArea={<GuestResponse invitation={invitation} token={token} />}
      audioControl={<GuestAudioControl token={token} hasMusic={invitation.event.hasMusic} />}
    />
  );
}

