import 'server-only';
import type { HostEvent } from '@/lib/contracts';
import {
  canonicalAudioPath,
  isValidAudioMetadata,
  ValidationError,
  type AudioPrepareInput,
  type EventUpdate,
} from '@/lib/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { previewReadUserId } from './preview-access';

const COLUMNS = 'id, title, event_date, timezone, venue_name, venue_address, google_map_url, music_path, template_key';
type EventRow = {
  id: string; title: string; event_date: string; timezone: string;
  venue_name: string | null; venue_address: string | null; google_map_url: string | null; music_path: string | null;
  template_key?: string | null;
};
function project(row: EventRow): HostEvent {
  return {
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    timezone: 'Asia/Ho_Chi_Minh',
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    googleMapUrl: row.google_map_url,
    hasMusic: Boolean(row.music_path),
    templateKey: row.template_key?.trim() || undefined,
  };
}
export async function readHostEvent(userId: string): Promise<HostEvent | null> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from('events').select(COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) { console.error('[events] readHostEvent failed', error); throw new Error('Event read failed'); }
  return data ? project(data) : null;
}

export async function readPreviewEvent(userId?: string): Promise<HostEvent | null> {
  const ownerId = previewReadUserId(userId);
  if (!ownerId) return null;
  return readHostEvent(ownerId);
}
export async function updateHostEvent(userId: string, input: EventUpdate): Promise<HostEvent | null> {
  // Use the user's session and RLS as well as the verified owner filter.
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from('events').update({
    title: input.title, event_date: input.eventDate, venue_name: input.venueName,
    venue_address: input.venueAddress, google_map_url: input.googleMapUrl,
  }).eq('user_id', userId).select(COLUMNS).maybeSingle();
  if (error) { console.error('[events] updateHostEvent failed', error); throw new Error('Event update failed'); }
  return data ? project(data) : null;
}

export async function prepareHostAudioUpload(
  userId: string,
  _input: AudioPrepareInput,
): Promise<{ bucket: string; path: string } | null> {
  const admin = createAdminSupabaseClient();
  const { data: event, error } = await admin
    .from('events')
    .select('id, lifecycle_status')
    .eq('user_id', userId)
    .eq('lifecycle_status', 'active')
    .maybeSingle();

  if (error) { console.error('[events] event check failed', error); throw new Error('Không thể kiểm tra sự kiện.'); }
  if (!event) return null;

  const profile = await admin.from('profiles').select('role, lifecycle_status').eq('id', userId).maybeSingle();
  if (profile.error || profile.data?.role !== 'host' || profile.data?.lifecycle_status !== 'active') return null;

  return {
    bucket: 'audio',
    path: canonicalAudioPath(userId, event.id),
  };
}

export async function finalizeHostAudio(userId: string): Promise<HostEvent | null> {
  const admin = createAdminSupabaseClient();
  const { data: event, error: readError } = await admin
    .from('events')
    .select('id, user_id, music_path, lifecycle_status')
    .eq('user_id', userId)
    .eq('lifecycle_status', 'active')
    .maybeSingle();

  if (readError) { console.error('[events] finalize event read failed', readError); throw new Error('Không thể kiểm tra thông tin sự kiện.'); }
  if (!event) return null;

  const profile = await admin.from('profiles').select('role, lifecycle_status').eq('id', userId).maybeSingle();
  if (profile.error || profile.data?.role !== 'host' || profile.data?.lifecycle_status !== 'active') return null;

  const expectedPath = canonicalAudioPath(userId, event.id);

  const { data: files, error: listError } = await admin.storage
    .from('audio')
    .list(`${userId}/${event.id}`);

  if (listError) {
    console.error('[events] storage list failed', listError);
    throw new Error('Không thể kiểm tra tệp âm thanh trong kho lưu trữ.');
  }

  const musicFile = files?.find((f) => f.name === 'music.mp3');
  if (!musicFile) {
    throw new ValidationError('Chưa tìm thấy tệp nhạc đã tải lên.');
  }

  if (!musicFile.metadata || !isValidAudioMetadata(musicFile.metadata)) {
    throw new ValidationError('Tệp âm thanh không đúng định dạng MP3 hoặc vượt quá 10 MiB.');
  }

  const { data: updated, error: updateError } = await admin
    .from('events')
    .update({ music_path: expectedPath })
    .eq('id', event.id)
    .eq('user_id', userId)
    .select(COLUMNS)
    .maybeSingle();

  if (updateError || !updated) {
    console.error('[events] finalize music_path update failed', updateError);
    throw new Error('Không thể lưu thông tin nhạc sự kiện.');
  }

  return project(updated);
}

export async function previewHostAudio(
  userId: string,
): Promise<{ signedUrl: string; expiresIn: number } | null> {
  const admin = createAdminSupabaseClient();
  const { data: event, error } = await admin
    .from('events')
    .select('id, user_id, music_path, lifecycle_status')
    .eq('user_id', userId)
    .eq('lifecycle_status', 'active')
    .maybeSingle();

  if (error) { console.error('[events] event check failed', error); throw new Error('Không thể kiểm tra sự kiện.'); }
  if (!event || !event.music_path) return null;

  const profile = await admin.from('profiles').select('role, lifecycle_status').eq('id', userId).maybeSingle();
  if (profile.error || profile.data?.role !== 'host' || profile.data?.lifecycle_status !== 'active') return null;

  const expectedPath = canonicalAudioPath(userId, event.id);
  if (event.music_path !== expectedPath) {
    return null;
  }

  const { data: files, error: listError } = await admin.storage
    .from('audio')
    .list(`${userId}/${event.id}`);

  if (listError) {
    console.error('[events] storage list failed', listError);
    throw new Error('Không thể kiểm tra tệp âm thanh trong kho lưu trữ.');
  }

  const musicFile = files?.find((f) => f.name === 'music.mp3');
  if (!musicFile) {
    return null;
  }

  const { data: signed, error: signError } = await admin.storage
    .from('audio')
    .createSignedUrl(event.music_path, 3600);

  if (signError || !signed?.signedUrl) {
    console.error('[events] createSignedUrl failed', signError);
    throw new Error('Không thể tạo liên kết nghe thử.');
  }

  return {
    signedUrl: signed.signedUrl,
    expiresIn: 3600,
  };
}


