import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOrSyncMetrics } from '@/features/admin/metrics/sync';
import { unavailableInternalMetrics } from '@/features/admin/metrics/integrity';
import { listAdminHosts } from '@/features/admin/operations/hosts';
import { listAdminEvents } from '@/features/admin/operations/events';
import { listUnknownAttempts, listMaintenanceJobs } from '@/features/admin/operations/reconciliation';
import { listTemplateKeys } from '@/features/template/registry';
import { AdminShell } from '@/features/admin/components/AdminShell';

import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quản trị hệ thống | e-invitation',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SystemAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect('/login?returnTo=/system-admin');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, lifecycle_status')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.lifecycle_status !== 'active') {
    redirect('/login?returnTo=/system-admin');
  }

  if (profile.role === 'host') {
    redirect('/dashboard');
  }

  if (profile.role !== 'developer') {
    redirect('/login?returnTo=/system-admin');
  }

  // Load initial data for tabs in parallel
  const [metricsResult, hostsResult, eventsResult, unknownResult, jobsResult] = await Promise.all([
    getOrSyncMetrics(false).catch(() => ({
      snapshots: [],
      internalMetrics: unavailableInternalMetrics(),
      lastSyncedAt: null,
      isLocked: true,
      syncBlockedReason: 'lease_unavailable' as const,
    })),
    listAdminHosts(1, 50).catch(() => ({ hosts: [], totalCount: 0 })),
    listAdminEvents(1, 50).catch(() => ({ events: [], totalCount: 0 })),
    listUnknownAttempts(1, 50).catch(() => ({ attempts: [], totalCount: 0 })),
    listMaintenanceJobs(1, 50).catch(() => ({ jobs: [], totalCount: 0 })),
  ]);

  const availableTemplates = listTemplateKeys();

  return (
    <AdminShell
      developerEmail={authData.user.email || ''}
      initialSnapshots={metricsResult.snapshots}
      initialInternalMetrics={metricsResult.internalMetrics}
      initialSyncedAt={metricsResult.lastSyncedAt}
      initialSyncBlockedReason={metricsResult.syncBlockedReason ?? null}
      initialHosts={hostsResult.hosts}
      initialEvents={eventsResult.events}
      availableTemplates={availableTemplates}
      initialAttempts={unknownResult.attempts}
      initialJobs={jobsResult.jobs}
    />
  );
}
