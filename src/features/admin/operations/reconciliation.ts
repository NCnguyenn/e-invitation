import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AdminUnknownAttempt, AdminMaintenanceJob } from '../contracts';
import { requireDeveloper } from '../server';
import { cleanupAllEventStorage } from './storage';
import { planMaintenanceRetry, requireWriteData } from './delete-policy';
import { markMaintenanceJob } from './maintenance-io';
import { assertResolvableUnknown } from './reconciliation-policy';

export async function listUnknownAttempts(
  page = 1,
  pageSize = 50,
): Promise<{ attempts: AdminUnknownAttempt[]; totalCount: number }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 50;
  const from = (safePage - 1) * safeSize;

  const res = await supabase
    .from('email_send_attempts')
    .select('id, invitation_id, budget_date, started_at, error_code, provider_message_id, resolved_at, resolution', { count: 'exact' })
    .eq('status', 'unknown')
    .is('resolved_at', null)
    .range(from, from + safeSize - 1)
    .order('created_at', { ascending: false });

  if (res.error) throw new Error(`Không thể tải attempt unknown: ${res.error.message}`);
  const attemptsData = res.data ?? [];
  if (res.count === null) throw new Error('Không thể đếm attempt unknown.');

  const invIds = attemptsData.map((attempt) => attempt.invitation_id).filter(Boolean) as string[];
  const invMap = new Map<string, { guest_name: string; guest_email: string; event_id: string }>();
  if (invIds.length > 0) {
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select('id, guest_name, guest_email, event_id')
      .in('id', invIds);
    if (error) throw new Error(`Không thể tải thư mời liên quan: ${error.message}`);
    for (const invitation of invitations ?? []) invMap.set(invitation.id, invitation);
  }

  const eventIds = Array.from(new Set(Array.from(invMap.values()).map((invitation) => invitation.event_id)));
  const eventMap = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events, error } = await supabase.from('events').select('id, title').in('id', eventIds);
    if (error) throw new Error(`Không thể tải sự kiện liên quan: ${error.message}`);
    for (const event of events ?? []) eventMap.set(event.id, event.title);
  }

  return {
    attempts: attemptsData.map((attempt) => {
      const invitation = attempt.invitation_id ? invMap.get(attempt.invitation_id) : null;
      return {
        id: attempt.id,
        invitationId: attempt.invitation_id,
        guestName: invitation?.guest_name || null,
        guestEmail: invitation?.guest_email || null,
        eventTitle: invitation ? eventMap.get(invitation.event_id) || null : null,
        budgetDate: attempt.budget_date,
        startedAt: attempt.started_at,
        errorCode: attempt.error_code,
        providerMessageId: attempt.provider_message_id,
        resolvedAt: attempt.resolved_at,
        resolution: attempt.resolution,
      };
    }),
    totalCount: res.count,
  };
}

export async function resolveUnknownAttemptAction(
  attemptId: string,
  resolution: string,
  allowResend: boolean,
): Promise<{ ok: boolean }> {
  const developer = await requireDeveloper();
  const supabase = createAdminSupabaseClient();
  const trimmedResolution = resolution.trim();
  if (!trimmedResolution) {
    throw new Error('Vui lòng nhập lý do hoặc phương án xử lý đối soát.');
  }

  const { data: attempt, error: attemptError } = await supabase
    .from('email_send_attempts')
    .select('id, invitation_id, status, resolved_at')
    .eq('id', attemptId)
    .maybeSingle();
  if (attemptError || !attempt) throw new Error('Không tìm thấy bản ghi email attempt.');

  let invitationEmailStatus: string | null = null;
  if (attempt.invitation_id) {
    const invitation = await supabase
      .from('invitations')
      .select('email_status')
      .eq('id', attempt.invitation_id)
      .maybeSingle();
    if (invitation.error) throw new Error(`Không thể đọc trạng thái thư: ${invitation.error.message}`);
    invitationEmailStatus = invitation.data?.email_status ?? null;
  }

  assertResolvableUnknown({
    status: attempt.status,
    resolved_at: attempt.resolved_at,
    invitationEmailStatus,
    allowResend,
  });

  const now = new Date().toISOString();
  const updated = await supabase
    .from('email_send_attempts')
    .update({
      resolved_at: now,
      resolved_by: developer.userId,
      resolution: trimmedResolution,
      updated_at: now,
    })
    .eq('id', attemptId)
    .is('resolved_at', null)
    .select('id')
    .maybeSingle();
  requireWriteData(updated, 'Không cập nhật được attempt');

  if (allowResend && attempt.invitation_id) {
    const reopened = await supabase
      .from('invitations')
      .update({
        email_status: 'pending',
        current_send_attempt_id: null,
        updated_at: now,
      })
      .eq('id', attempt.invitation_id)
      .eq('email_status', 'unknown')
      .select('id')
      .maybeSingle();
    requireWriteData(reopened, 'Không mở lại được lượt gửi');
  }

  return { ok: true };
}

export async function listMaintenanceJobs(
  page = 1,
  pageSize = 50,
): Promise<{ jobs: AdminMaintenanceJob[]; totalCount: number }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 50;
  const from = (safePage - 1) * safeSize;
  const res = await supabase
    .from('maintenance_jobs')
    .select('*', { count: 'exact' })
    .range(from, from + safeSize - 1)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(`Không thể tải maintenance job: ${res.error.message}`);
  if (res.count === null) throw new Error('Không thể đếm maintenance job.');

  return {
    jobs: (res.data ?? []).map((job) => ({
      id: job.id,
      kind: job.kind,
      targetId: job.target_id,
      objectPrefixes: Array.isArray(job.object_prefixes) ? job.object_prefixes : [],
      status: job.status,
      lastErrorCode: job.last_error_code,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })),
    totalCount: res.count,
  };
}

export async function retryMaintenanceJobAction(jobId: string): Promise<{ ok: boolean; message: string }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();
  const { data: job, error } = await supabase.from('maintenance_jobs').select('*').eq('id', jobId).maybeSingle();
  if (error || !job) throw new Error('Không tìm thấy maintenance job.');

  const plan = planMaintenanceRetry({ status: job.status, kind: job.kind });
  const prefixes = Array.isArray(job.object_prefixes) ? job.object_prefixes as string[] : [];

  try {
    if (plan.cleanupStorage) await cleanupAllEventStorage(supabase, prefixes);
    if (plan.deleteEventRow) {
      const deleted = await supabase.from('events').delete().eq('id', job.target_id);
      if (deleted.error) throw new Error(deleted.error.message);
    }
    if (plan.deleteAuthUser) {
      const existing = await supabase.auth.admin.getUserById(job.target_id);
      const missing = Boolean(existing.error && /not found/i.test(existing.error.message));
      if (existing.error && !missing) throw new Error(existing.error.message);
      if (existing.data?.user) {
        const removed = await supabase.auth.admin.deleteUser(job.target_id);
        if (removed.error) throw new Error(removed.error.message);
      }
    }
    await markMaintenanceJob(supabase, jobId, 'completed', null);
    return { ok: true, message: 'Đã hoàn tất dọn tệp và xóa bản ghi còn lại của maintenance job.' };
  } catch (cleanError) {
    const errorMsg = cleanError instanceof Error ? cleanError.message : 'DELETE_RETRY_FAILED';
    await markMaintenanceJob(supabase, jobId, 'failed', errorMsg).catch(() => undefined);
    throw new Error(`Thử lại thất bại: ${errorMsg}`);
  }
}
