import { isInvitationToken } from '@/lib/validation';

export class SiteUrlError extends Error {
  constructor(message = 'SITE_URL không hợp lệ.') {
    super(message);
    this.name = 'SiteUrlError';
  }
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export function readSiteUrl(value: string): URL {
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SiteUrlError('SITE_URL không phải URL hợp lệ.');
  }
  const host = url.hostname.toLowerCase();
  const blocked = BLOCKED_HOSTS.has(host) || host.endsWith('.localhost') || host.endsWith('.local');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '') ||
    blocked
  ) {
    throw new SiteUrlError('SITE_URL phải là HTTPS công khai, không có cổng, đường dẫn hoặc localhost.');
  }
  return url;
}

export function buildInviteUrl(siteUrl: string, token: string): string {
  if (!isInvitationToken(token)) throw new SiteUrlError('token thư mời không hợp lệ.');
  const base = readSiteUrl(siteUrl);
  return new URL(`/invite/${token}`, base.origin).toString();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatVietnamEventDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new SiteUrlError('Ngày giờ sự kiện không hợp lệ.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
  }).format(date);
  return `${weekday}, ${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')} (Giờ Việt Nam)`;
}

export type InvitationEmailInput = {
  guestName: string;
  eventTitle: string;
  eventDateIso: string;
  venueName: string | null;
  venueAddress: string | null;
  invitationNote: string | null;
  inviteUrl: string;
};

export type RenderedInvitationEmail = {
  subject: string;
  html: string;
  text: string;
};

function plain(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function renderInvitationEmail(input: InvitationEmailInput): RenderedInvitationEmail {
  const guestName = input.guestName.trim();
  const eventTitle = plain(input.eventTitle);
  const when = formatVietnamEventDate(input.eventDateIso);
  const venueName = input.venueName?.trim() || '';
  const venueAddress = input.venueAddress?.trim() || '';
  const note = input.invitationNote?.trim() || '';
  const inviteUrl = input.inviteUrl;
  const subject = `Thư mời: ${eventTitle}`;
  const safe = {
    guestName: escapeHtml(guestName),
    eventTitle: escapeHtml(eventTitle),
    when: escapeHtml(when),
    venueName: escapeHtml(venueName),
    venueAddress: escapeHtml(venueAddress),
    note: escapeHtml(note),
    inviteUrl: escapeHtml(inviteUrl),
    subject: escapeHtml(subject),
  };
  const noteHtml = note ? `<p style="margin:0 0 16px;">Lời mời riêng: ${safe.note}</p>` : '';
  const venueHtml = venueName ? `<p style="margin:0 0 8px;">Địa điểm: ${safe.venueName}</p>` : '';
  const addressHtml = venueAddress ? `<p style="margin:0 0 16px;">Địa chỉ: ${safe.venueAddress}</p>` : '';
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safe.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f6f1e8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e8;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:28px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1f2933;">
<p style="margin:0 0 16px;">Xin chào ${safe.guestName},</p>
<p style="margin:0 0 16px;">Bạn được mời tới <strong>${safe.eventTitle}</strong>.</p>
<p style="margin:0 0 8px;">Thời gian: ${safe.when}</p>
${venueHtml}
${addressHtml}
${noteHtml}
<p style="margin:28px 0;">
<a href="${safe.inviteUrl}" style="display:inline-block;background:#8c3a4b;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-size:16px;">Xem thư mời</a>
</p>
<p style="margin:0;font-size:14px;line-height:1.5;">Nếu nút không bấm được, hãy mở liên kết:<br>${safe.inviteUrl}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const textLines = [
    `Xin chào ${guestName},`,
    '',
    `Bạn được mời tới ${eventTitle}.`,
    `Thời gian: ${when}`,
    venueName ? `Địa điểm: ${venueName}` : '',
    venueAddress ? `Địa chỉ: ${venueAddress}` : '',
    note ? `Lời mời riêng: ${note}` : '',
    '',
    `Xem thư mời: ${inviteUrl}`,
  ].filter((line) => line !== '');
  return { subject, html, text: textLines.join('\n') };
}
