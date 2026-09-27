import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { getVerifiedHost } from '@/features/auth/server';
import { readPreviewEvent } from '@/features/events/server';
import { decidePreviewTemplate } from '@/features/events/preview-template-policy';
import { InvitationTemplate } from '@/features/template/InvitationTemplate';
import { previewInvitation } from '@/features/template/preview.fixture';
import { resolveTemplateKey } from '@/features/template/resolve-key';
import { TemplateUnavailable } from '@/features/template/TemplateUnavailable';
import type { GuestInvitation } from '@/lib/contracts';
import { InvitationEntrance } from '@/features/guest/InvitationEntrance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  searchParams: Promise<{ template?: string; guestName?: string }>;
};

export default async function PreviewPage({ searchParams }: Props) {
  await connection();
  const host = await getVerifiedHost();
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && !host) notFound();

  const params = await searchParams;
  const ownEvent = host ? await readPreviewEvent(host.userId) : null;
  const decision = decidePreviewTemplate({
    isDevelopment: isDev,
    hasHost: Boolean(host),
    requestedKey: params.template,
    ownEventKey: ownEvent?.templateKey,
    fallbackKey: previewInvitation.event.templateKey,
  }, resolveTemplateKey);
  if (decision.status === 'not_found') notFound();
  if (decision.status === 'unavailable') return <TemplateUnavailable />;
  const templateKey = decision.templateKey;

  const invitation: GuestInvitation = ownEvent
    ? {
        event: { ...ownEvent, templateKey },
        guestName: params.guestName || 'Bạn và Người thương',
        invitationNote: 'Mong được gặp bạn trong ngày đặc biệt này!',
        status: 'pending',
        receipt: null,
      }
    : {
        ...previewInvitation,
        guestName: params.guestName || previewInvitation.guestName,
        event: { ...previewInvitation.event, templateKey },
      };

  return (
    <InvitationEntrance guestName={invitation.guestName} invitationNote={invitation.invitationNote} eventTitle={invitation.event.title}>
      <InvitationTemplate
        invitation={invitation}
        mode="preview"
        previewContext={ownEvent ? 'host' : 'designer'}
      />
    </InvitationEntrance>
  );
}
