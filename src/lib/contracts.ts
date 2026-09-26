export type RsvpStatus = 'pending' | 'accepted' | 'declined';
export type RsvpDecision = Exclude<RsvpStatus, 'pending'>;
export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown';
export type RsvpReceipt = { status: RsvpDecision; guestMessage: string | null; respondedAt: string };
export type ApiFailure = { code: string; message: string; retryAfterSeconds?: number };
export type SubmitRsvpResult =
  | { kind: 'saved'; receipt: RsvpReceipt }
  | { kind: 'already_responded'; receipt: RsvpReceipt }
  | { kind: 'not_found' };
export type HostEvent = {
  id: string; title: string; eventDate: string; timezone: 'Asia/Ho_Chi_Minh';
  venueName: string | null; venueAddress: string | null; googleMapUrl: string | null; hasMusic: boolean;
  templateKey?: string;
};
export type GuestInvitation = {
  event: HostEvent; guestName: string; invitationNote: string | null;
  status: RsvpStatus; receipt: RsvpReceipt | null;
};

export type HostInvitationItem = {
  id: string;
  guestName: string;
  guestEmail: string;
  invitationNote: string | null;
  status: RsvpStatus;
  emailStatus: EmailStatus;
  hasSendHistory: boolean;
  canEdit: boolean;
  guestMessage: string | null;
  respondedAt: string | null;
  token: string;
  invitePath: string;
  createdAt: string;
  lastSendAttemptAt: string | null;
};

export type HostInvitationTotals = {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
};

export type HostInvitationsListResponse = {
  items: HostInvitationItem[];
  page: number;
  pageSize: number;
  filteredTotal: number;
  totals: HostInvitationTotals;
};
