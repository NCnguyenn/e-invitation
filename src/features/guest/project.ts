import type { GuestInvitation, RsvpReceipt, RsvpStatus } from '@/lib/contracts';

export class InconsistentInvitationError extends Error {
  constructor() {
    super('Invitation response is inconsistent');
    this.name = 'InconsistentInvitationError';
  }
}

export type GuestInvitationSource = {
  guestName: string;
  invitationNote: string | null;
  status: string;
  guestMessage: string | null;
  respondedAt: string | null;
  guestEmail?: string;
  event: {
    id: string;
    userId: string;
    title: string;
    eventDate: string;
    venueName: string | null;
    venueAddress: string | null;
    googleMapUrl: string | null;
    musicPath: string | null;
    templateKey?: string | null;
    lifecycleStatus: string;
  };
  host: { role: string; lifecycleStatus: string } | null;
};

function isStatus(value: string): value is RsvpStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined';
}

export function projectGuestInvitation(source: GuestInvitationSource): GuestInvitation | null {
  if (source.event.lifecycleStatus !== 'active' || source.host?.role !== 'host' || source.host.lifecycleStatus !== 'active') {
    return null;
  }
  if (!isStatus(source.status)) throw new InconsistentInvitationError();
  const decided = source.status === 'accepted' || source.status === 'declined';
  if (decided !== Boolean(source.respondedAt) || (!decided && source.guestMessage)) throw new InconsistentInvitationError();
  const receipt: RsvpReceipt | null = decided ? {
    status: source.status as 'accepted' | 'declined',
    guestMessage: source.guestMessage,
    respondedAt: new Date(source.respondedAt!).toISOString(),
  } : null;
  if (receipt && !Number.isFinite(Date.parse(receipt.respondedAt))) throw new InconsistentInvitationError();
  return {
    event: {
      id: source.event.id,
      title: source.event.title,
      eventDate: source.event.eventDate,
      timezone: 'Asia/Ho_Chi_Minh',
      venueName: source.event.venueName,
      venueAddress: source.event.venueAddress,
      googleMapUrl: source.event.googleMapUrl,
      hasMusic: Boolean(source.event.musicPath),
      templateKey: source.event.templateKey?.trim() || undefined,
    },
    guestName: source.guestName,
    invitationNote: source.invitationNote,
    status: source.status,
    receipt,
  };
}
