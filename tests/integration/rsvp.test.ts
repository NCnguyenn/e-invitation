import { randomBytes } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { anonClient, setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';
import { createHostInvitation } from '../../src/features/invitations/server';
import { readGuestInvitation, submitRsvpOnce } from '../../src/features/guest/server';
import { ValidationError } from '../../src/lib/validation';

const jar: { name: string; value: string }[] = [];
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => jar,
    set: (name: string, value: string) => {
      const index = jar.findIndex(item => item.name === name);
      if (index >= 0) jar[index] = { name, value };
      else jar.push({ name, value });
    },
  }),
}));

let fx: AuthorizationFixtures;
const createdIds: string[] = [];

beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
}, 120_000);

function email(prefix: string) {
  return `${prefix}-${randomBytes(4).toString('hex')}@example.com`;
}

async function insertPending(eventId: string, guestEmail = email('rsvp'), guestName = 'Khach RSVP') {
  const token = randomBytes(32).toString('hex');
  const { data, error } = await fx.admin.from('invitations').insert({
    event_id: eventId, guest_name: guestName, guest_email: guestEmail, invitation_note: 'Loi rieng', token, status: 'pending',
  }).select('id, token, status, guest_message, responded_at').single();
  if (error || !data) throw error ?? new Error('pending invitation insert failed');
  createdIds.push(data.id);
  return data;
}

async function cleanup() {
  if (createdIds.length === 0) return;
  const { error } = await fx.admin.from('invitations').delete().in('id', createdIds);
  if (error) throw error;
  createdIds.length = 0;
}

describe('host invitations', () => {
  it('creates one invitation for a duplicate email, including concurrent requests, and keeps the first token', async () => {
    const guestEmail = email('dup');
    const [first, second] = await Promise.all([
      createHostInvitation(fx.hostA.id, { guestName: 'Mot', guestEmail, invitationNote: 'A' }),
      createHostInvitation(fx.hostA.id, { guestName: 'Hai', guestEmail, invitationNote: 'B' }),
    ]);
    expect([first.kind, second.kind].sort()).toEqual(['created', 'duplicate']);
    if (first.kind === 'no_event' || second.kind === 'no_event') throw new Error('Host A has no accessible event');
    expect(first.invitationId).toBe(second.invitationId);
    expect(first.token).toBe(second.token);
    createdIds.push(first.invitationId);
    const winner = first.kind === 'created' ? { name: 'Mot', note: 'A' } : { name: 'Hai', note: 'B' };
    const row = await fx.admin.from('invitations').select('guest_name, invitation_note, token, event_id').eq('id', first.invitationId).single();
    expect(row.data).toMatchObject({ guest_name: winner.name, invitation_note: winner.note, token: first.token, event_id: fx.hostA.eventId });
    const again = await createHostInvitation(fx.hostA.id, { guestName: 'Ba', guestEmail, invitationNote: 'C' });
    expect(again).toMatchObject({ kind: 'duplicate', invitationId: first.invitationId, token: first.token });
    const after = await fx.admin.from('invitations').select('guest_name, token').eq('guest_email', guestEmail);
    expect(after.data).toEqual([{ guest_name: winner.name, token: first.token }]);
  }, 60_000);

  it('does not let Host B read or own an invitation created for Host A', async () => {
    const created = await createHostInvitation(fx.hostA.id, { guestName: 'Rieng A', guestEmail: email('cross'), invitationNote: null });
    expect(created.kind).toBe('created');
    if (created.kind !== 'created') return;
    createdIds.push(created.invitationId);
    const hidden = await fx.hostB.client.from('invitations').select('id').eq('id', created.invitationId);
    expect(hidden.data).toEqual([]);
    const owned = await fx.admin.from('invitations').select('event_id').eq('id', created.invitationId).single();
    expect(owned.data?.event_id).toBe(fx.hostA.eventId);
    const forB = await createHostInvitation(fx.hostB.id, { guestName: 'Rieng B', guestEmail: email('crossb'), invitationNote: null });
    if (forB.kind === 'created') createdIds.push(forB.invitationId);
    expect(forB.kind).toBe('created');
    if (forB.kind === 'created') {
      const row = await fx.admin.from('invitations').select('event_id').eq('id', forB.invitationId).single();
      expect(row.data?.event_id).toBe(fx.hostB.eventId);
    }
  }, 60_000);
});

describe('guest read', () => {
  it('returns only that guest projection and does not write an RSVP', async () => {
    const row = await insertPending(fx.hostA.eventId!, email('read'), 'Lan Doc');
    const before = await fx.admin.from('invitations').select('status, guest_message, responded_at').eq('id', row.id).single();
    const invitation = await readGuestInvitation(row.token);
    expect(invitation?.guestName).toBe('Lan Doc');
    expect(invitation?.status).toBe('pending');
    expect(invitation?.receipt).toBeNull();
    const json = JSON.stringify(invitation);
    expect(json).not.toContain(fx.hostA.id);
    expect(json).not.toContain('guest_email');
    expect(json).not.toContain('music_path');
    const after = await fx.admin.from('invitations').select('status, guest_message, responded_at').eq('id', row.id).single();
    expect(after.data).toEqual(before.data);
    expect(await readGuestInvitation('not-a-token')).toBeNull();
    expect(await readGuestInvitation('a'.repeat(64))).toBeNull();
  }, 60_000);

  it('hides an invitation when the event is not accessible and does not record a response', async () => {
    const row = await insertPending(fx.hostA.eventId!);
    const { error } = await fx.admin.from('events').update({ lifecycle_status: 'deleting' }).eq('id', fx.hostA.eventId);
    expect(error).toBeNull();
    try {
      expect(await readGuestInvitation(row.token)).toBeNull();
      expect(await submitRsvpOnce(row.token, 'accepted', 'Khong duoc')).toEqual({ kind: 'not_found' });
      const stored = await fx.admin.from('invitations').select('status, responded_at').eq('id', row.id).single();
      expect(stored.data).toMatchObject({ status: 'pending', responded_at: null });
    } finally {
      const restore = await fx.admin.from('events').update({ lifecycle_status: 'active' }).eq('id', fx.hostA.eventId);
      if (restore.error) throw restore.error;
    }
  }, 60_000);
});

describe('one-time RSVP', () => {
  it('keeps exactly one concurrent response and rejects later overwrites', async () => {
    const row = await insertPending(fx.hostA.eventId!);
    const results = await Promise.all([
      submitRsvpOnce(row.token, 'accepted', 'Tôi tham gia'),
      submitRsvpOnce(row.token, 'declined', 'Tôi vắng mặt'),
    ]);
    expect(results.filter(item => item.kind === 'saved')).toHaveLength(1);
    expect(results.filter(item => item.kind === 'already_responded')).toHaveLength(1);
    const saved = results.find(item => item.kind === 'saved');
    const lost = results.find(item => item.kind === 'already_responded');
    expect(saved && 'receipt' in saved && lost && 'receipt' in lost && lost.receipt).toEqual(saved && 'receipt' in saved ? saved.receipt : null);
    const afterFirst = await readGuestInvitation(row.token);
    await submitRsvpOnce(row.token, 'declined', 'Ghi đè trái phép');
    expect(await readGuestInvitation(row.token)).toEqual(afterFirst);
    const overwrite = await fx.admin.from('invitations').update({
      status: 'declined', guest_message: 'Ghi de trigger', responded_at: '2020-01-01T00:00:00Z',
    }).eq('id', row.id);
    expect(overwrite.error?.code).toBe('42501');
    const locked = await fx.admin.from('invitations').select('status, guest_message, responded_at').eq('id', row.id).single();
    expect(locked.data?.guest_message).toBe(afterFirst?.receipt?.guestMessage);
    expect(new Date(locked.data?.responded_at ?? '').toISOString()).toBe(afterFirst?.receipt?.respondedAt);
    expect(locked.data?.status).toBe(afterFirst?.status);
  }, 60_000);

  it('rejects bad tokens and input before changing a pending invitation', async () => {
    const row = await insertPending(fx.hostA.eventId!);
    expect(await submitRsvpOnce('zz', 'accepted', null)).toEqual({ kind: 'not_found' });
    await expect(submitRsvpOnce(row.token, 'accepted', 'm'.repeat(1001))).rejects.toBeInstanceOf(ValidationError);
    const badDecision = await fx.admin.rpc('submit_rsvp_once', { p_token: row.token, p_decision: 'maybe', p_guest_message: null });
    expect(badDecision.error?.code).toBe('22023');
    const stored = await fx.admin.from('invitations').select('status, guest_message, responded_at').eq('id', row.id).single();
    expect(stored.data).toMatchObject({ status: 'pending', guest_message: null, responded_at: null });
  }, 60_000);

  it('does not let anon or authenticated call the privileged RPC or update RSVP directly', async () => {
    const row = await insertPending(fx.hostA.eventId!);
    const anon = anonClient(fx.url, fx.anonKey);
    const anonRpc = await anon.rpc('submit_rsvp_once', { p_token: row.token, p_decision: 'accepted', p_guest_message: 'Anon' });
    const hostRpc = await fx.hostA.client.rpc('submit_rsvp_once', { p_token: row.token, p_decision: 'accepted', p_guest_message: 'Host' });
    expect(anonRpc.error?.code).toBe('42501');
    expect(hostRpc.error?.code).toBe('42501');
    const direct = await fx.hostA.client.from('invitations').update({ status: 'accepted', guest_message: 'Truc tiep', responded_at: new Date().toISOString() }).eq('id', row.id);
    expect(direct.error).toBeTruthy();
    const stored = await fx.admin.from('invitations').select('status, responded_at').eq('id', row.id).single();
    expect(stored.data).toMatchObject({ status: 'pending', responded_at: null });
  }, 60_000);
});

describe('host invitation API', () => {
  it('uses the session owner and rejects cross-event fields', async () => {
    const { POST } = await import('../../src/app/api/host/invitations/route');
    const collected: { name: string; value: string }[] = [];
    const client = createServerClient(fx.url, fx.anonKey, {
      cookies: {
        getAll: () => collected,
        setAll: (cookies) => cookies.forEach(cookie => {
          const index = collected.findIndex(item => item.name === cookie.name);
          const next = { name: cookie.name, value: cookie.value };
          if (index >= 0) collected[index] = next;
          else collected.push(next);
        }),
      },
    });
    const signedIn = await client.auth.signInWithPassword({ email: fx.hostA.email, password: fx.hostA.password });
    expect(signedIn.error).toBeNull();
    jar.splice(0, jar.length, ...collected);
    const guestEmail = email('api');
    const rejected = await POST(new Request('http://127.0.0.1:3100/api/host/invitations', {
      method: 'POST', headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
      body: JSON.stringify({ guestName: 'X', guestEmail, invitationNote: null, eventId: fx.hostB.eventId, userId: fx.hostB.id, token: 'a'.repeat(64), status: 'accepted' }),
    }));
    expect(rejected.status).toBe(422);
    const created = await POST(new Request('http://127.0.0.1:3100/api/host/invitations', {
      method: 'POST', headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
      body: JSON.stringify({ guestName: 'API A', guestEmail, invitationNote: 'Rieng' }),
    }));
    expect(created.status).toBe(201);
    const body = await created.json();
    createdIds.push(body.invitationId);
    expect(body.emailSent).toBe(false);
    expect(body.invitePath).toMatch(/^\/invite\/[0-9a-f]{64}$/);
    const row = await fx.admin.from('invitations').select('event_id, status, email_status').eq('id', body.invitationId).single();
    expect(row.data).toMatchObject({ event_id: fx.hostA.eventId, status: 'pending', email_status: 'pending' });
    const hidden = await fx.hostB.client.from('invitations').select('id').eq('id', body.invitationId);
    expect(hidden.data).toEqual([]);
    expect(created.headers.get('cache-control')).toContain('no-store');
  }, 60_000);
});

afterAll(async () => {
  await cleanup();
});
