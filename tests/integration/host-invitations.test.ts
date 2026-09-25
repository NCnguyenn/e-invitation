import { randomBytes } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { anonClient, setupAuthorizationFixtures, type AuthorizationFixtures } from './fixtures';
import { GET as getInvitations, POST as createInvitation } from '../../src/app/api/host/invitations/route';
import { PATCH as updateInvitation } from '../../src/app/api/host/invitations/[id]/route';

const jar: { name: string; value: string }[] = [];
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => jar,
    set: (name: string, value: string) => {
      const index = jar.findIndex((item) => item.name === name);
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

async function setSessionHost(email: string, pass: string) {
  const collected: { name: string; value: string }[] = [];
  const client = createServerClient(fx.url, fx.anonKey, {
    cookies: {
      getAll: () => collected,
      setAll: (cookies) =>
        cookies.forEach((cookie) => {
          const index = collected.findIndex((item) => item.name === cookie.name);
          const next = { name: cookie.name, value: cookie.value };
          if (index >= 0) collected[index] = next;
          else collected.push(next);
        }),
    },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password: pass });
  if (signedIn.error) throw signedIn.error;
  jar.splice(0, jar.length, ...collected);
}

function clearSession() {
  jar.splice(0, jar.length);
}

function randEmail(prefix: string) {
  return `${prefix}-${randomBytes(6).toString('hex')}@example.com`;
}

async function cleanup() {
  if (createdIds.length === 0) return;
  const chunk = 50;
  for (let i = 0; i < createdIds.length; i += chunk) {
    const slice = createdIds.slice(i, i + chunk);
    await fx.admin.from('invitations').delete().in('id', slice);
  }
  createdIds.length = 0;
}

afterAll(async () => {
  await cleanup();
});

describe('Host Invitations Integration: Permissions and Listing', { timeout: 60_000 }, () => {
  it('blocks anonymous access to GET and PATCH invitations', async () => {
    clearSession();
    const getRes = await getInvitations(new Request('http://127.0.0.1:3100/api/host/invitations'));
    expect(getRes.status).toBe(401);
    expect(getRes.headers.get('cache-control')).toContain('no-store');

    const fakeId = '550e8400-e29b-41d4-a716-446655440000';
    const patchRes = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${fakeId}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Anon', guestEmail: 'anon@example.com' }),
      }),
      { params: Promise.resolve({ id: fakeId }) },
    );
    expect(patchRes.status).toBe(401);
    expect(patchRes.headers.get('cache-control')).toContain('no-store');

    const anon = anonClient(fx.url, fx.anonKey);
    const direct = await anon.from('invitations').select('id');
    expect(direct.error).toBeTruthy();
  });

  it('prevents Host A from reading or modifying Host B invitations', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    // Host A requests list: must NOT contain Host B's invitation
    const getRes = await getInvitations(new Request('http://127.0.0.1:3100/api/host/invitations'));
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.items.some((item: any) => item.id === fx.invitationB.id)).toBe(false);

    // Host A attempts to PATCH Host B's invitation: must return 404
    const patchRes = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${fx.invitationB.id}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Hacked', guestEmail: randEmail('hacked') }),
      }),
      { params: Promise.resolve({ id: fx.invitationB.id }) },
    );
    expect(patchRes.status).toBe(404);

    // Verify Host B's row remains untouched
    const checkB = await fx.admin.from('invitations').select('guest_name').eq('id', fx.invitationB.id).single();
    expect(checkB.data?.guest_name).not.toBe('Hacked');
  });

  it('handles 50+ guests fixture: pagination, stable sorting, totals and filteredTotal', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    // Insert 55 invitations for Host A
    const rowsToInsert = Array.from({ length: 55 }, (_, i) => ({
      event_id: fx.hostA.eventId,
      guest_name: `Fixture Guest ${String(i).padStart(2, '0')}`,
      guest_email: randEmail(`fixture-${i}`),
      invitation_note: `Note ${i}`,
      token: randomBytes(32).toString('hex'),
      status: i < 5 ? 'accepted' : i < 10 ? 'declined' : 'pending',
      responded_at: i < 10 ? new Date().toISOString() : null,
      guest_message: i < 10 ? `Msg ${i}` : null,
      email_status: 'pending',
      has_send_history: false,
    }));

    const { data: inserted, error: insErr } = await fx.admin
      .from('invitations')
      .insert(rowsToInsert)
      .select('id');
    expect(insErr).toBeNull();
    if (!inserted) throw new Error('Insert 55 guests failed');
    for (const r of inserted) createdIds.push(r.id);

    // 1. Page 1: exactly 50 items
    const page1Res = await getInvitations(new Request('http://127.0.0.1:3100/api/host/invitations?page=1'));
    expect(page1Res.status).toBe(200);
    const page1Data = await page1Res.json();
    expect(page1Data.pageSize).toBe(50);
    expect(page1Data.page).toBe(1);
    expect(page1Data.items.length).toBe(50);

    // Totals of the whole event
    expect(page1Data.totals.total).toBe(page1Data.totals.pending + page1Data.totals.accepted + page1Data.totals.declined);
    expect(page1Data.totals.total).toBeGreaterThanOrEqual(55);
    expect(page1Data.filteredTotal).toBe(page1Data.totals.total);

    // 2. Page 2: remaining items
    const page2Res = await getInvitations(new Request('http://127.0.0.1:3100/api/host/invitations?page=2'));
    expect(page2Res.status).toBe(200);
    const page2Data = await page2Res.json();
    expect(page2Data.page).toBe(2);
    expect(page2Data.items.length).toBe(Math.min(50, page1Data.filteredTotal - 50));

    // Check stable sort: NO duplicate IDs between page 1 and page 2
    const page1Ids = new Set(page1Data.items.map((i: any) => i.id));
    const page2Ids = new Set(page2Data.items.map((i: any) => i.id));
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false);
    }

    // 3. Filter by status: accepted
    const acceptedRes = await getInvitations(new Request('http://127.0.0.1:3100/api/host/invitations?status=accepted'));
    expect(acceptedRes.status).toBe(200);
    const acceptedData = await acceptedRes.json();
    expect(acceptedData.filteredTotal).toBe(page1Data.totals.accepted);
    for (const item of acceptedData.items) {
      expect(item.status).toBe('accepted');
    }
    // Entire event totals remain unchanged regardless of filter
    expect(acceptedData.totals).toEqual(page1Data.totals);
  }, 120_000);

  it('combines search + status + special characters safely without error or injection', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const specialName = 'Dương %_Test, "VIP" (Đặc Biệt)';
    const specialEmail = randEmail('special-char');
    const { data: row, error } = await fx.admin
      .from('invitations')
      .insert({
        event_id: fx.hostA.eventId,
        guest_name: specialName,
        guest_email: specialEmail,
        token: randomBytes(32).toString('hex'),
        status: 'pending',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    if (!row) throw new Error('Special char guest insert failed');
    createdIds.push(row.id);

    // Search with special characters: comma, percent, underscore, quotes, parentheses
    const searchTerms = [
      '%_Test',
      'VIP',
      '(Đặc Biệt)',
      'Dương %_Test, "VIP"',
    ];

    for (const query of searchTerms) {
      const url = `http://127.0.0.1:3100/api/host/invitations?query=${encodeURIComponent(query)}&status=pending`;
      const res = await getInvitations(new Request(url));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.items.some((item: any) => item.id === row.id)).toBe(true);
    }
  }, 60_000);
});


describe('Host Invitations Integration: PATCH and Modification Rules', { timeout: 60_000 }, () => {
  it('updates guest information before send history, preserving token and RSVP', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const originalEmail = randEmail('patch-orig');
    const { data: row, error } = await fx.admin
      .from('invitations')
      .insert({
        event_id: fx.hostA.eventId,
        guest_name: 'Original Name',
        guest_email: originalEmail,
        invitation_note: 'Original Note',
        token: randomBytes(32).toString('hex'),
        status: 'pending',
        has_send_history: false,
        email_status: 'pending',
      })
      .select('id, token, status')
      .single();
    expect(error).toBeNull();
    if (!row) throw new Error('Fixture insert failed');
    createdIds.push(row.id);

    const newEmail = randEmail('patch-new');
    const patchRes = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${row.id}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({
          guestName: '  Updated Name  ',
          guestEmail: `  ${newEmail.toUpperCase()} `,
          invitationNote: '  Updated Note  ',
        }),
      }),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(patchRes.status).toBe(200);
    const body = await patchRes.json();
    expect(body.invitation.guestName).toBe('Updated Name');
    expect(body.invitation.guestEmail).toBe(newEmail.toLowerCase());
    expect(body.invitation.invitationNote).toBe('Updated Note');
    // Token and status must remain completely unchanged
    expect(body.invitation.token).toBe(row.token);
    expect(body.invitation.status).toBe(row.status);

    // Verify in database
    const dbRow = await fx.admin.from('invitations').select('guest_name, guest_email, token, status').eq('id', row.id).single();
    expect(dbRow.data?.guest_name).toBe('Updated Name');
    expect(dbRow.data?.guest_email).toBe(newEmail.toLowerCase());
    expect(dbRow.data?.token).toBe(row.token);
    expect(dbRow.data?.status).toBe('pending');
  });

  it('rejects PATCH and database updates when has_send_history is true', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const guestEmail = randEmail('sent-lock');
    const { data: row, error } = await fx.admin
      .from('invitations')
      .insert({
        event_id: fx.hostA.eventId,
        guest_name: 'Sent Locked Guest',
        guest_email: guestEmail,
        token: randomBytes(32).toString('hex'),
        status: 'pending',
        has_send_history: true,
        email_status: 'sent',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    if (!row) throw new Error('Fixture insert failed');
    createdIds.push(row.id);

    // PATCH via API: must return 409
    const patchRes = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${row.id}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Attempted Change', guestEmail: randEmail('sent-attempt') }),
      }),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(patchRes.status).toBe(409);
    const body = await patchRes.json();
    expect(body.code).toBe('invitation_locked');

    // Direct database write must also be blocked by trigger
    const dbUpdate = await fx.hostA.client.from('invitations').update({ guest_name: 'Direct' }).eq('id', row.id);
    expect(dbUpdate.error?.code).toBe('42501');
  });

  it('rejects PATCH when email_status is sending or unknown', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    for (const status of ['sending', 'unknown'] as const) {
      const { data: row, error } = await fx.admin
        .from('invitations')
        .insert({
          event_id: fx.hostA.eventId,
          guest_name: `Status ${status}`,
          guest_email: randEmail(`status-${status}`),
          token: randomBytes(32).toString('hex'),
          status: 'pending',
          has_send_history: false,
          email_status: status,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      if (!row) throw new Error('Fixture insert failed');
      createdIds.push(row.id);

      const patchRes = await updateInvitation(
        new Request(`http://127.0.0.1:3100/api/host/invitations/${row.id}`, {
          method: 'PATCH',
          headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
          body: JSON.stringify({ guestName: 'New Name', guestEmail: randEmail('new-status') }),
        }),
        { params: Promise.resolve({ id: row.id }) },
      );
      expect(patchRes.status).toBe(409);
      const body = await patchRes.json();
      expect(body.code).toBe('invitation_locked');
    }
  });

  it('returns 409 duplicate_email when updating to an existing email in the same event', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const email1 = randEmail('dup1');
    const email2 = randEmail('dup2');

    const [row1, row2] = await Promise.all([
      fx.admin.from('invitations').insert({
        event_id: fx.hostA.eventId, guest_name: 'Guest 1', guest_email: email1,
        token: randomBytes(32).toString('hex'), status: 'pending',
      }).select('id, token, status').single(),
      fx.admin.from('invitations').insert({
        event_id: fx.hostA.eventId, guest_name: 'Guest 2', guest_email: email2,
        token: randomBytes(32).toString('hex'), status: 'pending',
      }).select('id, token, status').single(),
    ]);

    expect(row1.error).toBeNull();
    expect(row2.error).toBeNull();
    createdIds.push(row1.data!.id, row2.data!.id);

    // Try to update row 2's email to row 1's email
    const patchRes = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${row2.data!.id}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Guest 2 New', guestEmail: email1 }),
      }),
      { params: Promise.resolve({ id: row2.data!.id }) },
    );
    expect(patchRes.status).toBe(409);
    const body = await patchRes.json();
    expect(body.code).toBe('duplicate_email');

    // Verify row 2 data and token/status did NOT change
    const checkRow2 = await fx.admin.from('invitations').select('guest_email, guest_name, token, status').eq('id', row2.data!.id).single();
    expect(checkRow2.data?.guest_email).toBe(email2);
    expect(checkRow2.data?.guest_name).toBe('Guest 2');
    expect(checkRow2.data?.token).toBe(row2.data!.token);
    expect(checkRow2.data?.status).toBe(row2.data!.status);
  });

  it('rejects PATCH payloads with system fields', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const { data: row } = await fx.admin.from('invitations').insert({
      event_id: fx.hostA.eventId, guest_name: 'System Test', guest_email: randEmail('system'),
      token: randomBytes(32).toString('hex'), status: 'pending',
    }).select('id').single();
    createdIds.push(row!.id);

    for (const extra of ['token', 'status', 'event_id', 'has_send_history', 'email_status', 'responded_at']) {
      const res = await updateInvitation(
        new Request(`http://127.0.0.1:3100/api/host/invitations/${row!.id}`, {
          method: 'PATCH',
          headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
          body: JSON.stringify({ guestName: 'Val', guestEmail: randEmail('extra'), [extra]: 'illegal' }),
        }),
        { params: Promise.resolve({ id: row!.id }) },
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe('invalid_input');
    }
  });

  it('returns unified 404 for nonexistent invitation ID or malformed UUID', async () => {
    await setSessionHost(fx.hostA.email, fx.hostA.password);

    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const res1 = await updateInvitation(
      new Request(`http://127.0.0.1:3100/api/host/invitations/${nonExistentId}`, {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Val', guestEmail: randEmail('nonexistent') }),
      }),
      { params: Promise.resolve({ id: nonExistentId }) },
    );
    expect(res1.status).toBe(404);

    const res2 = await updateInvitation(
      new Request('http://127.0.0.1:3100/api/host/invitations/not-a-uuid', {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3100', 'content-type': 'application/json' },
        body: JSON.stringify({ guestName: 'Val', guestEmail: randEmail('malformed') }),
      }),
      { params: Promise.resolve({ id: 'not-a-uuid' }) },
    );
    expect(res2.status).toBe(404);
  });
});
