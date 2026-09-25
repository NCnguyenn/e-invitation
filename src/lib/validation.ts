import type { RsvpDecision } from './contracts';
export class ValidationError extends Error {}
export type EventUpdate = {
  title: string; eventDate: string;
  venueName: string | null; venueAddress: string | null; googleMapUrl: string | null;
};

function text(value: unknown, label: string, max: number, required = false): string | null {
  if (value === null && !required) return null;
  if (typeof value !== 'string') throw new ValidationError(`${label} không hợp lệ.`);
  const trimmed = value.trim();
  if ((required && !trimmed) || [...trimmed].length > max) throw new ValidationError(`${label} ${required ? 'cần từ 1 đến' : 'không được quá'} ${max} ký tự.`);
  return trimmed || null;
}

export function eventDateToInputs(iso: string): { date: string; time: string } {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new ValidationError('Ngày giờ không hợp lệ.');
  const vietnam = new Date(date.getTime() + 7 * 3600_000).toISOString();
  return { date: vietnam.slice(0, 10), time: vietnam.slice(11, 16) };
}

export function vietnamDateTimeToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || Number(date.slice(0, 4)) < 1) throw new ValidationError('Vui lòng nhập ngày và giờ hợp lệ.');
  const parsed = new Date(`${date}T${time}:00+07:00`);
  if (!Number.isFinite(parsed.getTime())) throw new ValidationError('Ngày giờ không hợp lệ.');
  const roundtrip = eventDateToInputs(parsed.toISOString());
  if (roundtrip.date !== date || roundtrip.time !== time) throw new ValidationError('Ngày giờ không tồn tại.');
  return parsed.toISOString();
}

function validateIso(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new ValidationError('Ngày giờ phải có múi giờ.');
  // Check the literal calendar date before Date normalizes impossible dates.
  vietnamDateTimeToIso(value.slice(0, 10), value.slice(11, 16));
  if (Number(value.slice(17, 19)) > 59 || !Number.isFinite(Date.parse(value))) throw new ValidationError('Ngày giờ không hợp lệ.');
  return new Date(value).toISOString();
}

export function parseEventUpdate(input: unknown): EventUpdate {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Thông tin sự kiện không hợp lệ.');
  const body = input as Record<string, unknown>;
  const keys = ['title', 'eventDate', 'venueName', 'venueAddress', 'googleMapUrl'];
  if (Object.keys(body).some(key => !keys.includes(key))) throw new ValidationError('Có trường thông tin không được phép thay đổi.');
  const title = text(body.title, 'Tiêu đề', 255, true)!;
  const eventDate = validateIso(body.eventDate);
  const venueName = text(body.venueName, 'Địa điểm', 255);
  const venueAddress = text(body.venueAddress, 'Địa chỉ', 2000);
  const googleMapUrl = text(body.googleMapUrl, 'Liên kết Google Maps', 2048);
  if (googleMapUrl) {
    let url: URL;
    try { url = new URL(googleMapUrl); } catch { throw new ValidationError('Liên kết Google Maps không hợp lệ.'); }
    const mapsHost = ['maps.google.com', 'maps.app.goo.gl'].includes(url.hostname);
    const googleMapsPath = ['google.com', 'www.google.com'].includes(url.hostname) && (url.pathname === '/maps' || url.pathname.startsWith('/maps/'));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || /[\\\s]/.test(googleMapUrl) || !(mapsHost || googleMapsPath)) throw new ValidationError('Hãy nhập liên kết HTTPS của Google Maps.');
  }
  return { title, eventDate, venueName, venueAddress, googleMapUrl };
}
const INVITATION_TOKEN = /^[0-9a-f]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type InvitationCreate = { guestName: string; guestEmail: string; invitationNote: string | null };
export type RsvpSubmission = { decision: RsvpDecision; guestMessage: string | null };

export function isInvitationToken(value: string): boolean {
  return INVITATION_TOKEN.test(value);
}

function objectBody(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError(`${label} không hợp lệ.`);
  return input as Record<string, unknown>;
}

function rejectUnknown(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some(key => !keys.includes(key))) throw new ValidationError('Có trường thông tin không được phép.');
}

export function parseInvitationCreate(input: unknown): InvitationCreate {
  const body = objectBody(input, 'Thông tin khách mời');
  rejectUnknown(body, ['guestName', 'guestEmail', 'invitationNote']);
  const guestName = text(body.guestName, 'Tên khách', 255, true)!;
  if (typeof body.guestEmail !== 'string') throw new ValidationError('Email không hợp lệ.');
  const guestEmail = body.guestEmail.trim().toLowerCase();
  if (!guestEmail || [...guestEmail].length > 255 || !EMAIL.test(guestEmail)) throw new ValidationError('Email không hợp lệ.');
  const invitationNote = body.invitationNote === undefined ? null : text(body.invitationNote, 'Lời mời riêng', 500);
  return { guestName, guestEmail, invitationNote };
}

export function parseRsvpSubmission(input: unknown): RsvpSubmission {
  const body = objectBody(input, 'Phản hồi');
  rejectUnknown(body, ['decision', 'guestMessage']);
  if (body.decision !== 'accepted' && body.decision !== 'declined') throw new ValidationError('Hãy chọn tham gia hoặc từ chối.');
  const guestMessage = body.guestMessage === undefined ? null : text(body.guestMessage, 'Ghi chú', 1000);
  return { decision: body.decision, guestMessage };
}

export type InvitationUpdate = { guestName: string; guestEmail: string; invitationNote: string | null };

export function parseInvitationUpdate(input: unknown): InvitationUpdate {
  const body = objectBody(input, 'Thông tin khách mời');
  rejectUnknown(body, ['guestName', 'guestEmail', 'invitationNote']);
  const guestName = text(body.guestName, 'Tên khách', 255, true)!;
  if (typeof body.guestEmail !== 'string') throw new ValidationError('Email không hợp lệ.');
  const guestEmail = body.guestEmail.trim().toLowerCase();
  if (!guestEmail || [...guestEmail].length > 255 || !EMAIL.test(guestEmail)) throw new ValidationError('Email không hợp lệ.');
  const invitationNote = body.invitationNote === undefined ? null : text(body.invitationNote, 'Lời mời riêng', 500);
  return { guestName, guestEmail, invitationNote };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type HostInvitationsQuery = {
  page: number;
  status: 'all' | 'pending' | 'accepted' | 'declined';
  query: string;
};

const ALLOWED_INVITATION_STATUSES = ['all', 'pending', 'accepted', 'declined'] as const;

export function parseHostInvitationsQuery(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): HostInvitationsQuery {
  const getParam = (key: string): string | null => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key);
    const val = searchParams[key];
    if (Array.isArray(val)) return val[0] ?? null;
    return typeof val === 'string' ? val : null;
  };

  const rawPage = getParam('page');
  let page = 1;
  if (rawPage !== null && rawPage !== '') {
    const trimmed = rawPage.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError('Trang phải là số nguyên dương.');
    }
    page = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(page) || page <= 0) {
      throw new ValidationError('Trang phải là số nguyên dương.');
    }
  }

  const rawStatus = getParam('status');
  let status: 'all' | 'pending' | 'accepted' | 'declined' = 'all';
  if (rawStatus !== null && rawStatus !== '') {
    const trimmed = rawStatus.trim();
    if (!ALLOWED_INVITATION_STATUSES.includes(trimmed as (typeof ALLOWED_INVITATION_STATUSES)[number])) {
      throw new ValidationError('Trạng thái lọc không hợp lệ.');
    }
    status = trimmed as 'all' | 'pending' | 'accepted' | 'declined';
  }

  const rawQuery = getParam('query');
  const query = rawQuery ? rawQuery.replace(/[\r\n\t]/g, ' ').trim().slice(0, 255) : '';

  return { page, status, query };
}

export function escapePostgrestIlike(term: string): string {
  const sqlEscaped = term
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  const postgrestEscaped = sqlEscaped
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return `"%${postgrestEscaped}%"`;
}

export const MAX_AUDIO_BYTES = 10_485_760; // 10 MiB (10 * 1024 * 1024 bytes)
export const ALLOWED_AUDIO_MIME = 'audio/mpeg';

export type AudioPrepareInput = {
  mimeType: string;
  fileSize: number;
};

export function parseAudioPrepare(input: unknown): AudioPrepareInput {
  const body = objectBody(input, 'Thông tin tệp âm thanh');
  rejectUnknown(body, ['mimeType', 'fileSize']);
  if (body.mimeType !== ALLOWED_AUDIO_MIME) {
    throw new ValidationError('Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).');
  }
  const fileSize = body.fileSize;
  if (
    typeof fileSize !== 'number' ||
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_AUDIO_BYTES
  ) {
    throw new ValidationError('Dung lượng tệp phải lớn hơn 0 và không quá 10 MiB.');
  }
  return { mimeType: ALLOWED_AUDIO_MIME, fileSize };
}

export function canonicalAudioPath(userId: string, eventId: string): string {
  return `${userId}/${eventId}/music.mp3`;
}

export function isValidAudioMetadata(metadata: { size?: number; mimetype?: string } | null | undefined): boolean {
  if (!metadata) return false;
  const { size, mimetype } = metadata;
  const normalizedMime = typeof mimetype === 'string' ? mimetype.split(';')[0].trim().toLowerCase() : '';
  return (
    normalizedMime === ALLOWED_AUDIO_MIME &&
    typeof size === 'number' &&
    Number.isSafeInteger(size) &&
    size > 0 &&
    size <= MAX_AUDIO_BYTES
  );
}

export function parseSendInvitation(input: unknown): { requestId: string } {
  const body = objectBody(input, 'Yêu cầu gửi');
  rejectUnknown(body, ['requestId']);
  if (typeof body.requestId !== 'string' || !isUuid(body.requestId)) {
    throw new ValidationError('requestId không hợp lệ.');
  }
  return { requestId: body.requestId.toLowerCase() };
}


