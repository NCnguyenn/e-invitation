import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AdminHostItem } from '../contracts';
import { requireDeveloper } from '../server';
import { generateSecurePassword } from './password';
import { cleanupAllEventStorage } from './storage';
import { emailsById } from './auth-directory';
import { selectHostPage } from './host-page';
import { requireWriteData } from './delete-policy';
import { insertMaintenanceJob, markMaintenanceJob } from './maintenance-io';

export { generateSecurePassword };

function clampPage(page: number): number {
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function clampPageSize(pageSize: number): number {
  if (!Number.isInteger(pageSize) || pageSize < 1) return 50;
  return Math.min(pageSize, 100);
}

async function authPage(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  page: number,
  perPage: number,
) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  return {
    users: data?.users ?? [],
    error: error ? { message: error.message } : null,
  };
}

async function loadAllHostProfiles(supabase: ReturnType<typeof createAdminSupabaseClient>) {
  const pageSize = 1000;
  const maxPages = 20;
  const rows: Array<{ id: string; lifecycle_status: string; created_at: string }> = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, lifecycle_status, created_at')
      .eq('role', 'host')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Không thể tải hồ sơ host: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
  throw new Error('Không đủ trang hồ sơ host để tìm kiếm an toàn.');
}

async function eventCounts(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userIds: string[],
) {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;
  const { data, error } = await supabase.from('events').select('user_id').in('user_id', userIds);
  if (error) throw new Error(`Không thể đếm sự kiện: ${error.message}`);
  for (const event of data ?? []) {
    counts.set(event.user_id, (counts.get(event.user_id) || 0) + 1);
  }
  return counts;
}

function toHostItem(
  profile: { id: string; lifecycle_status: string; created_at: string },
  emails: Map<string, string>,
  counts: Map<string, number>,
): AdminHostItem {
  return {
    userId: profile.id,
    email: emails.get(profile.id) || '—',
    createdAt: profile.created_at,
    eventCount: counts.get(profile.id) || 0,
    lifecycleStatus: profile.lifecycle_status,
  };
}

export async function listAdminHosts(
  page = 1,
  pageSize = 50,
  search = '',
): Promise<{ hosts: AdminHostItem[]; totalCount: number }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();
  const safePage = clampPage(page);
  const safeSize = clampPageSize(pageSize);
  const query = search.trim();

  if (query) {
    const profiles = await loadAllHostProfiles(supabase);
    const ids = profiles.map((profile) => profile.id);
    const [emails, counts] = await Promise.all([
      emailsById((authPageNumber, perPage) => authPage(supabase, authPageNumber, perPage), ids),
      eventCounts(supabase, ids),
    ]);
    return selectHostPage(profiles.map((profile) => toHostItem(profile, emails, counts)), query, safePage, safeSize);
  }

  const from = (safePage - 1) * safeSize;
  const { data: hostProfiles, count, error: profileError } = await supabase
    .from('profiles')
    .select('id, lifecycle_status, created_at', { count: 'exact' })
    .eq('role', 'host')
    .range(from, from + safeSize - 1)
    .order('created_at', { ascending: false });

  if (profileError || !hostProfiles) {
    throw new Error(`Không thể tải danh sách profiles: ${profileError?.message || 'không có dữ liệu'}`);
  }
  if (count === null) throw new Error('Không thể đếm hồ sơ host.');

  const ids = hostProfiles.map((profile) => profile.id);
  const [emails, counts] = await Promise.all([
    emailsById((authPageNumber, perPage) => authPage(supabase, authPageNumber, perPage), ids),
    eventCounts(supabase, ids),
  ]);
  return {
    hosts: hostProfiles.map((profile) => toHostItem(profile, emails, counts)),
    totalCount: count,
  };
}

export async function createHostAction(email: string): Promise<{ email: string; password: string; userId: string }> {
  await requireDeveloper();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('Email không hợp lệ.');
  }

  const supabase = createAdminSupabaseClient();
  const password = generateSecurePassword(16);
  const { data, error } = await supabase.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes('already registered')) {
      throw new Error('Email này đã được đăng ký trong hệ thống.');
    }
    throw new Error(`Không thể tạo tài khoản host: ${error?.message || 'Lỗi không xác định'}`);
  }

  try {
    const profileWrite = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        role: 'host',
        lifecycle_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    requireWriteData(profileWrite, 'Không ghi được hồ sơ host');
  } catch (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }

  return {
    email: trimmedEmail,
    password,
    userId: data.user.id,
  };
}

export async function deleteHostAction(
  hostUserId: string,
  confirmationEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const developer = await requireDeveloper();
  if (developer.userId === hostUserId) {
    throw new Error('Bạn không thể tự xóa tài khoản của chính mình.');
  }

  const supabase = createAdminSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(hostUserId);
  if (userError || !userData.user) {
    throw new Error('Không tìm thấy tài khoản host cần xóa.');
  }
  if (userData.user.email?.trim().toLowerCase() !== confirmationEmail.trim().toLowerCase()) {
    throw new Error('Email xác nhận không khớp với tài khoản host cần xóa.');
  }

  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', hostUserId)
    .maybeSingle();
  if (profileError || !targetProfile) {
    throw new Error('Không tìm thấy hồ sơ người dùng cần xóa.');
  }
  if (targetProfile.role !== 'host') {
    throw new Error('Không được phép xóa tài khoản Developer qua chức năng xóa Host.');
  }

  const { data: hostEvents, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', hostUserId);
  if (eventsError) throw new Error(`Không thể đọc sự kiện của host: ${eventsError.message}`);
  const prefixes = (hostEvents ?? []).map((event) => `${hostUserId}/${event.id}`);
  const jobId = await insertMaintenanceJob(supabase, {
    kind: 'delete_host',
    targetId: hostUserId,
    prefixes,
    createdBy: developer.userId,
  });

  try {
    const markedHost = await supabase
      .from('profiles')
      .update({ lifecycle_status: 'deleting', updated_at: new Date().toISOString() })
      .eq('id', hostUserId)
      .select('id')
      .maybeSingle();
    requireWriteData(markedHost, 'Không khóa được host');

    if (prefixes.length > 0) {
      const markedEvents = await supabase
        .from('events')
        .update({ lifecycle_status: 'deleting', updated_at: new Date().toISOString() })
        .eq('user_id', hostUserId)
        .select('id');
      if (markedEvents.error) throw new Error(markedEvents.error.message);
    }

    await cleanupAllEventStorage(supabase, prefixes);
    const removed = await supabase.auth.admin.deleteUser(hostUserId);
    if (removed.error) throw new Error(removed.error.message);
    await markMaintenanceJob(supabase, jobId, 'completed', null);
  } catch (cleanError) {
    const message = cleanError instanceof Error ? cleanError.message : 'DELETE_HOST_FAILED';
    await markMaintenanceJob(supabase, jobId, 'failed', message).catch(() => undefined);
    throw new Error(message.startsWith('Không') ? message : `Không thể xóa host: ${message}`);
  }

  return { ok: true, message: `Đã xóa thành công host ${confirmationEmail} và toàn bộ tệp tin liên quan.` };
}
