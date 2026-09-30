import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { InternalActivityMetrics } from '../contracts';
import { measuredCount } from './integrity';

function vietnamBudgetDate(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

export async function fetchInternalActivityMetrics(): Promise<InternalActivityMetrics> {
  const supabase = createAdminSupabaseClient();
  const budgetDate = vietnamBudgetDate();

  const [
    hosts,
    events,
    invitations,
    accepted,
    declined,
    pending,
    counter,
    acceptedAttempts,
    rejectedAttempts,
    unknownAttempts,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'host'),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('invitations').select('*', { count: 'exact', head: true }),
    supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
    supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('status', 'declined'),
    supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('email_daily_counters').select('reserved_attempts').eq('budget_date', budgetDate).maybeSingle(),
    supabase.from('email_send_attempts').select('*', { count: 'exact', head: true }).eq('budget_date', budgetDate).eq('status', 'accepted'),
    supabase.from('email_send_attempts').select('*', { count: 'exact', head: true }).eq('budget_date', budgetDate).eq('status', 'rejected'),
    supabase
      .from('email_send_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('budget_date', budgetDate)
      .eq('status', 'unknown')
      .is('resolved_at', null),
  ]);

  const reserved = counter.error
    ? null
    : counter.data
      ? measuredCount(counter.data.reserved_attempts, null)
      : 0;
  const totalHosts = measuredCount(hosts.count, hosts.error);
  const totalEvents = measuredCount(events.count, events.error);
  const totalInvitations = measuredCount(invitations.count, invitations.error);
  const acceptedCount = measuredCount(accepted.count, accepted.error);
  const declinedCount = measuredCount(declined.count, declined.error);
  const pendingCount = measuredCount(pending.count, pending.error);
  const acceptedSend = measuredCount(acceptedAttempts.count, acceptedAttempts.error);
  const rejectedSend = measuredCount(rejectedAttempts.count, rejectedAttempts.error);
  const unknownSend = measuredCount(unknownAttempts.count, unknownAttempts.error);
  const responded = acceptedCount === null || declinedCount === null ? null : acceptedCount + declinedCount;
  const measured = [totalHosts, totalEvents, totalInvitations, acceptedCount, declinedCount, pendingCount, reserved, acceptedSend, rejectedSend, unknownSend];
  const missing = measured.filter((value) => value === null).length;

  return {
    status: missing === 0 ? 'ok' : missing === measured.length ? 'unavailable' : 'partial',
    totalHosts,
    totalEvents,
    totalInvitations,
    rsvpBreakdown: {
      accepted: acceptedCount,
      declined: declinedCount,
      pending: pendingCount,
      responded,
      total: totalInvitations,
    },
    dailyEmailBudget: {
      budgetDate,
      cap: 300,
      reservedAttempts: reserved,
      acceptedAttempts: acceptedSend,
      rejectedAttempts: rejectedSend,
      unknownAttempts: unknownSend,
    },
  };
}
