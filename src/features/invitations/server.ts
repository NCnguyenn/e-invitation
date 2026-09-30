import 'server-only';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { HostInvitationItem, HostInvitationTotals, HostInvitationsListResponse, RsvpStatus, EmailStatus } from '@/lib/contracts';
import { escapePostgrestIlike, isUuid, type HostInvitationsQuery, type InvitationCreate, type InvitationUpdate } from '@/lib/validation';
import { newInvitationToken } from '@/features/guest/server';
import { expireStaleEmailSends } from '@/features/email/server';

export class InvitationServiceError extends Error {
  constructor() {
    super('Invitation service failed');
    this.name = 'InvitationServiceError';
  }
}

export type CreateInvitationResult =
  | { kind: 'created'; invitationId: string; token: string }
  | { kind: 'duplicate'; invitationId: string; token: string }
  | { kind: 'no_event' };

type ExistingInvitation = { id: string; token: string };
type WriteError = { code?: string; message?: string; details?: string | null };

function isUniqueViolation(error: WriteError | null): boolean {
  return error?.code === '23505';
}

function mentionsEmailConstraint(error: WriteError): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  return text.includes('invitations_event_email_unique') || text.includes('guest_email');
}

export async function createHostInvitation(userId: string, input: InvitationCreate): Promise<CreateInvitationResult> {
  // Authenticated clients cannot insert invitations. Ownership is checked here before the service-role write.
  const admin = createAdminSupabaseClient();
  const event = await admin.from('events').select('id, lifecycle_status').eq('user_id', userId).maybeSingle();
  if (event.error) { console.error('[invitations] event read failed', event.error); throw new InvitationServiceError(); }
  if (!event.data || event.data.lifecycle_status !== 'active') return { kind: 'no_event' };
  const eventId = event.data.id;
  const profile = await admin.from('profiles').select('role, lifecycle_status').eq('id', userId).maybeSingle();
  if (profile.error) { console.error('[invitations] profile read failed', profile.error); throw new InvitationServiceError(); }
  if (profile.data?.role !== 'host' || profile.data.lifecycle_status !== 'active') return { kind: 'no_event' };

  const email = input.guestEmail.trim().toLowerCase();
  const payload = {
    event_id: eventId,
    guest_name: input.guestName.trim(),
    guest_email: email,
    invitation_note: input.invitationNote,
    status: 'pending',
    email_status: 'pending',
    has_send_history: false,
  };
  const existing = async (): Promise<ExistingInvitation | null> => {
    const found = await admin.from('invitations').select('id, token').eq('event_id', eventId).eq('guest_email', email).maybeSingle();
    if (found.error) { console.error('[invitations] existing lookup failed', found.error); throw new InvitationServiceError(); }
    return found.data;
  };
  const insert = async (token: string) => admin.from('invitations').insert({ ...payload, token }).select('id, token').single();

  let written = await insert(newInvitationToken());
  if (isUniqueViolation(written.error)) {
    if (!mentionsEmailConstraint(written.error!)) written = await insert(newInvitationToken());
    if (isUniqueViolation(written.error)) {
      const row = await existing();
      if (row) return { kind: 'duplicate', invitationId: row.id, token: row.token };
      throw new InvitationServiceError();
    }
  }
  if (written.error || !written.data) { console.error('[invitations] insert failed', written.error); throw new InvitationServiceError(); }
  return { kind: 'created', invitationId: written.data.id, token: written.data.token };
}

export const PAGE_SIZE = 50;

function projectHostInvitation(row: {
  id: string;
  guest_name: string;
  guest_email: string;
  invitation_note: string | null;
  status: string;
  email_status: string;
  has_send_history: boolean;
  token: string;
  guest_message: string | null;
  responded_at: string | null;
  created_at: string;
  last_send_attempt_at: string | null;
}): HostInvitationItem {
  return {
    id: row.id,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    invitationNote: row.invitation_note,
    status: row.status as RsvpStatus,
    emailStatus: row.email_status as EmailStatus,
    hasSendHistory: Boolean(row.has_send_history),
    canEdit: !row.has_send_history && row.email_status !== 'sending' && row.email_status !== 'unknown',
    guestMessage: row.guest_message,
    respondedAt: row.responded_at,
    token: row.token,
    invitePath: `/invite/${row.token}`,
    createdAt: row.created_at,
    lastSendAttemptAt: row.last_send_attempt_at,
  };
}

// Reconcile stale email sends at most once per host per window. The periodic
// cleanup itself is now owned by the pg_cron job (expire_all_stale_email_sends);
// this per-read throttle only keeps the dashboard view fresh without running the
// RPC on every poll.
const EXPIRE_THROTTLE_MS = 60_000;
const lastExpiryByUser = new Map<string, number>();

async function expireStaleEmailSendsThrottled(userId: string): Promise<void> {
  const last = lastExpiryByUser.get(userId) ?? 0;
  if (Date.now() - last < EXPIRE_THROTTLE_MS) return;
  lastExpiryByUser.set(userId, Date.now());
  try {
    await expireStaleEmailSends(userId);
  } catch (cause) {
    // Do not fail the read if reconciliation fails — the cron job will retry.
    console.error('[invitations] stale-send reconcile failed', cause);
  }
}

export async function readHostInvitations(
  userId: string,
  options: HostInvitationsQuery,
): Promise<HostInvitationsListResponse | null> {
  // Reconcile stale sends at most once per event-read window instead of on
  // every poll — a scheduled pg_cron job now owns periodic cleanup.
  await expireStaleEmailSendsThrottled(userId);
  const client = await createServerSupabaseClient();
  const event = await client.from('events').select('id, lifecycle_status').eq('user_id', userId).maybeSingle();
  if (event.error) { console.error('[invitations] event read failed', event.error); throw new InvitationServiceError(); }
  if (!event.data || event.data.lifecycle_status !== 'active') return null;
  const eventId = event.data.id;

  const buildQuery = () => {
    let q = client
      .from('invitations')
      .select(
        'id, guest_name, guest_email, invitation_note, status, email_status, has_send_history, token, guest_message, responded_at, created_at, last_send_attempt_at',
        { count: 'exact' },
      )
      .eq('event_id', eventId);

    if (options.status !== 'all') {
      q = q.eq('status', options.status);
    }

    if (options.query) {
      const pattern = escapePostgrestIlike(options.query);
      q = q.or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern}`);
    }

    q = q.order('created_at', { ascending: false }).order('id', { ascending: true });
    return q;
  };

  const requestedPage = options.page;
  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Page rows and the per-status rollup are independent — run them together.
  // The rollup uses a single GROUP BY RPC (service_role only); if the
  // migration has not been applied yet, fall back to the three count queries.
  const admin = createAdminSupabaseClient();
  const [result, countsRpc] = await Promise.all([
    buildQuery().range(from, to),
    admin.rpc('invitations_status_counts', { p_event_id: eventId }),
  ]);

  let pending = 0;
  let accepted = 0;
  let declined = 0;
  if (countsRpc.error) {
    // RPC missing (42883 / PGRST202) means the migration has not run yet — fall back.
    const isMissingFn = countsRpc.error.code === '42883' || countsRpc.error.code === 'PGRST202';
    if (!isMissingFn) {
      console.error('[invitations] status_counts rpc failed', countsRpc.error);
    }
    const [pendingCount, acceptedCount, declinedCount] = await Promise.all([
      client.from('invitations').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'pending'),
      client.from('invitations').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'accepted'),
      client.from('invitations').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'declined'),
    ]);
    if (pendingCount.error || acceptedCount.error || declinedCount.error) {
      console.error('[invitations] status count fallback failed', { pending: pendingCount.error, accepted: acceptedCount.error, declined: declinedCount.error });
      throw new InvitationServiceError();
    }
    pending = pendingCount.count ?? 0;
    accepted = acceptedCount.count ?? 0;
    declined = declinedCount.count ?? 0;
  } else {
    const counts = (countsRpc.data ?? {}) as { pending?: number; accepted?: number; declined?: number };
    pending = counts.pending ?? 0;
    accepted = counts.accepted ?? 0;
    declined = counts.declined ?? 0;
  }

  if (result.error) {
    console.error('[invitations] list read failed', result.error);
    throw new InvitationServiceError();
  }
  const totals: HostInvitationTotals = { total: pending + accepted + declined, pending, accepted, declined };

  const filteredTotal = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  let finalPage = requestedPage;
  let rows = result.data ?? [];

  if (requestedPage > totalPages) {
    finalPage = totalPages;
    const adjustedFrom = (finalPage - 1) * PAGE_SIZE;
    const adjustedTo = adjustedFrom + PAGE_SIZE - 1;
    const adjustedResult = await buildQuery().range(adjustedFrom, adjustedTo);
    if (adjustedResult.error) { console.error('[invitations] adjusted page read failed', adjustedResult.error); throw new InvitationServiceError(); }
    rows = adjustedResult.data ?? [];
  }

  return {
    items: rows.map(projectHostInvitation),
    page: finalPage,
    pageSize: PAGE_SIZE,
    filteredTotal,
    totals,
  };
}

export type UpdateInvitationResult =
  | { kind: 'updated'; invitation: HostInvitationItem }
  | { kind: 'not_found' }
  | { kind: 'locked' }
  | { kind: 'duplicate_email' };

export async function updateHostInvitation(
  userId: string,
  invitationId: string,
  input: InvitationUpdate,
): Promise<UpdateInvitationResult> {
  if (!isUuid(invitationId)) return { kind: 'not_found' };

  const client = await createServerSupabaseClient();
  const event = await client.from('events').select('id, lifecycle_status').eq('user_id', userId).maybeSingle();
  if (event.error) { console.error('[invitations] event read failed', event.error); throw new InvitationServiceError(); }
  if (!event.data || event.data.lifecycle_status !== 'active') return { kind: 'not_found' };
  const eventId = event.data.id;

  const email = input.guestEmail.trim().toLowerCase();
  const name = input.guestName.trim();
  const note = input.invitationNote;

  const { data, error } = await client
    .from('invitations')
    .update({
      guest_name: name,
      guest_email: email,
      invitation_note: note,
    })
    .eq('id', invitationId)
    .eq('event_id', eventId)
    .eq('has_send_history', false)
    .not('email_status', 'in', '("sending","unknown")')
    .select(
      'id, guest_name, guest_email, invitation_note, status, email_status, has_send_history, token, guest_message, responded_at, created_at, last_send_attempt_at',
    )
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return { kind: 'duplicate_email' };
    }
    if (error.code === '42501') {
      return { kind: 'locked' };
    }
    console.error('[invitations] update failed', error);
    throw new InvitationServiceError();
  }

  if (data) {
    return { kind: 'updated', invitation: projectHostInvitation(data) };
  }

  const existing = await client
    .from('invitations')
    .select('id, has_send_history, email_status')
    .eq('id', invitationId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing.error) { console.error('[invitations] existing read failed', existing.error); throw new InvitationServiceError(); }
  if (!existing.data) {
    return { kind: 'not_found' };
  }

  return { kind: 'locked' };
}

