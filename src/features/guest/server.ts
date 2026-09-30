import 'server-only';
import { cache } from 'react';
import { randomBytes } from 'node:crypto';
import type { GuestInvitation, RsvpDecision, RsvpReceipt, SubmitRsvpResult } from '@/lib/contracts';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { isInvitationToken, ValidationError } from '@/lib/validation';
import { InconsistentInvitationError, projectGuestInvitation, type GuestInvitationSource } from './project';

export class GuestServiceError extends Error {
  constructor() {
    super('Guest invitation service failed');
    this.name = 'GuestServiceError';
  }
}

type EventEmbed = {
  id: string; user_id: string; title: string; template_key?: string | null; event_date: string; venue_name: string | null;
  venue_address: string | null; google_map_url: string | null; music_path: string | null; lifecycle_status: string;
};
type InvitationEmbed = {
  guest_name: string; invitation_note: string | null; status: string;
  guest_message: string | null; responded_at: string | null; events: EventEmbed | EventEmbed[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function receipt(status: string, guestMessage: string | null, respondedAt: string): RsvpReceipt {
  const normalized = new Date(respondedAt).toISOString();
  if ((status !== 'accepted' && status !== 'declined') || !Number.isFinite(Date.parse(normalized))) throw new GuestServiceError();
  return { status, guestMessage, respondedAt: normalized };
}

export const readGuestInvitation = cache(async function readGuestInvitation(token: string): Promise<GuestInvitation | null> {
  if (!isInvitationToken(token)) return null;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from('invitations').select(
    'guest_name, invitation_note, status, guest_message, responded_at, events!inner(id, user_id, title, template_key, event_date, venue_name, venue_address, google_map_url, music_path, lifecycle_status)',
  ).eq('token', token).maybeSingle();
  if (error) { console.error('[guest] invitation read failed', error); throw new GuestServiceError(); }
  const row = data as InvitationEmbed | null;
  const event = one(row?.events);
  if (!row || !event) return null;
  const profile = await admin.from('profiles').select('role, lifecycle_status').eq('id', event.user_id).maybeSingle();
  if (profile.error) { console.error('[guest] profile read failed', profile.error); throw new GuestServiceError(); }
  try {
    return projectGuestInvitation({
      guestName: row.guest_name,
      invitationNote: row.invitation_note,
      status: row.status,
      guestMessage: row.guest_message,
      respondedAt: row.responded_at,
      event: {
        id: event.id, userId: event.user_id, title: event.title, eventDate: event.event_date,
        templateKey: event.template_key,
        venueName: event.venue_name, venueAddress: event.venue_address, googleMapUrl: event.google_map_url,
        musicPath: event.music_path, lifecycleStatus: event.lifecycle_status,
      },
      host: profile.data ? { role: profile.data.role, lifecycleStatus: profile.data.lifecycle_status } : null,
    } satisfies GuestInvitationSource);
  } catch (cause) {
    if (cause instanceof InconsistentInvitationError) { console.error('[guest] inconsistent invitation', cause); throw new GuestServiceError(); }
    throw cause;
  }
});

export async function submitRsvpOnce(token: string, decision: RsvpDecision, guestMessage: string | null): Promise<SubmitRsvpResult> {
  if (!isInvitationToken(token)) return { kind: 'not_found' };
  if (decision !== 'accepted' && decision !== 'declined') throw new ValidationError('Hãy chọn tham gia hoặc từ chối.');
  if (guestMessage !== null && [...guestMessage].length > 1000) throw new ValidationError('Ghi chú không được quá 1000 ký tự.');
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('submit_rsvp_once', {
    p_token: token, p_decision: decision, p_guest_message: guestMessage,
  });
  if (error) {
    if (error.code === '22023') throw new ValidationError('Phản hồi không hợp lệ.');
    console.error('[guest] submit_rsvp_once rpc failed', error);
    throw new GuestServiceError();
  }
  const row = (data ?? {}) as { kind?: string; status?: string; guest_message?: string | null; responded_at?: string };
  if (row.kind === 'not_found') return { kind: 'not_found' };
  if ((row.kind === 'saved' || row.kind === 'already_responded') && row.status && row.responded_at) {
    return { kind: row.kind, receipt: receipt(row.status, row.guest_message ?? null, row.responded_at) };
  }
  throw new GuestServiceError();
}

export function newInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

export type GuestAudioResult =
  | { kind: 'success'; signedUrl: string; expiresIn: number; expiresAt: string }
  | { kind: 'not_found' }
  | { kind: 'no_music' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

export async function requestGuestAudioUrl(token: string): Promise<GuestAudioResult> {
  if (!isInvitationToken(token)) return { kind: 'not_found' };
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('consume_audio_request_slot', { p_token: token });

  if (error) {
    if (error.code === '22023') return { kind: 'not_found' };
    console.error('[guest] consume_audio_request_slot rpc failed', error);
    throw new GuestServiceError();
  }

  const row = (data ?? {}) as {
    kind?: string;
    music_path?: string;
    retry_after_seconds?: number;
  };

  if (row.kind === 'not_found') return { kind: 'not_found' };
  if (row.kind === 'no_music') return { kind: 'no_music' };
  if (row.kind === 'rate_limited') {
    return {
      kind: 'rate_limited',
      retryAfterSeconds: Math.max(1, row.retry_after_seconds ?? 60),
    };
  }

  if (row.kind === 'allowed' && row.music_path) {
    const { data: signed, error: signError } = await admin.storage
      .from('audio')
      .createSignedUrl(row.music_path, 3600);

    if (signError || !signed?.signedUrl) {
      console.error('[guest] createSignedUrl failed', signError);
      throw new GuestServiceError();
    }

    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return {
      kind: 'success',
      signedUrl: signed.signedUrl,
      expiresIn,
      expiresAt,
    };
  }

  throw new GuestServiceError();
}

