import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as sendRoute } from '../../src/app/api/host/invitations/[id]/send/route';
import type { BrevoSendPayload } from '../../src/features/email/brevo';
import { sendInvitation } from '../../src/features/email/server';
import { buildInviteUrl, renderInvitationEmail } from '../../src/features/email/render';
import { anonClient, setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';

let fx: AuthorizationFixtures;
const createdIds: string[] = [];
const createdBudgetDates: string[] = [];
const createdAttemptIds = new Set<string>();
const previousEnv = {
  SITE_URL: process.env.SITE_URL,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL,
  BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME,
};

async function nextDate(reservedAttempts = 0) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const date = new Date(Date.UTC(1900, 0, 1) + randomInt(365 * 90) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { error } = await fx.admin.from('email_daily_counters').insert({
      budget_date: date,
      reserved_attempts: reservedAttempts,
    });
    if (!error) {
      createdBudgetDates.push(date);
      return date;
    }
    if (error.code !== '23505') throw error;
  }
  throw new Error('Could not reserve an isolated email budget date');
}

function acceptTransport() {
  const calls: BrevoSendPayload[] = [];
  return {
    calls,
    transport: async (payload: BrevoSendPayload) => {
      calls.push(payload);
      return { status: 201, body: { messageId: `<test-${calls.length}@invitation.test>` } };
    },
  };
}

async function createGuest(email: string, name = 'Khach gui') {
  const token = randomBytes(32).toString('hex');
  const { data, error } = await fx.admin
    .from('invitations')
    .insert({
      event_id: fx.hostA.eventId,
      guest_name: name,
      guest_email: email,
      invitation_note: 'Loi rieng <b>',
      token,
      status: 'pending',
    })
    .select('id, token')
    .single();
  if (error || !data) throw error ?? new Error('guest insert failed');
  createdIds.push(data.id as string);
  return { id: data.id as string, token: data.token as string };
}

async function counter(date: string) {
  const { data, error } = await fx.admin
    .from('email_daily_counters')
    .select('reserved_attempts')
    .eq('budget_date', date)
    .maybeSingle();
  if (error) throw error;
  return data?.reserved_attempts ?? 0;
}

async function attempts(invitationId: string) {
  const { data, error } = await fx.admin
    .from('email_send_attempts')
    .select('id, status, request_id, budget_date, provider_message_id, payload_snapshot, resolved_at')
    .eq('invitation_id', invitationId);
  if (error) throw error;
  return data ?? [];
}

beforeAll(async () => {
  fx = await setupAuthorizationFixtures();
  process.env.SITE_URL = 'https://invitation-test.example';
  process.env.BREVO_API_KEY = 'test-key-not-sent';
  process.env.BREVO_SENDER_EMAIL = 'sender@invitation-test.example';
  process.env.BREVO_SENDER_NAME = 'Thu moi test';
}, 120_000);

afterAll(async () => {
  if (fx) {
    if (createdIds.length > 0) {
      const { data, error } = await fx.admin.from('email_send_attempts').select('id').in('invitation_id', createdIds);
      if (error) throw error;
      for (const row of data ?? []) createdAttemptIds.add(row.id as string);
      const cleared = await fx.admin.from('invitations').update({ current_send_attempt_id: null }).in('id', createdIds);
      if (cleared.error) throw cleared.error;
    }
    if (createdAttemptIds.size > 0) {
      const deleted = await fx.admin.from('email_send_attempts').delete().in('id', [...createdAttemptIds]);
      if (deleted.error) throw deleted.error;
    }
    if (createdIds.length > 0) {
      const deleted = await fx.admin.from('invitations').delete().in('id', createdIds);
      if (deleted.error) throw deleted.error;
    }
    if (createdBudgetDates.length > 0) {
      const deleted = await fx.admin.from('email_daily_counters').delete().in('budget_date', createdBudgetDates);
      if (deleted.error) throw deleted.error;
    }
    await fx.admin.from('events').update({ title: 'MVP Step2 Event A' }).eq('id', fx.hostA.eventId);
  }
  process.env.SITE_URL = previousEnv.SITE_URL;
  process.env.BREVO_API_KEY = previousEnv.BREVO_API_KEY;
  process.env.BREVO_SENDER_EMAIL = previousEnv.BREVO_SENDER_EMAIL;
  process.env.BREVO_SENDER_NAME = previousEnv.BREVO_SENDER_NAME;
});

describe('email send ledger', { timeout: 20_000 }, () => {
  it('uses the Vietnam date boundary in the database', async () => {
    const before = await fx.admin.rpc('email_budget_date', { p_at: '2026-09-26T16:59:59Z' });
    const after = await fx.admin.rpc('email_budget_date', { p_at: '2026-09-26T17:00:00Z' });
    expect(before.error).toBeNull();
    expect(after.error).toBeNull();
    expect(before.data).toBe('2026-09-26');
    expect(after.data).toBe('2026-09-27');
  });

  it('keeps one attempt and one transport call for the same requestId', async () => {
    const date = await nextDate();
    const guest = await createGuest(`same-${randomBytes(3).toString('hex')}@example.com`);
    const requestId = randomUUID();
    const mock = acceptTransport();
    const [first, second] = await Promise.all([
      sendInvitation(fx.hostA.id, guest.id, requestId, { transport: mock.transport, budgetDate: date }),
      sendInvitation(fx.hostA.id, guest.id, requestId, { transport: mock.transport, budgetDate: date }),
    ]);
    expect([first.kind, second.kind]).toEqual(['completed', 'completed']);
    expect(mock.calls).toHaveLength(1);
    expect(await attempts(guest.id)).toHaveLength(1);
    expect(await counter(date)).toBe(1);
  });

  it('allows only one unresolved attempt for two request ids', async () => {
    const date = await nextDate();
    const guest = await createGuest(`open-${randomBytes(3).toString('hex')}@example.com`);
    const mock = acceptTransport();
    const results = await Promise.all([
      sendInvitation(fx.hostA.id, guest.id, randomUUID(), {
        transport: async (payload) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          return mock.transport(payload);
        },
        budgetDate: date,
      }),
      sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date }),
    ]);
    expect(results.filter((item) => item.kind === 'completed')).toHaveLength(1);
    expect(results.filter((item) => item.kind === 'unresolved')).toHaveLength(1);
    expect(mock.calls).toHaveLength(1);
    expect(await attempts(guest.id)).toHaveLength(1);
    expect(await counter(date)).toBe(1);
  });

  it('replays accepted, rejected and unknown without another send or counter increment', async () => {
    const date = await nextDate();
    const guest = await createGuest(`replay-${randomBytes(3).toString('hex')}@example.com`);
    const acceptedId = randomUUID();
    const accepted = acceptTransport();
    const saved = await sendInvitation(fx.hostA.id, guest.id, acceptedId, { transport: accepted.transport, budgetDate: date });
    expect(saved).toMatchObject({ kind: 'completed', emailStatus: 'sent' });
    const replay = await sendInvitation(fx.hostA.id, guest.id, acceptedId, { transport: accepted.transport, budgetDate: date });
    expect(replay).toMatchObject({ kind: 'completed', emailStatus: 'sent' });
    expect(accepted.calls).toHaveLength(1);

    const rejectedGuest = await createGuest(`reject-${randomBytes(3).toString('hex')}@example.com`);
    const rejectedId = randomUUID();
    let rejectedCalls = 0;
    const rejectedTransport = async () => {
      rejectedCalls += 1;
      return { status: 400, body: { code: 'invalid_parameter', message: 'no' } };
    };
    const failed = await sendInvitation(fx.hostA.id, rejectedGuest.id, rejectedId, { transport: rejectedTransport, budgetDate: date });
    expect(failed).toMatchObject({ kind: 'completed', emailStatus: 'failed' });
    const failedReplay = await sendInvitation(fx.hostA.id, rejectedGuest.id, rejectedId, { transport: rejectedTransport, budgetDate: date });
    expect(failedReplay).toMatchObject({ kind: 'completed', emailStatus: 'failed' });
    expect(rejectedCalls).toBe(1);

    const unknownGuest = await createGuest(`unknown-${randomBytes(3).toString('hex')}@example.com`);
    const unknownId = randomUUID();
    let unknownCalls = 0;
    const unknownTransport = async () => {
      unknownCalls += 1;
      return { status: 0, body: null, transportError: 'transport_timeout' as const };
    };
    const unclear = await sendInvitation(fx.hostA.id, unknownGuest.id, unknownId, { transport: unknownTransport, budgetDate: date });
    expect(unclear).toMatchObject({ kind: 'completed', emailStatus: 'unknown' });
    const unclearReplay = await sendInvitation(fx.hostA.id, unknownGuest.id, unknownId, { transport: unknownTransport, budgetDate: date });
    expect(unclearReplay).toMatchObject({ kind: 'completed', emailStatus: 'unknown' });
    expect(unknownCalls).toBe(1);
    expect(await counter(date)).toBe(3);
  });

  it('blocks a reused requestId on another invitation without leaking the other guest', async () => {
    const date = await nextDate();
    const first = await createGuest(`secret-${randomBytes(3).toString('hex')}@example.com`, 'Ten bi mat');
    const second = await createGuest(`other-${randomBytes(3).toString('hex')}@example.com`);
    const requestId = randomUUID();
    const mock = acceptTransport();
    await sendInvitation(fx.hostA.id, first.id, requestId, { transport: mock.transport, budgetDate: date });
    const conflict = await sendInvitation(fx.hostA.id, second.id, requestId, { transport: mock.transport, budgetDate: date });
    expect(conflict.kind).toBe('request_conflict');
    expect(JSON.stringify(conflict)).not.toContain('secret-');
    expect(JSON.stringify(conflict)).not.toContain('Ten bi mat');
    expect(mock.calls).toHaveLength(1);
    expect(await attempts(second.id)).toHaveLength(0);
    expect(await counter(date)).toBe(1);
  });

  it('holds only one new slot when the isolated counter is 299', async () => {
    const date = await nextDate(299);
    const today = await fx.admin.rpc('email_budget_date', { p_at: new Date().toISOString() });
    expect(today.data).not.toBe(date);
    const beforeToday = await counter(String(today.data));
    const guests = await Promise.all(
      Array.from({ length: 10 }, (_, index) => createGuest(`cap-${index}-${randomBytes(2).toString('hex')}@example.com`)),
    );
    const mock = acceptTransport();
    const results = await Promise.all(
      guests.map((guest) => sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date })),
    );
    expect(results.filter((item) => item.kind === 'completed')).toHaveLength(1);
    expect(results.filter((item) => item.kind === 'internal_cap')).toHaveLength(9);
    expect(mock.calls).toHaveLength(1);
    expect(await counter(date)).toBe(300);
    expect(await counter(String(today.data))).toBe(beforeToday);
    expect(JSON.stringify(results)).not.toContain('300 -');
  });

  it('does not refund a rejected slot and applies cooldown to the next request', async () => {
    const date = await nextDate();
    const guest = await createGuest(`cool-${randomBytes(3).toString('hex')}@example.com`);
    let calls = 0;
    const transport = async () => {
      calls += 1;
      return { status: 400, body: { code: 'not_enough_credits', message: 'stop' } };
    };
    const failed = await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport, budgetDate: date });
    expect(failed).toMatchObject({ kind: 'completed', emailStatus: 'failed' });
    const again = await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport, budgetDate: date });
    expect(again.kind).toBe('cooldown');
    if (again.kind === 'cooldown') expect(again.retryAfterSeconds).toBeGreaterThan(0);
    expect(calls).toBe(1);
    expect(await counter(date)).toBe(1);
  });

  it('does not let host B or anon send or read the ledger', async () => {
    const date = await nextDate();
    const guest = await createGuest(`cross-${randomBytes(3).toString('hex')}@example.com`);
    const mock = acceptTransport();
    const denied = await sendInvitation(fx.hostB.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date });
    expect(denied.kind).toBe('not_found');
    expect(mock.calls).toHaveLength(0);
    const anon = anonClient(fx.url, fx.anonKey);
    const rpc = await anon.rpc('reserve_email_send', {
      p_actor_id: fx.hostA.id,
      p_invitation_id: guest.id,
      p_request_id: randomUUID(),
      p_payload: {},
    });
    expect(rpc.error).toBeTruthy();
    const read = await anon.from('email_send_attempts').select('payload_snapshot');
    expect(read.error).toBeTruthy();
    const hostRead = await fx.hostA.client.from('email_daily_counters').select('reserved_attempts');
    expect(hostRead.error).toBeTruthy();
    const missingOrigin = await sendRoute(
      new Request('http://127.0.0.1:3100/api/host/invitations/not-used/send', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: guest.id }) },
    );
    expect(missingOrigin.status).toBe(403);
    const anonymous = await sendRoute(
      new Request('http://127.0.0.1:3100/api/host/invitations/not-used/send', {
        method: 'POST',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: randomUUID(), recipient: 'a@b.c' }),
      }),
      { params: Promise.resolve({ id: guest.id }) },
    );
    expect(anonymous.status).toBe(401);
  });

  it('turns a reserved attempt older than two minutes into unknown and does not send', async () => {
    const date = await nextDate();
    const guest = await createGuest(`stale-${randomBytes(3).toString('hex')}@example.com`);
    const event = await fx.admin.from('events').select('title, event_date, timezone, venue_name, venue_address').eq('id', fx.hostA.eventId).single();
    if (event.error || !event.data) throw event.error;
    const inviteUrl = buildInviteUrl('https://invitation-test.example', guest.token);
    const rendered = renderInvitationEmail({
      guestName: 'Khach gui',
      eventTitle: event.data.title,
      eventDateIso: event.data.event_date,
      venueName: event.data.venue_name,
      venueAddress: event.data.venue_address,
      invitationNote: 'Loi rieng <b>',
      inviteUrl,
    });
    const reserved = await fx.admin.rpc('reserve_email_send', {
      p_actor_id: fx.hostA.id,
      p_invitation_id: guest.id,
      p_request_id: randomUUID(),
      p_budget_date: date,
      p_payload: {
        guestName: 'Khach gui',
        guestEmail: (await fx.admin.from('invitations').select('guest_email').eq('id', guest.id).single()).data?.guest_email,
        invitationNote: 'Loi rieng <b>',
        eventTitle: event.data.title,
        eventDate: event.data.event_date,
        timezone: event.data.timezone,
        venueName: event.data.venue_name,
        venueAddress: event.data.venue_address,
        token: guest.token,
        subject: rendered.subject,
        htmlContent: rendered.html,
        textContent: rendered.text,
        inviteUrl,
        senderEmail: 'sender@invitation-test.example',
        senderName: 'Thu moi test',
        toName: 'Khach gui',
      },
    });
    expect(reserved.error).toBeNull();
    expect(reserved.data.kind).toBe('reserved');
    const attemptId = reserved.data.attempt_id as string;
    createdAttemptIds.add(attemptId);
    await fx.admin.from('email_send_attempts').update({
      started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    }).eq('id', attemptId);
    await fx.admin.rpc('expire_stale_email_sends', { p_actor_id: fx.hostA.id });
    const row = await fx.admin.from('email_send_attempts').select('status, provider_message_id').eq('id', attemptId).single();
    expect(row.data).toMatchObject({ status: 'unknown', provider_message_id: null });
    const invitation = await fx.admin.from('invitations').select('email_status').eq('id', guest.id).single();
    expect(invitation.data?.email_status).toBe('unknown');
  });

  it('does not send again when persistence fails after acceptance', async () => {
    const date = await nextDate();
    const guest = await createGuest(`persist-${randomBytes(3).toString('hex')}@example.com`);
    let calls = 0;
    const result = await sendInvitation(fx.hostA.id, guest.id, randomUUID(), {
      budgetDate: date,
      transport: async () => {
        calls += 1;
        return { status: 201, body: { messageId: '<accepted-but-unstored@invitation.test>' } };
      },
      persist: async () => {
        throw new Error('database write failed');
      },
    });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ kind: 'completed', emailStatus: 'unknown' });
    const rows = await attempts(guest.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('sending');
    expect(rows[0]?.provider_message_id).toBeNull();
  });

  it('keeps the reserved snapshot when event data changes before transport', async () => {
    const date = await nextDate();
    const guest = await createGuest(`snap-${randomBytes(3).toString('hex')}@example.com`);
    const original = await fx.admin.from('events').select('title').eq('id', fx.hostA.eventId).single();
    let seen = '';
    await sendInvitation(fx.hostA.id, guest.id, randomUUID(), {
      budgetDate: date,
      transport: async (payload) => {
        seen = payload.subject;
        await fx.admin.from('events').update({ title: 'Changed during send' }).eq('id', fx.hostA.eventId);
        return { status: 201, body: { messageId: '<snapshot@invitation.test>' } };
      },
    });
    expect(seen).toContain(original.data?.title);
    expect(seen).not.toContain('Changed during send');
    const rows = await attempts(guest.id);
    expect(rows[0]?.payload_snapshot.subject).toBe(seen);
    await fx.admin.from('events').update({ title: original.data?.title }).eq('id', fx.hostA.eventId);
  });

  it('keeps token and RSVP when sending again', async () => {
    const date = await nextDate();
    const guest = await createGuest(`rsvp-${randomBytes(3).toString('hex')}@example.com`);
    const mock = acceptTransport();
    await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date });
    const respondedAt = new Date().toISOString();
    await fx.admin.from('invitations').update({
      status: 'accepted',
      guest_message: 'Se den',
      responded_at: respondedAt,
      last_send_attempt_at: new Date(Date.now() - 120_000).toISOString(),
    }).eq('id', guest.id).eq('status', 'pending');
    const before = await fx.admin.from('invitations').select('token, status, guest_message, responded_at').eq('id', guest.id).single();
    await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date });
    const after = await fx.admin.from('invitations').select('token, status, guest_message, responded_at').eq('id', guest.id).single();
    expect(after.data).toMatchObject({
      token: before.data?.token,
      status: 'accepted',
      guest_message: 'Se den',
    });
    expect(mock.calls).toHaveLength(2);
  });

  it('does not reduce the counter when the invitation fixture is deleted', async () => {
    const date = await nextDate();
    const guest = await createGuest(`delete-${randomBytes(3).toString('hex')}@example.com`);
    const mock = acceptTransport();
    await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: mock.transport, budgetDate: date });
    const held = await counter(date);
    for (const attempt of await attempts(guest.id)) createdAttemptIds.add(attempt.id as string);
    const cleared = await fx.admin.from('invitations').update({ current_send_attempt_id: null }).eq('id', guest.id);
    if (cleared.error) throw cleared.error;
    const deleted = await fx.admin.from('invitations').delete().eq('id', guest.id);
    if (deleted.error) throw deleted.error;
    createdIds.splice(createdIds.indexOf(guest.id), 1);
    expect(await counter(date)).toBe(held);
  });

  it('records a late result on the old attempt without overwriting a newer one', async () => {
    const date = await nextDate();
    const guest = await createGuest(`late-${randomBytes(3).toString('hex')}@example.com`);
    const first = acceptTransport();
    const saved = await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: first.transport, budgetDate: date });
    expect(saved.kind).toBe('completed');
    if (saved.kind !== 'completed') return;
    await fx.admin.from('email_send_attempts').update({
      status: 'unknown',
      resolved_at: new Date().toISOString(),
      provider_message_id: null,
      resolution: 'test-only',
    }).eq('id', saved.attemptId);
    await fx.admin.from('invitations').update({
      last_send_attempt_at: new Date(Date.now() - 120_000).toISOString(),
      email_status: 'unknown',
    }).eq('id', guest.id);
    const second = acceptTransport();
    const newer = await sendInvitation(fx.hostA.id, guest.id, randomUUID(), { transport: second.transport, budgetDate: date });
    expect(newer.kind).toBe('completed');
    if (newer.kind !== 'completed') return;
    await fx.admin.rpc('finalize_email_send', {
      p_actor_id: fx.hostA.id,
      p_attempt_id: saved.attemptId,
      p_outcome: 'accepted',
      p_message_id: '<late@invitation.test>',
      p_error_code: null,
    });
    const oldAttempt = await fx.admin.from('email_send_attempts').select('provider_message_id, status').eq('id', saved.attemptId).single();
    const invitation = await fx.admin.from('invitations').select('current_send_attempt_id, email_status').eq('id', guest.id).single();
    expect(oldAttempt.data?.provider_message_id).toBe('<late@invitation.test>');
    expect(invitation.data?.current_send_attempt_id).toBe(newer.attemptId);
    expect(invitation.data?.email_status).toBe('sent');
  });
});
