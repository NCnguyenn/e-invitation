import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { AdminEventItem, AdminGuestItem } from '../contracts';
import { requireDeveloper } from '../server';
import { isRegisteredTemplate } from '@/features/template/registry';
import { isGoogleMapsUrl } from '@/features/events/map-resolver';
import { cleanupAllEventStorage } from './storage';
import { emailsById } from './auth-directory';
import { requireWriteData } from './delete-policy';
import { insertMaintenanceJob, markMaintenanceJob } from './maintenance-io';

export async function listAdminEvents(
  page = 1,
  pageSize = 50,
  hostId?: string,
): Promise<{ events: AdminEventItem[]; totalCount: number }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from('events')
    .select('id, user_id, title, template_key, event_date, timezone, lifecycle_status, created_at', { count: 'exact' });

  if (hostId) {
    query = query.eq('user_id', hostId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: eventsData, count, error } = await query.range(from, to).order('created_at', { ascending: false });

  if (error || !eventsData) {
    throw new Error('Không thể tải danh sách sự kiện.');
  }

  const userIds = Array.from(new Set(eventsData.map((event) => event.user_id)));
  const emailMap = await emailsById(async (page, perPage) => {
    const { data, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    return { users: data?.users ?? [], error: listError ? { message: listError.message } : null };
  }, userIds);

  // Count invitations and RSVPs per event
  const eventIds = eventsData.map(e => e.id);
  const { data: invData } = await supabase
    .from('invitations')
    .select('event_id, status')
    .in('event_id', eventIds);

  const guestCountMap = new Map<string, number>();
  const respondedCountMap = new Map<string, number>();

  if (invData) {
    for (const inv of invData) {
      guestCountMap.set(inv.event_id, (guestCountMap.get(inv.event_id) || 0) + 1);
      if (inv.status === 'accepted' || inv.status === 'declined') {
        respondedCountMap.set(inv.event_id, (respondedCountMap.get(inv.event_id) || 0) + 1);
      }
    }
  }

  const events: AdminEventItem[] = eventsData.map(e => ({
    id: e.id,
    userId: e.user_id,
    hostEmail: emailMap.get(e.user_id) || '—',
    title: e.title,
    templateKey: e.template_key,
    eventDate: e.event_date,
    timezone: e.timezone,
    guestCount: guestCountMap.get(e.id) || 0,
    respondedCount: respondedCountMap.get(e.id) || 0,
    lifecycleStatus: e.lifecycle_status,
    createdAt: e.created_at,
  }));

  return {
    events,
    totalCount: count || events.length,
  };
}

export async function createEventAction(params: {
  hostUserId: string;
  title: string;
  templateKey: string;
  eventDate: string;
  timezone?: string;
  venueName?: string;
  venueAddress?: string;
  googleMapUrl?: string;
}): Promise<AdminEventItem> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();

  const title = params.title?.trim();
  if (!title || title.length > 255) {
    throw new Error('Tiêu đề sự kiện cần từ 1 đến 255 ký tự.');
  }

  if (!isRegisteredTemplate(params.templateKey)) {
    throw new Error(`Mẫu thiệp '${params.templateKey}' chưa được đăng ký trong Template Registry.`);
  }

  const parsedDate = new Date(params.eventDate);
  if (isNaN(parsedDate.getTime())) {
    throw new Error('Thời gian diễn ra sự kiện không hợp lệ.');
  }

  const timezone = params.timezone?.trim() || 'Asia/Ho_Chi_Minh';
  if (timezone !== 'Asia/Ho_Chi_Minh') {
    throw new Error('Hệ thống hiện tại chỉ hỗ trợ múi giờ Asia/Ho_Chi_Minh.');
  }

  const venueName = params.venueName?.trim() || null;
  if (venueName && venueName.length > 255) {
    throw new Error('Tên địa điểm không được vượt quá 255 ký tự.');
  }

  const venueAddress = params.venueAddress?.trim() || null;
  if (venueAddress && venueAddress.length > 2000) {
    throw new Error('Địa chỉ địa điểm không được vượt quá 2000 ký tự.');
  }

  const googleMapUrl = params.googleMapUrl?.trim() || null;
  if (googleMapUrl) {
    if (googleMapUrl.length > 2048) {
      throw new Error('Đường dẫn Google Maps không được vượt quá 2048 ký tự.');
    }
    if (!isGoogleMapsUrl(googleMapUrl)) {
      throw new Error('Đường dẫn Google Maps không hợp lệ hoặc nằm ngoài danh sách cho phép (maps.google.com, maps.app.goo.gl).');
    }
  }

  // Ensure host exists
  const { data: hostProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', params.hostUserId)
    .maybeSingle();

  if (profileError || !hostProfile) {
    throw new Error('Host được chọn không tồn tại.');
  }

  const insertData = {
    user_id: params.hostUserId,
    title,
    template_key: params.templateKey,
    event_date: parsedDate.toISOString(),
    timezone,
    venue_name: venueName,
    venue_address: venueAddress,
    google_map_url: googleMapUrl,
    lifecycle_status: 'active',
  };

  const { data: newEvent, error: insertError } = await supabase
    .from('events')
    .insert(insertData)
    .select()
    .single();

  if (insertError || !newEvent) {
    throw new Error(`Lỗi khi tạo sự kiện: ${insertError?.message || 'Không xác định'}`);
  }

  const { data: hostUser } = await supabase.auth.admin.getUserById(params.hostUserId);

  return {
    id: newEvent.id,
    userId: newEvent.user_id,
    hostEmail: hostUser?.user?.email || params.hostUserId,
    title: newEvent.title,
    templateKey: newEvent.template_key,
    eventDate: newEvent.event_date,
    timezone: newEvent.timezone,
    guestCount: 0,
    respondedCount: 0,
    lifecycleStatus: newEvent.lifecycle_status,
    createdAt: newEvent.created_at,
  };
}

export async function changeEventTemplateAction(
  eventId: string,
  newTemplateKey: string,
): Promise<{ ok: boolean; templateKey: string }> {
  await requireDeveloper();
  if (!isRegisteredTemplate(newTemplateKey)) {
    throw new Error(`Mẫu thiệp '${newTemplateKey}' chưa được đăng ký trong Template Registry.`);
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('events')
    .update({
      template_key: newTemplateKey,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (error) {
    throw new Error(`Không thể đổi template: ${error.message}`);
  }

  return { ok: true, templateKey: newTemplateKey };
}

export async function deleteEventAction(
  eventId: string,
  confirmationTitle: string,
): Promise<{ ok: boolean; message: string }> {
  const developer = await requireDeveloper();
  const supabase = createAdminSupabaseClient();

  // 1. Verify event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, user_id, title')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError || !event) {
    throw new Error('Không tìm thấy sự kiện cần xóa.');
  }

  if (event.title.trim().toLowerCase() !== confirmationTitle.trim().toLowerCase()) {
    throw new Error('Tiêu đề xác nhận không khớp với sự kiện cần xóa.');
  }

  const prefix = `${event.user_id}/${eventId}`;
  const jobId = await insertMaintenanceJob(supabase, {
    kind: 'delete_event',
    targetId: eventId,
    prefixes: [prefix],
    createdBy: developer.userId,
  });

  try {
    const marked = await supabase
      .from('events')
      .update({ lifecycle_status: 'deleting', updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select('id')
      .maybeSingle();
    requireWriteData(marked, 'Không khóa được sự kiện');
    await cleanupAllEventStorage(supabase, [prefix]);
    const deleted = await supabase.from('events').delete().eq('id', eventId);
    if (deleted.error) throw new Error(deleted.error.message);
    await markMaintenanceJob(supabase, jobId, 'completed', null);
  } catch (cleanError) {
    const message = cleanError instanceof Error ? cleanError.message : 'DELETE_EVENT_FAILED';
    await markMaintenanceJob(supabase, jobId, 'failed', message).catch(() => undefined);
    throw new Error(message.startsWith('Không') ? message : `Không thể xóa sự kiện: ${message}`);
  }

  return { ok: true, message: `Đã xóa sự kiện "${event.title}" và dọn sạch các tệp tin trong bộ nhớ.` };
}

export async function listEventGuestsAction(
  eventId: string,
  page = 1,
  pageSize = 50,
): Promise<{ guests: AdminGuestItem[]; totalCount: number }> {
  await requireDeveloper();
  const supabase = createAdminSupabaseClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from('invitations')
    .select('id, guest_name, guest_email, invitation_note, status, email_status, guest_message, responded_at, sent_at, last_send_attempt_at', { count: 'exact' })
    .eq('event_id', eventId)
    .range(from, to)
    .order('created_at', { ascending: false });

  if (error || !data) {
    throw new Error('Không thể tải danh sách khách mời của sự kiện.');
  }

  const guests: AdminGuestItem[] = data.map(d => ({
    id: d.id,
    guestName: d.guest_name,
    guestEmail: d.guest_email,
    invitationNote: d.invitation_note,
    status: d.status,
    emailStatus: d.email_status,
    guestMessage: d.guest_message,
    respondedAt: d.responded_at,
    sentAt: d.sent_at,
    lastSendAttemptAt: d.last_send_attempt_at,
  }));

  return {
    guests,
    totalCount: count || guests.length,
  };
}
