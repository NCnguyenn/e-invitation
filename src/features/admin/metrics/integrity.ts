import type { InternalActivityMetrics } from '../contracts';

export function measuredCount(count: number | null | undefined, error: unknown): number | null {
  if (error) return null;
  if (typeof count !== 'number' || !Number.isFinite(count)) return null;
  return count;
}


export function canFetchProviders(input: {
  tableAvailable: boolean;
  leaseError: boolean;
  acquired: boolean;
}): boolean {
  return input.tableAvailable && !input.leaseError && input.acquired;
}

export function unavailableInternalMetrics(budgetDate: string | null = null): InternalActivityMetrics {
  return {
    status: 'unavailable',
    totalHosts: null,
    totalEvents: null,
    totalInvitations: null,
    rsvpBreakdown: {
      accepted: null,
      declined: null,
      pending: null,
      responded: null,
      total: null,
    },
    dailyEmailBudget: {
      budgetDate,
      cap: 300,
      reservedAttempts: null,
      acceptedAttempts: null,
      rejectedAttempts: null,
      unknownAttempts: null,
    },
  };
}
