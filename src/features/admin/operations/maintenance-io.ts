import type { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { requireWriteData } from './delete-policy';

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

export async function insertMaintenanceJob(
  supabase: AdminClient,
  job: {
    kind: 'delete_event' | 'delete_host' | 'cleanup_assets';
    targetId: string;
    prefixes: string[];
    createdBy: string;
  },
): Promise<string> {
  const inserted = await supabase
    .from('maintenance_jobs')
    .insert({
      kind: job.kind,
      target_id: job.targetId,
      object_prefixes: job.prefixes,
      status: 'running',
      created_by: job.createdBy,
    })
    .select('id')
    .maybeSingle();
  return requireWriteData(inserted, 'Không ghi được maintenance job').id;
}

export async function markMaintenanceJob(
  supabase: AdminClient,
  jobId: string,
  status: 'failed' | 'completed',
  lastErrorCode: string | null,
): Promise<void> {
  const updated = await supabase
    .from('maintenance_jobs')
    .update({
      status,
      last_error_code: lastErrorCode ? lastErrorCode.slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('id')
    .maybeSingle();
  requireWriteData(updated, 'Không cập nhật được maintenance job');
}
