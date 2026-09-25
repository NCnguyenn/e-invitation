import { describe, expect, it } from 'vitest';
import { projectGuestInvitation, type GuestInvitationSource } from '../../src/features/guest/project';

const source: GuestInvitationSource = {
  guestName: 'Lan Chi',
  invitationNote: 'Rất mong gặp bạn',
  status: 'pending',
  guestMessage: null,
  respondedAt: null,
  event: {
    id: 'event-1',
    userId: 'host-secret',
    title: 'Lễ tốt nghiệp',
    eventDate: '2026-12-20T03:00:00.000Z',
    venueName: 'Hội trường',
    venueAddress: '1 Nguyễn Huệ',
    googleMapUrl: 'https://maps.google.com/',
    musicPath: 'host-secret/event-1/music.mp3',
    lifecycleStatus: 'active',
  },
  host: { role: 'host', lifecycleStatus: 'active' },
  guestEmail: 'lan@example.com',
};

describe('guest invitation projection', () => {
  it('returns only the fields the guest card needs', () => {
    const invitation = projectGuestInvitation(source);
    expect(invitation).toEqual({
      event: {
        id: 'event-1', title: 'Lễ tốt nghiệp', eventDate: '2026-12-20T03:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh', venueName: 'Hội trường', venueAddress: '1 Nguyễn Huệ',
        googleMapUrl: 'https://maps.google.com/', hasMusic: true,
      },
      guestName: 'Lan Chi', invitationNote: 'Rất mong gặp bạn', status: 'pending', receipt: null,
    });
    const json = JSON.stringify(invitation);
    expect(json).not.toContain('lan@example.com');
    expect(json).not.toContain('host-secret');
    expect(json).not.toContain('music.mp3');
    expect(json).not.toContain('musicPath');
    expect(json).not.toContain('userId');
  });

  it('hides inaccessible events and attaches the first receipt only after a decision', () => {
    expect(projectGuestInvitation({ ...source, host: { role: 'host', lifecycleStatus: 'deleting' } })).toBeNull();
    expect(projectGuestInvitation({ ...source, event: { ...source.event, lifecycleStatus: 'deleting' } })).toBeNull();
    expect(projectGuestInvitation({ ...source, host: { role: 'developer', lifecycleStatus: 'active' } })).toBeNull();
    const respondedAt = '2026-09-26T03:15:00.000Z';
    expect(projectGuestInvitation({
      ...source, status: 'accepted', guestMessage: 'Tôi đến', respondedAt,
    })?.receipt).toEqual({ status: 'accepted', guestMessage: 'Tôi đến', respondedAt });
  });
});
