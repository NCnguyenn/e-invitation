import 'server-only';
import type { EmailStatus } from '@/lib/contracts';
import { isInvitationToken, isUuid } from '@/lib/validation';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { classifyBrevoResponse, postBrevoOnce, type BrevoObserved, type BrevoSendPayload } from './brevo';
import { readEmailConfig } from './config';
import {
  EMAIL_ACCEPTED_HELP,
  EMAIL_CAP_HELP,
  EMAIL_FAILED_HELP,
  EMAIL_SENDING_HELP,
  EMAIL_UNKNOWN_HELP,
} from './labels';
import { buildInviteUrl, renderInvitationEmail } from './render';

export const STUB_BUDGET_DATE = '1999-12-31';

export class EmailServiceError extends Error {
  constructor() {
    super('Email service failed');
    this.name = 'EmailServiceError';
  }
}

export type EmailTransport = (payload: BrevoSendPayload) => Promise<BrevoObserved>;

export type SendInvitationResult =
  | { kind: 'completed'; emailStatus: EmailStatus; attemptId: string; invitePath: string; message: string }
  | { kind: 'cooldown'; retryAfterSeconds: number; invitePath: string; message: string }
  | { kind: 'internal_cap'; message: string }
  | { kind: 'unresolved'; emailStatus: EmailStatus; attemptId: string; invitePath: string; message: string }
  | { kind: 'request_conflict'; message: string }
  | { kind: 'not_found' }
  | { kind: 'config'; message: string };

type Snapshot = {
  guestName: string;
  guestEmail: string;
  invitationNote: string | null;
  eventTitle: string;
  eventDate: string;
  timezone: string;
  venueName: string | null;
  venueAddress: string | null;
  token: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  inviteUrl: string;
  senderEmail: string;
  senderName: string;
  toName: string;
};

type ReserveRow = {
  kind?: string;
  attempt_id?: string;
  attempt_status?: string;
  provider_message_id?: string | null;
  invite_path?: string;
  snapshot?: Snapshot | null;
  retry_after_seconds?: number;
};

type InvitationSource = {
  id: string;
  guest_name: string;
  guest_email: string;
  invitation_note: string | null;
  token: string;
  event_id: string;
};

type EventSource = {
  id: string;
  user_id: string;
  title: string;
  event_date: string;
  timezone: string;
  venue_name: string | null;
  venue_address: string | null;
  lifecycle_status: string;
};

function statusFromAttempt(status: string | undefined): EmailStatus {
  if (status === 'accepted') return 'sent';
  if (status === 'rejected') return 'failed';
  if (status === 'unknown') return 'unknown';
  return 'sending';
}

function messageFor(status: EmailStatus): string {
  if (status === 'sent') return EMAIL_ACCEPTED_HELP;
  if (status === 'failed') return EMAIL_FAILED_HELP;
  if (status === 'unknown') return EMAIL_UNKNOWN_HELP;
  return EMAIL_SENDING_HELP;
}

function resolveBudgetDate(explicit?: string): string | null {
  if (explicit) {
    if (process.env.SUPABASE_TARGET !== 'test' || !/^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
      throw new EmailServiceError();
    }
    return explicit;
  }
  if (process.env.EMAIL_TRANSPORT === 'stub' && process.env.SUPABASE_TARGET === 'test') {
    return STUB_BUDGET_DATE;
  }
  return null;
}

function stubObserved(payload: BrevoSendPayload): BrevoObserved {
  const email = payload.to[0]?.email ?? '';
  const local = email.split('@')[0] ?? '';
  if (local.startsWith('reject-')) {
    return { status: 400, body: { code: 'invalid_parameter', message: 'rejected' } };
  }
  if (local.startsWith('timeout-')) {
    return { status: 0, body: null, transportError: 'transport_timeout' };
  }
  if (local.startsWith('unknown-')) {
    return { status: 500, body: { code: 'invalid_parameter', message: 'unclear' } };
  }
  return { status: 201, body: { messageId: `<stub-${crypto.randomUUID()}@invitation.test>` } };
}

async function deliver(payload: BrevoSendPayload, apiKey: string, transport?: EmailTransport): Promise<BrevoObserved> {
  if (transport) return transport(payload);
  if (process.env.EMAIL_TRANSPORT === 'stub' && process.env.SUPABASE_TARGET === 'test') {
    return stubObserved(payload);
  }
  return postBrevoOnce({ apiKey, payload });
}

function toTransport(snapshot: Snapshot): BrevoSendPayload {
  return {
    sender: { email: snapshot.senderEmail, name: snapshot.senderName },
    to: [{ email: snapshot.guestEmail, name: snapshot.toName }],
    subject: snapshot.subject,
    htmlContent: snapshot.htmlContent,
    textContent: snapshot.textContent,
  };
}

function displayName(name: string): string {
  const trimmed = [...name.trim()].slice(0, 70).join('').trim();
  return trimmed || 'Khach';
}

export async function expireStaleEmailSends(userId: string): Promise<void> {
  if (!isUuid(userId)) return;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('expire_stale_email_sends', { p_actor_id: userId });
  if (error) { console.error('[email] expire_stale_email_sends rpc failed', error); throw new EmailServiceError(); }
}

async function loadOwnedInvitation(userId: string, invitationId: string): Promise<{
  invitation: InvitationSource;
  event: EventSource;
} | null> {
  const admin = createAdminSupabaseClient();
  const invitation = await admin
    .from('invitations')
    .select('id, guest_name, guest_email, invitation_note, token, event_id')
    .eq('id', invitationId)
    .maybeSingle();
  if (invitation.error) { console.error('[email] invitation lookup failed', invitation.error); throw new EmailServiceError(); }
  if (!invitation.data) return null;
  // Event and profile lookups are independent — run them concurrently.
  const [event, profile] = await Promise.all([
    admin
      .from('events')
      .select('id, user_id, title, event_date, timezone, venue_name, venue_address, lifecycle_status')
      .eq('id', invitation.data.event_id)
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('profiles').select('role, lifecycle_status').eq('id', userId).maybeSingle(),
  ]);
  if (event.error) { console.error('[email] event lookup failed', event.error); throw new EmailServiceError(); }
  if (!event.data || event.data.lifecycle_status !== 'active') return null;
  if (profile.error) { console.error('[email] profile lookup failed', profile.error); throw new EmailServiceError(); }
  if (profile.data?.role !== 'host' || profile.data.lifecycle_status !== 'active') return null;
  if (!isInvitationToken(invitation.data.token)) throw new EmailServiceError();
  return { invitation: invitation.data, event: event.data };
}

function buildSnapshot(
  invitation: InvitationSource,
  event: EventSource,
  siteUrl: string,
  senderEmail: string,
  senderName: string,
): Snapshot {
  const inviteUrl = buildInviteUrl(siteUrl, invitation.token);
  const rendered = renderInvitationEmail({
    guestName: invitation.guest_name,
    eventTitle: event.title,
    eventDateIso: event.event_date,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    invitationNote: invitation.invitation_note,
    inviteUrl,
  });
  return {
    guestName: invitation.guest_name,
    guestEmail: invitation.guest_email,
    invitationNote: invitation.invitation_note,
    eventTitle: event.title,
    eventDate: event.event_date,
    timezone: event.timezone,
    venueName: event.venue_name,
    venueAddress: event.venue_address,
    token: invitation.token,
    subject: rendered.subject,
    htmlContent: rendered.html,
    textContent: rendered.text,
    inviteUrl,
    senderEmail,
    senderName,
    toName: displayName(invitation.guest_name),
  };
}

async function reserve(
  userId: string,
  invitationId: string,
  requestId: string,
  snapshot: Snapshot,
  budgetDate: string | null,
): Promise<ReserveRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('reserve_email_send', {
    p_actor_id: userId,
    p_invitation_id: invitationId,
    p_request_id: requestId,
    p_payload: snapshot,
    p_budget_date: budgetDate,
  });
  if (error) { console.error('[email] reserve_email_send rpc failed', error); throw new EmailServiceError(); }
  return (data ?? {}) as ReserveRow;
}

async function claim(userId: string, attemptId: string): Promise<{ claimed: boolean; status?: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('claim_email_send', {
    p_actor_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) { console.error('[email] claim_email_send rpc failed', error); throw new EmailServiceError(); }
  const row = (data ?? {}) as { kind?: string; attempt_status?: string };
  return { claimed: row.kind === 'claimed', status: row.attempt_status };
}

async function loadSnapshot(userId: string, attemptId: string): Promise<Snapshot | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('email_send_attempts')
    .select('payload_snapshot')
    .eq('id', attemptId)
    .eq('actor_id', userId)
    .maybeSingle();
  if (error) { console.error('[email] loadSnapshot failed', error); throw new EmailServiceError(); }
  return (data?.payload_snapshot as Snapshot | null) ?? null;
}

async function finalize(
  userId: string,
  attemptId: string,
  outcome: 'accepted' | 'rejected' | 'unknown',
  messageId: string | null,
  errorCode: string | null,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('finalize_email_send', {
    p_actor_id: userId,
    p_attempt_id: attemptId,
    p_outcome: outcome,
    p_message_id: messageId,
    p_error_code: errorCode,
  });
  if (error) { console.error('[email] finalize_email_send rpc failed', error); throw new EmailServiceError(); }
}

function completed(status: EmailStatus, attemptId: string, invitePath: string): SendInvitationResult {
  return { kind: 'completed', emailStatus: status, attemptId, invitePath, message: messageFor(status) };
}

export async function sendInvitation(
  userId: string,
  invitationId: string,
  requestId: string,
  options: { transport?: EmailTransport; budgetDate?: string; persist?: typeof finalize } = {},
): Promise<SendInvitationResult> {
  if (!isUuid(userId) || !isUuid(invitationId) || !isUuid(requestId)) return { kind: 'not_found' };
  const config = readEmailConfig();
  if (!config.ok) return { kind: 'config', message: config.message };
  await expireStaleEmailSends(userId);

  const owned = await loadOwnedInvitation(userId, invitationId);
  if (!owned) return { kind: 'not_found' };
  const budgetDate = resolveBudgetDate(options.budgetDate);
  let snapshot = buildSnapshot(
    owned.invitation,
    owned.event,
    config.config.siteUrl,
    config.config.senderEmail,
    config.config.senderName,
  );
  let reserved = await reserve(userId, invitationId, requestId, snapshot, budgetDate);
  if (reserved.kind === 'payload_mismatch') {
    const refreshed = await loadOwnedInvitation(userId, invitationId);
    if (!refreshed) return { kind: 'not_found' };
    snapshot = buildSnapshot(
      refreshed.invitation,
      refreshed.event,
      config.config.siteUrl,
      config.config.senderEmail,
      config.config.senderName,
    );
    reserved = await reserve(userId, invitationId, requestId, snapshot, budgetDate);
  }

  const invitePath = reserved.invite_path ?? `/invite/${owned.invitation.token}`;
  if (reserved.kind === 'not_found') return { kind: 'not_found' };
  if (reserved.kind === 'request_conflict') {
    return { kind: 'request_conflict', message: 'Mã yêu cầu này đã dùng cho một thư mời khác. Không gửi thêm.' };
  }
  if (reserved.kind === 'cooldown') {
    return {
      kind: 'cooldown',
      retryAfterSeconds: reserved.retry_after_seconds ?? 60,
      invitePath,
      message: `Cần chờ ${reserved.retry_after_seconds ?? 60} giây trước lần gửi tiếp theo. Khoảng cách tính từ lúc giữ suất, kể cả khi lần trước thất bại.`,
    };
  }
  if (reserved.kind === 'internal_cap') return { kind: 'internal_cap', message: EMAIL_CAP_HELP };
  if (reserved.kind === 'unresolved') {
    const emailStatus = statusFromAttempt(reserved.attempt_status);
    return {
      kind: 'unresolved',
      emailStatus,
      attemptId: reserved.attempt_id ?? '',
      invitePath,
      message: emailStatus === 'unknown' ? EMAIL_UNKNOWN_HELP : 'Thư mời đang có một lần gửi chưa được giải quyết. Không tạo thêm lần gửi.',
    };
  }
  if (reserved.kind === 'payload_mismatch' || !reserved.attempt_id) throw new EmailServiceError();

  if (reserved.kind === 'replay' && reserved.attempt_status !== 'reserved') {
    return completed(statusFromAttempt(reserved.attempt_status), reserved.attempt_id, invitePath);
  }

  const claimed = await claim(userId, reserved.attempt_id);
  if (!claimed.claimed) {
    return completed(statusFromAttempt(claimed.status ?? reserved.attempt_status), reserved.attempt_id, invitePath);
  }

  const stored = reserved.snapshot ?? (await loadSnapshot(userId, reserved.attempt_id));
  if (!stored?.htmlContent || !stored.inviteUrl) {
    await persistOutcome(options.persist, userId, reserved.attempt_id, 'unknown', null, 'missing_snapshot');
    return completed('unknown', reserved.attempt_id, invitePath);
  }

  let observed: BrevoObserved;
  try {
    observed = await deliver(toTransport(stored), config.config.apiKey, options.transport);
  } catch {
    observed = { status: 0, body: null, transportError: 'transport_unreachable' };
  }
  const classified = observed.transportError
    ? { outcome: 'unknown' as const, errorCode: observed.transportError }
    : classifyBrevoResponse(observed.status, observed.body);
  if (classified.outcome === 'accepted') {
    const persisted = await persistOutcome(options.persist, userId, reserved.attempt_id, 'accepted', classified.messageId, null);
    return completed(persisted ? 'sent' : 'unknown', reserved.attempt_id, invitePath);
  }
  if (classified.outcome === 'rejected') {
    const persisted = await persistOutcome(options.persist, userId, reserved.attempt_id, 'rejected', null, classified.errorCode);
    return completed(persisted ? 'failed' : 'unknown', reserved.attempt_id, invitePath);
  }
  await persistOutcome(options.persist, userId, reserved.attempt_id, 'unknown', null, classified.errorCode);
  return completed('unknown', reserved.attempt_id, invitePath);
}

async function persistOutcome(
  persist: typeof finalize | undefined,
  userId: string,
  attemptId: string,
  outcome: 'accepted' | 'rejected' | 'unknown',
  messageId: string | null,
  errorCode: string | null,
): Promise<boolean> {
  const write = persist ?? finalize;
  try {
    await write(userId, attemptId, outcome, messageId, errorCode);
    return true;
  } catch {
    try {
      await write(userId, attemptId, outcome, messageId, errorCode);
      return true;
    } catch {
      return false;
    }
  }
}
