import { beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { anonClient, setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';

let fx: AuthorizationFixtures;

beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
}, 120_000);

describe('authorization: events', () => {
  it('lets Host A read and update their own event', async () => {
    const { data, error } = await fx.hostA.client
      .from('events')
      .select('id, title, user_id')
      .eq('id', fx.hostA.eventId)
      .single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(fx.hostA.id);

    const nextTitle = `MVP Step2 Event A ${Date.now()}`;
    const { error: updateError } = await fx.hostA.client
      .from('events')
      .update({ title: nextTitle })
      .eq('id', fx.hostA.eventId);
    expect(updateError).toBeNull();

    const { data: after } = await fx.hostA.client
      .from('events')
      .select('title')
      .eq('id', fx.hostA.eventId)
      .single();
    expect(after?.title).toBe(nextTitle);
  });

  it('blocks Host A from reading or updating Host B event', async () => {
    const { data, error } = await fx.hostA.client
      .from('events')
      .select('id, title')
      .eq('id', fx.hostB.eventId);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: updated, error: updateError } = await fx.hostA.client
      .from('events')
      .update({ title: 'Cross update' })
      .eq('id', fx.hostB.eventId)
      .select('id');
    expect(updated).toEqual([]);
    expect(updateError).toBeNull();

    const { data: stillB } = await fx.admin
      .from('events')
      .select('title')
      .eq('id', fx.hostB.eventId)
      .single();
    expect(stillB?.title).toBe('MVP Step2 Event B');
  });

  it('blocks Host B from reading or updating Host A event', async () => {
    const { data } = await fx.hostB.client.from('events').select('id').eq('id', fx.hostA.eventId);
    expect(data).toEqual([]);

    const { data: updated } = await fx.hostB.client
      .from('events')
      .update({ venue_name: 'Khong duoc' })
      .eq('id', fx.hostA.eventId)
      .select('id');
    expect(updated).toEqual([]);
  });

  it('does not let a host without an event see another host event', async () => {
    const { data } = await fx.hostNone.client.from('events').select('id');
    expect(data).toEqual([]);
  });
});

describe('authorization: column protection', () => {
  it('rejects client updates to role, owner, token, RSVP fields and music_path', async () => {
    const { error: roleError } = await fx.hostA.client
      .from('profiles')
      .update({ role: 'developer' })
      .eq('id', fx.hostA.id);
    expect(roleError).toBeTruthy();

    const { data: profile } = await fx.admin
      .from('profiles')
      .select('role')
      .eq('id', fx.hostA.id)
      .single();
    expect(profile?.role).toBe('host');

    const { error: ownerError } = await fx.hostA.client
      .from('events')
      .update({ user_id: fx.hostB.id })
      .eq('id', fx.hostA.eventId);
    expect(ownerError).toBeTruthy();

    const { error: musicError } = await fx.hostA.client
      .from('events')
      .update({ music_path: `${fx.hostB.id}/${fx.hostB.eventId}/music.mp3` })
      .eq('id', fx.hostA.eventId);
    expect(musicError).toBeTruthy();

    const { error: tokenError } = await fx.hostA.client
      .from('invitations')
      .update({ token: 'a'.repeat(64) })
      .eq('id', fx.invitationA.id);
    expect(tokenError).toBeTruthy();

    const { error: rsvpError } = await fx.hostA.client
      .from('invitations')
      .update({
        status: 'declined',
        guest_message: 'Ghi de',
        responded_at: new Date().toISOString(),
      })
      .eq('id', fx.invitationLocked.id);
    expect(rsvpError).toBeTruthy();

    const { data: locked } = await fx.admin
      .from('invitations')
      .select('status, guest_message, token')
      .eq('id', fx.invitationLocked.id)
      .single();
    expect(locked?.status).toBe('accepted');
    expect(locked?.guest_message).toBe('Da xac nhan');
    expect(locked?.token).toBe(fx.invitationLocked.token);
  });
});

describe('authorization: anon and insert/delete', () => {
  it('gives anon no access to business tables', async () => {
    const anon = anonClient(fx.url, fx.anonKey);
    const events = await anon.from('events').select('id');
    const invitations = await anon.from('invitations').select('id');
    const profiles = await anon.from('profiles').select('id');
    expect(events.data).toBeFalsy();
    expect(events.error).toBeTruthy();
    expect(invitations.data).toBeFalsy();
    expect(invitations.error).toBeTruthy();
    expect(profiles.data).toBeFalsy();
    expect(profiles.error).toBeTruthy();
  });

  it('rejects client insert and delete on events and invitations', async () => {
    const insertEvent = await fx.hostA.client.from('events').insert({
      user_id: fx.hostA.id,
      title: 'Su kien thu hai',
      template_key: 'wedding-floral-01',
      event_date: '2026-12-21T10:00:00+07:00',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(insertEvent.error).toBeTruthy();

    const insertInvitation = await fx.hostA.client.from('invitations').insert({
      event_id: fx.hostA.eventId,
      guest_name: 'Khach chen',
      guest_email: 'chen@example.com',
      token: 'b'.repeat(64),
    });
    expect(insertInvitation.error).toBeTruthy();

    const deleteEvent = await fx.hostA.client.from('events').delete().eq('id', fx.hostA.eventId);
    expect(deleteEvent.error).toBeTruthy();

    const deleteInvitation = await fx.hostA.client
      .from('invitations')
      .delete()
      .eq('id', fx.invitationA.id);
    expect(deleteInvitation.error).toBeTruthy();

    const { data: eventStill } = await fx.admin
      .from('events')
      .select('id')
      .eq('id', fx.hostA.eventId)
      .single();
    expect(eventStill?.id).toBe(fx.hostA.eventId);
  });
});

describe('authorization: invitation rules', () => {
  it('locks name, email and invitation note after send history for host and server writes', async () => {
    const { data: row, error } = await fx.admin.from('invitations').insert({
      event_id: fx.hostA.eventId,
      guest_name: 'Sent fixture', guest_email: `sent-${randomBytes(8).toString('hex')}@example.com`,
      invitation_note: 'Original invitation', token: randomBytes(32).toString('hex'),
      has_send_history: true, email_status: 'sent', sent_at: new Date().toISOString(),
    }).select('id, guest_name, guest_email, invitation_note').single();
    expect(error).toBeNull();
    if (!row) throw new Error('Sent fixture creation failed');
    try {
      for (const client of [fx.hostA.client, fx.admin]) {
        for (const update of [
          { guest_name: 'Changed name' }, { guest_email: 'changed@example.com' },
          { invitation_note: 'Changed invitation' },
        ]) {
          const result = await client.from('invitations').update(update).eq('id', row.id);
          expect(result.error?.code).toBe('42501');
        }
      }
      const result = await fx.admin.from('invitations').select('id, guest_name, guest_email, invitation_note').eq('id', row.id).single();
      expect(result.data).toEqual(row);
      // Re-sending and rate-limit accounting must still be possible.
      const system = await fx.admin.from('invitations').update({ email_status: 'sending', audio_requests_in_window: 1 }).eq('id', row.id);
      expect(system.error).toBeNull();
    } finally {
      const cleanup = await fx.admin.from('invitations').delete().eq('id', row.id).eq('event_id', fx.hostA.eventId);
      if (cleanup.error) throw new Error('Could not clean up the sent-invitation test fixture');
    }
  });
  it('lets Host A update guest name on a pending invitation they own', async () => {
    const { error } = await fx.hostA.client
      .from('invitations')
      .update({ guest_name: 'Khach A cap nhat' })
      .eq('id', fx.invitationA.id);
    expect(error).toBeNull();
  });

  it('blocks Host A from reading Host B invitations', async () => {
    const { data } = await fx.hostA.client
      .from('invitations')
      .select('id')
      .eq('id', fx.invitationB.id);
    expect(data).toEqual([]);
  });

  it('keeps locked RSVP fields unchanged even for service-role overwrite attempts', async () => {
    const before = await fx.admin
      .from('invitations')
      .select('status, guest_message, responded_at, audio_requests_in_window')
      .eq('id', fx.invitationLocked.id)
      .single();
    expect(before.error).toBeNull();

    const overwrite = await fx.admin
      .from('invitations')
      .update({
        status: 'declined',
        guest_message: 'Ghi de trai phep',
        responded_at: '2020-01-01T00:00:00Z',
      })
      .eq('id', fx.invitationLocked.id);
    expect(overwrite.error).toBeTruthy();

    const systemUpdate = await fx.admin
      .from('invitations')
      .update({ audio_requests_in_window: 3 })
      .eq('id', fx.invitationLocked.id);
    expect(systemUpdate.error).toBeNull();

    const after = await fx.admin
      .from('invitations')
      .select('status, guest_message, responded_at, audio_requests_in_window')
      .eq('id', fx.invitationLocked.id)
      .single();
    expect(after.data?.status).toBe(before.data?.status);
    expect(after.data?.guest_message).toBe(before.data?.guest_message);
    expect(after.data?.responded_at).toBe(before.data?.responded_at);
    expect(after.data?.audio_requests_in_window).toBe(3);
  });
});

describe('authorization: data constraints', () => {
  it('rejects empty titles and disallowed map URLs from the host client', async () => {
    const emptyTitle = await fx.hostA.client
      .from('events')
      .update({ title: '   ' })
      .eq('id', fx.hostA.eventId);
    expect(emptyTitle.error).toBeTruthy();

    const evilMap = await fx.hostA.client
      .from('events')
      .update({ google_map_url: 'https://google.com.evil.example/maps' })
      .eq('id', fx.hostA.eventId);
    expect(evilMap.error).toBeTruthy();

    const mapsEvilPath = await fx.hostA.client
      .from('events')
      .update({ google_map_url: 'https://www.google.com/maps-evil' })
      .eq('id', fx.hostA.eventId);
    expect(mapsEvilPath.error).toBeTruthy();

    const userinfo = await fx.hostA.client
      .from('events')
      .update({ google_map_url: 'https://google.com@evil.example/maps' })
      .eq('id', fx.hostA.eventId);
    expect(userinfo.error).toBeTruthy();

    const allowed = await fx.hostA.client
      .from('events')
      .update({ google_map_url: 'https://maps.app.goo.gl/abc' })
      .eq('id', fx.hostA.eventId);
    expect(allowed.error).toBeNull();
  });

  it('rejects a second event for the same host', async () => {
    const second = await fx.admin.from('events').insert({
      user_id: fx.hostA.id,
      title: 'Event thu hai',
      template_key: 'wedding-floral-01',
      event_date: '2026-12-22T10:00:00+07:00',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(second.error).toBeTruthy();
  });
});

describe('authorization: storage', () => {
  it('allows Host A to upload the canonical audio path and blocks Host B path', async () => {
    const ownPath = `${fx.hostA.id}/${fx.hostA.eventId}/music.mp3`;
    const otherPath = `${fx.hostB.id}/${fx.hostB.eventId}/music.mp3`;
    const bytes = new Blob([new Uint8Array([0x49, 0x44, 0x33])], { type: 'audio/mpeg' });

    const own = await fx.hostA.client.storage.from('audio').upload(ownPath, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    expect(own.error).toBeNull();

    const cross = await fx.hostA.client.storage.from('audio').upload(otherPath, bytes, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    expect(cross.error).toBeTruthy();

    const missingEvent = await fx.hostA.client.storage
      .from('audio')
      .upload(`${fx.hostA.id}/00000000-0000-4000-8000-000000000000/music.mp3`, bytes, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    expect(missingEvent.error).toBeTruthy();
  });
});
