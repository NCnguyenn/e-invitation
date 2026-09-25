'use client';
import type { GuestInvitation } from '@/lib/contracts';
import { ResponseReceipt } from './ResponseReceipt';
import { RsvpForm } from './RsvpForm';

export function GuestResponse({ invitation, token }: { invitation: GuestInvitation; token: string }) {
  if (invitation.receipt) return <ResponseReceipt receipt={invitation.receipt} />;
  return <RsvpForm token={token} guestName={invitation.guestName} />;
}
