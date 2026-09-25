import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseTestEnv } from './env';
import { assertFixtureEmail } from './safety';

export const TEMPLATE_KEY = 'wedding-floral-01';

export type HostFixture = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
  eventId: string | null;
};

export type AuthorizationFixtures = {
  url: string;
  anonKey: string;
  admin: SupabaseClient;
  hostA: HostFixture;
  hostB: HostFixture;
  hostNone: HostFixture;
  invitationA: { id: string; token: string };
  invitationLocked: { id: string; token: string };
  invitationB: { id: string; token: string };
};

function randomPassword(): string {
  return `${randomBytes(24).toString('base64url')}Aa1!`;
}

function hexToken(): string {
  return randomBytes(32).toString('hex');
}

function fixtureEmail(host: string, slot: 'a' | 'b' | 'none'): string {
  const fromEnv = process.env[`TEST_HOST_${slot === 'none' ? 'NONE' : slot.toUpperCase()}_EMAIL`];
  const project = host.split('.')[0] ?? 'local';
  const expected = `mvp-step2-host-${slot}.${project}@example.com`;
  const email = fromEnv?.trim().toLowerCase() || expected;
  assertFixtureEmail(email, expected);
  return email;
}

function fixturePassword(slot: 'a' | 'b' | 'none'): string {
  const fromEnv = process.env[`TEST_HOST_${slot === 'none' ? 'NONE' : slot.toUpperCase()}_PASSWORD`];
  if (fromEnv?.trim()) return fromEnv.trim();
  return randomPassword();
}

async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    let data: { users: { id: string; email?: string }[] } | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (!result.error) {
        data = result.data;
        lastError = undefined;
        break;
      }
      lastError = result.error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
    if (!data) throw lastError;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const existingId = await findUserIdByEmail(admin, email);
  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return existingId;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'developer' },
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  return data.user.id;
}

async function signedInClient(url: string, anonKey: string, email: string, password: string) {
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error('Fixture host sign-in failed');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function ensureEvent(
  admin: SupabaseClient,
  userId: string,
  title: string,
): Promise<string> {
  const { data: existing, error: readError } = await admin
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) throw readError;
  const payload = {
    title,
    template_key: TEMPLATE_KEY,
    event_date: '2026-12-20T10:00:00+07:00',
    timezone: 'Asia/Ho_Chi_Minh',
    venue_name: 'Nha hang thu',
    venue_address: '1 Nguyen Hue, Quan 1',
    google_map_url: 'https://www.google.com/maps/place/Saigon',
    lifecycle_status: 'active',
  };
  if (existing?.id) {
    const { error } = await admin.from('events').update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data, error } = await admin
    .from('events')
    .insert({ user_id: userId, ...payload })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('event insert failed');
  return data.id as string;
}

async function ensureInvitation(
  admin: SupabaseClient,
  eventId: string,
  guestEmail: string,
  guestName: string,
  options?: { locked?: boolean },
): Promise<{ id: string; token: string }> {
  const { data: existing, error: readError } = await admin
    .from('invitations')
    .select('id, token, status')
    .eq('event_id', eventId)
    .eq('guest_email', guestEmail)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.id) {
    if (options?.locked && existing.status === 'pending') {
      const { error } = await admin
        .from('invitations')
        .update({
          status: 'accepted',
          guest_message: 'Da xac nhan',
          responded_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('status', 'pending');
      if (error) throw error;
    }
    return { id: existing.id as string, token: existing.token as string };
  }
  const row = {
    event_id: eventId,
    guest_name: guestName,
    guest_email: guestEmail,
    invitation_note: 'Loi moi thu',
    token: hexToken(),
    status: 'pending',
  };
  const { data, error } = await admin.from('invitations').insert(row).select('id, token').single();
  if (error || !data) throw error ?? new Error('invitation insert failed');
  if (options?.locked) {
    const { error: lockError } = await admin
      .from('invitations')
      .update({
        status: 'accepted',
        guest_message: 'Da xac nhan',
        responded_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('status', 'pending');
    if (lockError) throw lockError;
  }
  return { id: data.id as string, token: data.token as string };
}

export async function setupAuthorizationFixtures(): Promise<AuthorizationFixtures> {
  const env = requireSupabaseTestEnv();
  const admin = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const hostAEmail = fixtureEmail(env.host, 'a');
  const hostBEmail = fixtureEmail(env.host, 'b');
  const hostNoneEmail = fixtureEmail(env.host, 'none');
  const hostAPassword = fixturePassword('a');
  const hostBPassword = fixturePassword('b');
  const hostNonePassword = fixturePassword('none');

  const hostAId = await ensureUser(admin, hostAEmail, hostAPassword);
  const hostBId = await ensureUser(admin, hostBEmail, hostBPassword);
  const hostNoneId = await ensureUser(
    admin,
    hostNoneEmail,
    hostNonePassword,
  );

  const eventAId = await ensureEvent(admin, hostAId, 'MVP Step2 Event A');
  const eventBId = await ensureEvent(admin, hostBId, 'MVP Step2 Event B');

  const { count, error: noneEventError } = await admin.from('events')
    .select('id', { count: 'exact', head: true }).eq('user_id', hostNoneId);
  if (noneEventError) throw noneEventError;
  if (count !== 0) throw new Error('Host-none fixture already owns an event; refusing to delete it.');

  const invitationA = await ensureInvitation(admin, eventAId, 'guest.a@example.com', 'Khach A');
  const invitationLocked = await ensureInvitation(
    admin,
    eventAId,
    'guest.locked@example.com',
    'Khach khoa',
    { locked: true },
  );
  const invitationB = await ensureInvitation(admin, eventBId, 'guest.b@example.com', 'Khach B');

  const [clientA, clientB, clientNone] = await Promise.all([
    signedInClient(env.url, env.anonKey, hostAEmail, hostAPassword),
    signedInClient(env.url, env.anonKey, hostBEmail, hostBPassword),
    signedInClient(env.url, env.anonKey, hostNoneEmail, hostNonePassword),
  ]);

  return {
    url: env.url,
    anonKey: env.anonKey,
    admin,
    hostA: {
      id: hostAId,
      email: hostAEmail,
      password: hostAPassword,
      client: clientA,
      eventId: eventAId,
    },
    hostB: {
      id: hostBId,
      email: hostBEmail,
      password: hostBPassword,
      client: clientB,
      eventId: eventBId,
    },
    hostNone: {
      id: hostNoneId,
      email: hostNoneEmail,
      password: hostNonePassword,
      client: clientNone,
      eventId: null,
    },
    invitationA,
    invitationLocked,
    invitationB,
  };
}

export function anonClient(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
