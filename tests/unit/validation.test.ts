import { describe, expect, it } from 'vitest';
import {
  parseEventUpdate, vietnamDateTimeToIso, eventDateToInputs, parseInvitationCreate,
  parseRsvpSubmission, isInvitationToken, parseInvitationUpdate, isUuid,
  parseHostInvitationsQuery, escapePostgrestIlike,
  parseAudioPrepare, canonicalAudioPath, isValidAudioMetadata,
} from '../../src/lib/validation';
const valid = { title: 'Lễ tốt nghiệp', eventDate: '2026-09-28T03:45:00.000Z', venueName: '', venueAddress: '', googleMapUrl: '' };
describe('event editor validation', () => {
  it('trims fields and normalizes optional empty values', () => {
    expect(parseEventUpdate({ ...valid, title: '  Lễ tốt nghiệp  ' })).toEqual({ ...valid, title: valid.title, venueName: null, venueAddress: null, googleMapUrl: null });
  });
  it('rejects empty or oversized titles and malformed payloads', () => {
    for (const title of ['', '   ', 'a'.repeat(256)]) expect(() => parseEventUpdate({ ...valid, title })).toThrow();
    for (const value of [null, [], {}, { ...valid, user_id: 'other' }, { ...valid, eventId: 'other' }]) expect(() => parseEventUpdate(value)).toThrow();
  });
  it('rejects lookalike domains, credentials, ports and non-Maps paths', () => {
    for (const googleMapUrl of ['https://google.com.evil.example/maps', 'https://user@google.com/maps', 'https://google.com:444/maps', 'http://google.com/maps', 'https://www.google.com/maps-evil', 'https://www.google.com/maps/../search', 'https://maps.app.goo.gl\\@evil.example']) {
      expect(() => parseEventUpdate({ ...valid, googleMapUrl })).toThrow();
    }
    for (const googleMapUrl of ['https://maps.app.goo.gl/abc', 'https://maps.google.com/', 'https://www.google.com/maps/place/Hanoi']) {
      expect(parseEventUpdate({ ...valid, googleMapUrl }).googleMapUrl).toBe(googleMapUrl);
    }
  });
  it('converts Vietnam local time to UTC independently of browser timezone', () => {
    expect(vietnamDateTimeToIso('2026-09-28', '00:15')).toBe('2026-09-27T17:15:00.000Z');
    expect(eventDateToInputs('2026-09-27T17:15:00.000Z')).toEqual({ date: '2026-09-28', time: '00:15' });
  });
  it('rejects impossible dates, missing timezone and out of range time', () => {
    for (const [date, time] of [['2026-02-30', '10:00'], ['2026-01-01', '24:00'], ['', '10:00']]) expect(() => vietnamDateTimeToIso(date, time)).toThrow();
    for (const eventDate of ['bad', '2026-02-30T10:00:00Z', '2026-09-28T10:00:00']) expect(() => parseEventUpdate({ ...valid, eventDate })).toThrow();
  });
  it('limits venue and address lengths', () => {
    expect(() => parseEventUpdate({ ...valid, venueName: 'a'.repeat(256) })).toThrow();
    expect(() => parseEventUpdate({ ...valid, venueAddress: 'a'.repeat(2001) })).toThrow();
  });
});
describe('invitation token', () => {
  it('accepts only 64 lowercase hex characters', () => {
    expect(isInvitationToken('a'.repeat(64))).toBe(true);
    expect(isInvitationToken('A'.repeat(64))).toBe(false);
  });
});
describe('invitation and RSVP validation', () => {
  it('trims the guest name, lowercases email and drops a blank note', () => {
    expect(parseInvitationCreate({
      guestName: '  Lan Chi  ', guestEmail: '  Guest@Example.com ', invitationNote: '   ',
    })).toEqual({ guestName: 'Lan Chi', guestEmail: 'guest@example.com', invitationNote: null });
  });
  it('rejects empty names, bad emails, oversized notes and client-owned fields', () => {
    expect(() => parseInvitationCreate({ guestName: '   ', guestEmail: 'a@b.vn', invitationNote: null })).toThrow();
    expect(() => parseInvitationCreate({ guestName: 'a'.repeat(256), guestEmail: 'a@b.vn', invitationNote: null })).toThrow();
    expect(() => parseInvitationCreate({ guestName: 'Lan', guestEmail: 'not-an-email', invitationNote: null })).toThrow();
    expect(() => parseInvitationCreate({ guestName: 'Lan', guestEmail: 'a@b.vn', invitationNote: 'n'.repeat(501) })).toThrow();
    for (const extra of ['eventId', 'userId', 'token', 'status', 'guest_email']) {
      expect(() => parseInvitationCreate({ guestName: 'Lan', guestEmail: 'a@b.vn', invitationNote: null, [extra]: 'no' })).toThrow();
    }
  });
  it('accepts only an explicit RSVP decision and a note of at most 1000 characters', () => {
    expect(parseRsvpSubmission({ decision: 'accepted', guestMessage: '  Tôi đến  ' })).toEqual({ decision: 'accepted', guestMessage: 'Tôi đến' });
    expect(parseRsvpSubmission({ decision: 'declined' })).toEqual({ decision: 'declined', guestMessage: null });
    expect(parseRsvpSubmission({ decision: 'accepted', guestMessage: '' })).toEqual({ decision: 'accepted', guestMessage: null });
    for (const input of [
      { decision: 'pending', guestMessage: null },
      { guestMessage: 'hi' },
      { decision: 'accepted', guestMessage: 'm'.repeat(1001) },
      { decision: 'accepted', guestMessage: null, guestCount: 2 },
      null,
    ]) expect(() => parseRsvpSubmission(input)).toThrow();
  });
});

describe('invitation update validation', () => {
  it('validates, trims and normalizes guest updates', () => {
    expect(parseInvitationUpdate({
      guestName: '  Nguyen Van A  ',
      guestEmail: '  A@Example.COM ',
      invitationNote: '  Ghi chú riêng  ',
    })).toEqual({
      guestName: 'Nguyen Van A',
      guestEmail: 'a@example.com',
      invitationNote: 'Ghi chú riêng',
    });
  });

  it('rejects disallowed fields, invalid emails, empty names or oversized notes', () => {
    expect(() => parseInvitationUpdate({ guestName: '', guestEmail: 'a@b.com' })).toThrow();
    expect(() => parseInvitationUpdate({ guestName: 'A', guestEmail: 'invalid' })).toThrow();
    expect(() => parseInvitationUpdate({ guestName: 'A', guestEmail: 'a@b.com', invitationNote: 'x'.repeat(501) })).toThrow();
    for (const extra of ['token', 'id', 'status', 'event_id', 'has_send_history', 'email_status', 'responded_at']) {
      expect(() => parseInvitationUpdate({ guestName: 'A', guestEmail: 'a@b.com', [extra]: 'val' })).toThrow();
    }
  });
});

describe('UUID and PostgREST escaping', () => {
  it('validates UUID format strictly', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });

  it('escapes SQL LIKE wildcards and PostgREST quote syntax safely', () => {
    expect(escapePostgrestIlike('plain')).toBe('"%plain%"');
    expect(escapePostgrestIlike('100%')).toBe('"%100\\\\%%"');
    expect(escapePostgrestIlike('user_name')).toBe('"%user\\\\_name%"');
    expect(escapePostgrestIlike('hello, world')).toBe('"%hello, world%"');
    expect(escapePostgrestIlike('(VIP)')).toBe('"%(VIP)%"');
    expect(escapePostgrestIlike('O"Reilly')).toBe('"%O\\"Reilly%"');
    expect(escapePostgrestIlike('back\\slash')).toBe('"%back\\\\\\\\slash%"');
  });

});

describe('host invitations query parsing', () => {
  it('defaults to page 1, status all, and empty query', () => {
    expect(parseHostInvitationsQuery(new URLSearchParams())).toEqual({
      page: 1,
      status: 'all',
      query: '',
    });
  });

  it('parses valid page, status and query', () => {
    const params = new URLSearchParams('page=3&status=accepted&query=Chi');
    expect(parseHostInvitationsQuery(params)).toEqual({
      page: 3,
      status: 'accepted',
      query: 'Chi',
    });
  });

  it('rejects invalid or non-positive pages', () => {
    for (const badPage of ['0', '-1', '1.5', 'abc', 'NaN', '']) {
      if (badPage === '') continue; // empty string defaults to 1
      expect(() => parseHostInvitationsQuery(new URLSearchParams(`page=${badPage}`))).toThrow();
    }
  });

  it('rejects disallowed status filters', () => {
    for (const badStatus of ['unknown', 'sending', 'sent', 'invalid']) {
      expect(() => parseHostInvitationsQuery(new URLSearchParams(`status=${badStatus}`))).toThrow();
    }
  });
});

describe('audio validation', () => {
  it('accepts valid audio prepare payload up to 10 MiB', () => {
    expect(parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: 10_485_760 })).toEqual({
      mimeType: 'audio/mpeg',
      fileSize: 10_485_760,
    });
    expect(parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: 1 })).toEqual({
      mimeType: 'audio/mpeg',
      fileSize: 1,
    });
  });

  it('rejects non-audio/mpeg, zero, oversized or invalid sizes', () => {
    for (const mimeType of ['audio/mp3', 'audio/wav', 'application/octet-stream', '', 'audio/ogg']) {
      expect(() => parseAudioPrepare({ mimeType, fileSize: 1000 })).toThrow();
    }
    for (const fileSize of [0, -1, 10_485_761, 1.5, NaN, Infinity, '1000', null, undefined]) {
      expect(() => parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize })).toThrow();
    }
    for (const extra of ['path', 'userId', 'eventId', 'url']) {
      expect(() => parseAudioPrepare({ mimeType: 'audio/mpeg', fileSize: 100, [extra]: 'val' })).toThrow();
    }
  });

  it('generates canonical audio path', () => {
    expect(canonicalAudioPath('u-123', 'e-456')).toBe('u-123/e-456/music.mp3');
  });

  it('validates storage object metadata', () => {
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 5000 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 10_485_760 })).toBe(true);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 0 })).toBe(false);
    expect(isValidAudioMetadata({ mimetype: 'audio/mpeg', size: 10_485_761 })).toBe(false);
    expect(isValidAudioMetadata({ mimetype: 'audio/wav', size: 5000 })).toBe(false);
    expect(isValidAudioMetadata(null)).toBe(false);
    expect(isValidAudioMetadata(undefined)).toBe(false);
  });
});


